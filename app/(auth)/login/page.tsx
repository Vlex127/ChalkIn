import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to ChalkIn.",
  alternates: {
    canonical: "/login",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ check?: string }>;
}) {
  const { check } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Log in
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        Use the email you signed up with.
      </p>
      <LoginForm
        notice={
          check === "email"
            ? "Check your email to confirm your account, then log in."
            : undefined
        }
      />
    </>
  );
}
