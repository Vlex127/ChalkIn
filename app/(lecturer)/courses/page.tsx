import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/configured";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Courses",
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

export default async function LecturerCoursesPage() {
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
  if (profile.role !== "lecturer") redirect("/dashboard");
  if (!profile.approved) redirect("/pending");

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Courses</h1>
          <p className="mt-2 text-neutral-600">
            Create a course, add the class list, and start a session when class
            begins.
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
        <h2 className="font-medium">No courses yet</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Course creation is being wired up next. The database schema is already
          in place.
        </p>
      </div>
    </div>
  );
}
