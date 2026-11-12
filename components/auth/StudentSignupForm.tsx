"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpStudent, type AuthState } from "@/lib/auth/actions";
import { FormError } from "./FormError";
import { FormField } from "./FormField";

const initial: AuthState = { error: null };

export function StudentSignupForm() {
  const [state, formAction, pending] = useActionState(signUpStudent, initial);

  return (
    <>
      <form action={formAction} className="mt-6 space-y-4">
        <FormField
          label="Full name"
          name="fullName"
          autoComplete="name"
          required
        />
        <FormField
          label="Matric number"
          name="matricNo"
          autoComplete="off"
          required
        />
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
          autoComplete="new-password"
          minLength={8}
          required
        />
        <FormError message={state.error} />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-sm text-neutral-500">
        After signing up you will register this phone. Your matric number must be
        on a class list for attendance to count.
      </p>
      <p className="mt-4 text-sm text-neutral-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-neutral-900 underline">
          Log in
        </Link>
      </p>
    </>
  );
}
