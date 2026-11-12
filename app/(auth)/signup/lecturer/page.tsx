import type { Metadata } from "next";
import { LecturerSignupForm } from "@/components/auth/LecturerSignupForm";

export const metadata: Metadata = {
  title: "Lecturer sign up",
  description: "Create a ChalkIn lecturer account.",
  alternates: {
    canonical: "/signup/lecturer",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function LecturerSignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Lecturer sign up
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        Create an account with your staff number. An admin will approve it
        before courses go live.
      </p>
      <LecturerSignupForm />
    </>
  );
}
