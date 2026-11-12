import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Home",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

type Profile = {
  role: string;
  full_name: string | null;
};

export default async function StudentHomePage() {
  if (!isSupabaseConfigured()) return <SupabaseSetupNotice />;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as Profile | null;

  if (!profile) redirect("/login");
  if (profile.role !== "student") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-2 text-neutral-600">
            When a lecturer starts a session, enter the check-in code here. It
            works without data and syncs when you are back online.
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
        <h2 className="font-medium">No active session</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Check-in will appear here once a lecturer opens a session for your
          course.
        </p>
      </div>
    </div>
  );
}
