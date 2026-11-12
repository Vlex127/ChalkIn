import type { Metadata } from "next";
import { StudentSignupForm } from "@/components/auth/StudentSignupForm";

export const metadata: Metadata = {
  title: "Student sign up",
  description: "Create a ChalkIn student account.",
  alternates: {
    canonical: "/signup/student",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function StudentSignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Student sign up
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        Create an account with your school email and matric number.
      </p>
      <StudentSignupForm />
    </>
  );
}
