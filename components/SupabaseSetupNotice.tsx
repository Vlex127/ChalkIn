export function SupabaseSetupNotice() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Supabase is not configured
      </h1>
      <p className="mt-3 text-neutral-600">
        Add <code className="rounded bg-neutral-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="rounded bg-neutral-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
        to <code className="rounded bg-neutral-100 px-1">.env.local</code>, then
        restart the dev server. The README has the full setup.
      </p>
    </div>
  );
}
