The migration is in `0001_init.sql`. It has the tables, RLS policies, verification logic, and the RPCs. I haven't run it against a real Supabase project, so apply it to a fresh dev project first and fix whatever it complains about.

# Changes from the earlier sketch

- **Signature checking is not in Postgres.** Postgres can't verify the ECDSA signatures that WebCrypto produces. So sync goes through a Next.js route, `/api/sync`, which checks the signature and then calls the SQL functions with the service role key. The rest of verification (code, time window, roster, location, duplicates) stays in SQL.
- **`enrollments` is now keyed by matric number** instead of student id. A lecturer uploads a CSV before students have signed up, so the roster can't point at accounts that don't exist yet.
- **`devices` stores `public_key`** (a JWK) instead of `device_hash`.

# Rules the RLS enforces

- Clients can't insert or update `submissions` or `sessions` at all. There are no write policies, and I also revoked write privileges as a second layer.
- **Students can't read `sessions`**, because the code lives there. Students get their percentages from the `my_attendance()` function instead.
- Lecturers see only data for courses they teach, and only if `approved = true`.
- A signup can claim `student` or `lecturer` only. Lecturers start unapproved, and an admin is created by hand. The role comes from signup metadata that the user controls, so the trigger never trusts `admin`.
- To approve a lecturer in the pilot, run `update profiles set approved = true where staff_no = '...'` in the SQL editor.

# What `/api/sync` must do

1. Read the access token from the `Authorization` header and get the user with `supabase.auth.getUser(token)`.
2. Load that user's active device and public key.
3. For each item, rebuild the canonical string and verify the signature with `crypto.subtle.verify`. Use a fixed field order and fixed number formatting (for example `lat.toFixed(6)`), or the signatures won't match between phone and server.
4. Take `student_id` and `device_id` from step 1 and step 2, **never from the request body**.
5. Call `ingest_submissions` or `ingest_sessions` with the service role client and return each item's status.

# Supabase dashboard settings

- Keep refresh token rotation on, and don't set a session time limit. That gives you the "logged in forever" behaviour.
- Email confirmation: I'd start with it off for the pilot, since email delivery can be slow or flaky. Turn it on before real rollout.
- Put `SUPABASE_SERVICE_ROLE_KEY` in server-only env vars. It must never reach the browser or have a `NEXT_PUBLIC_` prefix.
- Enable `pg_cron` and schedule the `sweep_pending` line that's commented in the file.

# Known gaps

- **Matric number squatting.** Anyone can sign up with someone else's matric number, since matric numbers aren't secret. For the pilot, handle disputes by hand with the lecturer. Later, tie signup to something only the student has, like a one-time PIN on the class list or a school-email check.
- **Clock mismatch.** If a student's phone clock is far off, they won't match the session window and will end up rejected. Prompting students to turn on automatic time helps.
- **Rebind abuse.** A student could ask to "lose" their phone repeatedly. The lecturer approving each rebind is your control there.

# Project folder structure

```
chalkin/
├─ supabase/
│  ├─ migrations/0001_init.sql
│  └─ config.toml
├─ public/
│  ├─ manifest.webmanifest
│  └─ icons/                      # 192, 512, maskable
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                 # redirects by role
│  │  ├─ (auth)/
│  │  │  ├─ login/page.tsx
│  │  │  ├─ signup/student/page.tsx
│  │  │  └─ signup/lecturer/page.tsx
│  │  ├─ (student)/
│  │  │  ├─ bind/page.tsx         # register phone + install prompt
│  │  │  ├─ home/page.tsx
│  │  │  ├─ mark/page.tsx         # code keypad
│  │  │  ├─ receipt/[id]/page.tsx
│  │  │  ├─ course/[id]/page.tsx
│  │  │  └─ settings/page.tsx
│  │  ├─ (lecturer)/
│  │  │  ├─ courses/page.tsx
│  │  │  ├─ course/[id]/page.tsx
│  │  │  ├─ course/[id]/roster/page.tsx   # CSV upload
│  │  │  ├─ session/[id]/page.tsx         # big code screen
│  │  │  └─ results/[sessionId]/page.tsx
│  │  └─ api/
│  │     └─ sync/route.ts                 # verify signatures, call ingest_*
│  ├─ lib/
│  │  ├─ supabase/ client.ts · server.ts · admin.ts
│  │  ├─ crypto/
│  │  │  ├─ deviceKey.ts          # generate non-extractable key, sign
│  │  │  └─ canonical.ts          # shared canonical string for signing
│  │  ├─ offline/
│  │  │  ├─ db.ts                 # IndexedDB wrapper (idb)
│  │  │  ├─ outbox.ts             # enqueue, mark, retry state
│  │  │  └─ sync.ts               # trySync, backoff, triggers
│  │  ├─ code.ts                  # 6-digit generator (crypto.getRandomValues)
│  │  └─ geo.ts
│  ├─ components/
│  │  ├─ CodeKeypad.tsx · BigCode.tsx · SyncBadge.tsx
│  │  ├─ PendingBanner.tsx · InstallPrompt.tsx
│  ├─ hooks/
│  │  ├─ useOnline.ts · useSyncOnOpen.ts · useWakeLock.ts
│  └─ sw.ts                       # service worker source
├─ next.config.mjs                # Serwist setup
├─ .env.local
└─ package.json
```

**Packages:** `@supabase/supabase-js`, `@supabase/ssr`, `idb`, `@serwist/next`, `serwist`, `zod`.

**Two build notes:**
- The screens used in the hall (`mark`, `session`, `home`) should be client components with data from IndexedDB, not server-rendered pages, so they load offline. Test with airplane mode from the first day, not at the end.
- Serwist replaces the older next-pwa package for service workers in the App Router.

Next I'd build the offline core, `deviceKey.ts`, `outbox.ts`, `sync.ts`, and the `/api/sync` route, because that's the riskiest part of the whole project. Want me to write those files?
