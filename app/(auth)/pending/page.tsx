import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Awaiting approval",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

type Profile = {
  role: string;
  full_name: string | null;
  approved: boolean;
};

export default async function PendingPage() {
  if (!isSupabaseConfigured()) return <SupabaseSetupNotice />;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("role, full_name, approved")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as Profile | null;

  if (!profile) redirect("/login");
  if (profile.role !== "lecturer" || profile.approved) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="w-fit rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
        Awaiting approval
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Your lecturer account is pending
      </h1>
      <p className="mt-3 text-neutral-600">
        {profile.full_name ? `Thanks, ${profile.full_name}. ` : ""}
        An admin needs to approve your account before you can create courses and
        start sessions.
      </p>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
