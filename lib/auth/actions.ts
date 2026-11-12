"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

const email = z.email("Enter a valid email address.");
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.");

const loginSchema = z.object({ email, password });

const studentSignupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  matricNo: z.string().trim().min(2, "Enter your matric number.").max(40),
  email,
  password,
});

const lecturerSignupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  staffNo: z.string().trim().min(2, "Enter your staff number.").max(40),
  email,
  password,
});

const read = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const firstError = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Check the form and try again.";

async function client(): Promise<SupabaseClient | null> {
  try {
    return await createSupabaseServerClient();
  } catch {
    return null;
  }
}

const NOT_CONFIGURED = "Supabase is not configured yet.";

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: read(formData, "email"),
    password: read(formData, "password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await client();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signUpStudent(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = studentSignupSchema.safeParse({
    fullName: read(formData, "fullName"),
    matricNo: read(formData, "matricNo"),
    email: read(formData, "email"),
    password: read(formData, "password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await client();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        role: "student",
        full_name: parsed.data.fullName,
        matric_no: parsed.data.matricNo,
      },
    },
  });
  if (error) return { error: error.message };

  redirect(data.session ? "/dashboard" : "/login?check=email");
}

export async function signUpLecturer(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = lecturerSignupSchema.safeParse({
    fullName: read(formData, "fullName"),
    staffNo: read(formData, "staffNo"),
    email: read(formData, "email"),
    password: read(formData, "password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await client();
  if (!supabase) return { error: NOT_CONFIGURED };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        role: "lecturer",
        full_name: parsed.data.fullName,
        staff_no: parsed.data.staffNo,
      },
    },
  });
  if (error) return { error: error.message };

  redirect(data.session ? "/pending" : "/login?check=email");
}

export async function signOut(): Promise<void> {
  const supabase = await client();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
