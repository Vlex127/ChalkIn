import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
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

export default async function DashboardPage() {
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
  if (profile.role === "student") redirect("/home");
  if (profile.role === "lecturer" && !profile.approved) redirect("/pending");

  if (profile.role === "admin") {
    const [{ count: totalUsers }, { count: pendingLecturers }] =
      await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "lecturer")
          .eq("approved", false),
      ]);

    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Admin overview
            </h1>
            <p className="mt-2 text-neutral-600">
              Manage lecturer approvals and keep an eye on the roll-out.
            </p>
          </div>
          <SignOutButton />
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 p-5">
            <dt className="text-sm text-neutral-600">Accounts</dt>
            <dd className="mt-1 text-3xl font-semibold">{totalUsers ?? 0}</dd>
          </div>
          <div className="rounded-xl border border-neutral-200 p-5">
            <dt className="text-sm text-neutral-600">Lecturers pending</dt>
            <dd className="mt-1 text-3xl font-semibold">
              {pendingLecturers ?? 0}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-2 text-neutral-600">
            Start a session, share the check-in code, and review attendance when
            phones sync.
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-8 rounded-xl border border-neutral-200 p-6">
        <h2 className="font-medium">Courses</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Create a course, add the class list, and open a session from there.
        </p>
        <Link
          href="/courses"
          className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Open courses
        </Link>
      </div>
    </div>
  );
}
