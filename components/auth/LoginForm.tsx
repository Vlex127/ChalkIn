"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthState } from "@/lib/auth/actions";
import { FormError } from "./FormError";
import { FormField } from "./FormField";

const initial: AuthState = { error: null };

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <>
      {notice ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <form action={formAction} className="mt-6 space-y-4">
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <FormError message={state.error} />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-neutral-600">
        New student?{" "}
        <Link
          href="/signup/student"
          className="font-medium text-neutral-900 underline"
        >
          Create a student account
        </Link>
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        Lecturer?{" "}
        <Link
          href="/signup/lecturer"
          className="font-medium text-neutral-900 underline"
        >
          Create a lecturer account
        </Link>
      </p>
    </>
  );
}
