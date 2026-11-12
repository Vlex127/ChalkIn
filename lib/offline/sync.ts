import { getSupabaseClient } from '../supabase/client';
import { getDb, type OutboxItem, type ServerStatus } from './db';

const BATCH = 20;

// 30s, 2m, 8m, then every 10m. Gentle on weak 2G and small data bundles.
const backoffMs = (attempts: number) =>
  Math.min(30_000 * 4 ** Math.max(0, attempts - 1), 600_000);

type Result = {
  id: string;
  ok: boolean;
  status?: ServerStatus;
  reason?: string | null;
  error?: string;
};

const ERROR_TEXT: Record<string, string> = {
  bad_signature: 'This phone key was not accepted. Request a new phone registration.',
  no_active_device: 'No registered phone for this account. Register this phone first.',
  wrong_role: 'This account cannot upload this kind of record.',
  not_allowed: 'You are not allowed to upload this.',
  bad_payload: 'The record was invalid.',
};

// ---- tiny subscription so the UI can re-render sync badges ----------------
const listeners = new Set<() => void>();
export const subscribeToSync = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const notify = () => listeners.forEach((f) => f());

let running = false;

async function retryLater(items: OutboxItem[], why: string) {
  const db = await getDb();
  for (const it of items) {
    const attempts = it.attempts + 1;
    await db.put('outbox', {
      ...it,
      state: 'queued',
      attempts,
      lastError: why,
      nextAttemptAt: Date.now() + backoffMs(attempts),
    });
  }
}

async function applyResults(batch: OutboxItem[], results: Result[]) {
  const db = await getDb();
  const byId = new Map(results.map((r) => [r.id, r]));
  const retry: OutboxItem[] = [];

  for (const it of batch) {
    const r = byId.get(it.id);
    if (!r || r.error === 'server_error') {
      retry.push(it);
    } else if (r.ok) {
      await db.put('outbox', {
        ...it,
        state: 'sent',
        lastError: undefined,
        serverStatus: r.status ?? 'pending',
        serverReason: r.reason ?? null,
      });
    } else {
      // Permanent failure: do not retry, show the reason to the user.
      await db.put('outbox', {
        ...it,
        state: 'sent',
        serverStatus: 'rejected',
        serverReason: ERROR_TEXT[r.error ?? ''] ?? 'Rejected by server.',
      });
    }
  }
  if (retry.length) await retryLater(retry, 'server_error');
}

/** Pull the latest verdict for submissions that were still pending or flagged. */
async function refreshStatuses(userId: string) {
  const db = await getDb();
  const supabase = getSupabaseClient();
  const open = (await db.getAllFromIndex('outbox', 'by-user', userId)).filter(
    (i) =>
      i.kind === 'submission' &&
      i.state === 'sent' &&
      (i.serverStatus === 'pending' || i.serverStatus === 'flagged'),
  );
  if (!open.length) return;

  // Students can read their own submissions through RLS.
  const { data, error } = await supabase
    .from('submissions')
    .select('id,status,flag_reason')
    .in('id', open.slice(0, 100).map((i) => i.id));
  if (error || !data) return;

  for (const row of data) {
    const cur = open.find((i) => i.id === row.id);
    if (cur) {
      await db.put('outbox', {
        ...cur,
        serverStatus: row.status as ServerStatus,
        serverReason: row.flag_reason,
      });
    }
  }
}

/**
 * Safe to call any time, any number of times. Does nothing if offline, already
 * running, or not logged in (the queue is left untouched in that case).
 */
export async function trySync(userId: string): Promise<void> {
  if (running) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  running = true;

  try {
    const db = await getDb();
    const supabase = getSupabaseClient();

    // Anything stuck in 'sending' (tab closed mid-request) goes back in the queue.
    for (const it of await db.getAllFromIndex('outbox', 'by-user', userId)) {
      if (it.state === 'sending') await db.put('outbox', { ...it, state: 'queued' });
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const now = Date.now();
    const due = (await db.getAllFromIndex('outbox', 'by-user', userId))
      .filter((i) => i.state === 'queued' && i.nextAttemptAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt);

    for (let i = 0; i < due.length; i += BATCH) {
      const batch = due.slice(i, i + BATCH);
      for (const it of batch) await db.put('outbox', { ...it, state: 'sending' });

      let res: Response;
      try {
        res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            items: batch.map((it) => ({
              kind: it.kind,
              payload: it.payload,
              signature: it.signature,
            })),
          }),
        });
      } catch {
        await retryLater(batch, 'network');
        break; // connection is bad, stop and back off
      }

      if (!res.ok) {
        await retryLater(batch, res.status === 401 ? 'auth' : `http_${res.status}`);
        break;
      }

      const body = (await res.json()) as { results: Result[] };
      await applyResults(batch, body.results);
    }

    await refreshStatuses(userId);
  } finally {
    running = false;
    notify();
  }
}

/**
 * Wire this up once after login. Sync fires on: app open, coming back to the
 * foreground, the browser going online, and every 60s while visible.
 * (iPhone has no background sync, so app-open is the main trigger there.)
 */
export function startSyncTriggers(userId: string): () => void {
  const run = () => void trySync(userId);
  const onVisible = () => {
    if (document.visibilityState === 'visible') run();
  };

  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(onVisible, 60_000);
  run();

  return () => {
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}
