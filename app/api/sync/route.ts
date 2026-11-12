import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  canonicalSession,
  canonicalSubmission,
} from "@/lib/crypto/canonical";

export const runtime = "nodejs";

const submissionSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  codeEntered: z.string().regex(/^\d{6}$/),
  clientTs: z.iso.datetime(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  accuracyM: z.number().nullable(),
});

const sessionSchema = z.object({
  id: z.uuid(),
  courseId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
  openedAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

const itemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("submission"),
    payload: submissionSchema,
    signature: z.string().min(1),
  }),
  z.object({
    kind: z.literal("session"),
    payload: sessionSchema,
    signature: z.string().min(1),
  }),
]);

const bodySchema = z.object({
  items: z.array(z.unknown()).min(1).max(50),
});

type Item = z.infer<typeof itemSchema>;
type ServerStatus = "pending" | "verified" | "flagged" | "rejected" | "expired";

type Result = {
  id: string;
  ok: boolean;
  status?: ServerStatus;
  reason?: string | null;
  error?: string;
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing_supabase_env");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function verifySignature(
  publicJwk: JsonWebKey,
  message: string,
  signature: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      publicJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const bytes = Uint8Array.from(Buffer.from(signature, "base64"));
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      bytes,
      new TextEncoder().encode(message),
    );
  } catch {
    return false;
  }
}

function itemId(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "";
  const obj = raw as { id?: unknown; payload?: { id?: unknown } };
  if (typeof obj.payload?.id === "string") return obj.payload.id;
  if (typeof obj.id === "string") return obj.id;
  return "";
}

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json({ error: "unauthorized" }, 401);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json({ error: "bad_payload" }, 400);
  }

  const body = bodySchema.safeParse(rawBody);
  if (!body.success) return json({ error: "bad_payload" }, 400);

  let admin: SupabaseClient;
  try {
    admin = serviceClient();
  } catch {
    return json({ error: "server_misconfigured" }, 500);
  }

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "unauthorized" }, 401);
  const userId = authData.user.id;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, approved")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return json({ error: "server_error" }, 500);
  if (!profile) return json({ error: "not_allowed" }, 403);

  const { data: device, error: deviceError } = await admin
    .from("devices")
    .select("id, public_key")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (deviceError) return json({ error: "server_error" }, 500);

  const results: Result[] = [];
  const accepted: Item[] = [];

  for (const raw of body.data.items) {
    const parsed = itemSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({ id: itemId(raw), ok: false, error: "bad_payload" });
      continue;
    }

    const item = parsed.data;
    if (!device) {
      results.push({ id: item.payload.id, ok: false, error: "no_active_device" });
      continue;
    }

    const roleOk =
      item.kind === "submission"
        ? profile.role === "student"
        : profile.role === "lecturer";
    if (!roleOk) {
      results.push({ id: item.payload.id, ok: false, error: "wrong_role" });
      continue;
    }

    const message =
      item.kind === "submission"
        ? canonicalSubmission(item.payload)
        : canonicalSession(item.payload);
    const signed = await verifySignature(
      device.public_key as JsonWebKey,
      message,
      item.signature,
    );
    if (!signed) {
      results.push({ id: item.payload.id, ok: false, error: "bad_signature" });
      continue;
    }

    accepted.push(item);
  }

  const submissions = accepted.filter(
    (i): i is Extract<Item, { kind: "submission" }> => i.kind === "submission",
  );
  const sessions = accepted.filter(
    (i): i is Extract<Item, { kind: "session" }> => i.kind === "session",
  );

  if (submissions.length && device) {
    const { data, error } = await admin.rpc("ingest_submissions", {
      p_user: userId,
      p_device: device.id,
      p_items: submissions.map((i) => i.payload),
    });

    if (error) {
      for (const item of submissions) {
        results.push({ id: item.payload.id, ok: false, error: "server_error" });
      }
    } else {
      const rows = (data ?? []) as Array<{
        sub_id: string;
        sub_status: ServerStatus;
        sub_reason: string | null;
      }>;
      const byId = new Map(rows.map((r) => [r.sub_id, r]));
      for (const item of submissions) {
        const row = byId.get(item.payload.id);
        results.push(
          row
            ? {
                id: item.payload.id,
                ok: true,
                status: row.sub_status,
                reason: row.sub_reason,
              }
            : { id: item.payload.id, ok: true, status: "pending" },
        );
      }
    }
  }

  if (sessions.length && device) {
    const { error } = await admin.rpc("ingest_sessions", {
      p_user: userId,
      p_device: device.id,
      p_items: sessions.map((i) => i.payload),
    });
    for (const item of sessions) {
      results.push(
        error
          ? { id: item.payload.id, ok: false, error: "server_error" }
          : { id: item.payload.id, ok: true },
      );
    }
  }

  return json({ results }, 200);
}
