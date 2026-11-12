# ChalkIn Architecture

This note explains how ChalkIn is put together and where it is going. It is
written for someone reading the repository cold.

## What it is

ChalkIn is offline-first class attendance for Nigerian universities. A lecturer
starts a session, students check in from their phones without a network, and the
records sync when a connection returns.

## Current state

- Landing page (`app/page.tsx`).
- Offline core modules under `lib/` (device keys, IndexedDB queue, sync engine).
- Server route `app/api/sync/route.ts` that verifies device signatures and calls
  the database ingest functions.
- Initial migration at `supabase/migrations/0001_init.sql` with tables, RLS, and
  RPCs. It has not been run against a real Supabase project yet.

The auth screens, dashboards, and service worker are not built yet.

## Stack

| Layer      | Choice                                        |
| ---------- | --------------------------------------------- |
| Framework  | Next.js 15 (App Router), React 19             |
| Language   | TypeScript, strict mode                       |
| Styling    | Tailwind CSS                                  |
| Backend    | Supabase (Postgres, Auth, RLS)                |
| Validation | Zod                                           |
| Offline    | IndexedDB (`idb`) + service worker (planned)  |
| Crypto     | Web Crypto ECDSA P-256 device keys            |
| Tests      | Vitest (planned)                              |

## Layout

```
app/
  page.tsx                 landing page
  api/sync/route.ts        verify signatures, call ingest_* with service role
lib/
  code.ts                  6-digit code generator
  crypto/canonical.ts      canonical string shared by signer and verifier
  crypto/deviceKey.ts      generate non-extractable key, bind phone, sign
  offline/db.ts            IndexedDB schema and wrapper
  offline/outbox.ts        enqueue submissions and sessions
  offline/sync.ts          batch sync, retry, status refresh
  supabase/client.ts       browser Supabase client
supabase/
  migrations/0001_init.sql tables, RLS policies, verification, RPCs
docs/
  flows/                   lecturer and student screen flows
  offline-queue.md         earlier queue sketch
  archive/                 superseded database sketch
```

## Data model

The migration is the source of truth. Summary:

- `profiles` — one row per auth user, with role and approval state.
- `courses`, `course_lecturers`, `enrollments` — academic structure. Enrollments
  are keyed by matric number so a lecturer can upload a roster before students
  sign up.
- `devices` — one active device per user, storing the ECDSA public key (JWK).
- `sessions` — created on the lecturer's phone with a client-generated id, code,
  and time window.
- `submissions` — created on student phones with a client-generated id. The id
  is the idempotency key. A unique index on `(student_id, session_id)` keeps one
  record per student per session.

## Sync path

1. The phone writes a submission or session to IndexedDB first.
2. `lib/offline/sync.ts` batches queued items and POSTs them to `/api/sync` with
   the Supabase access token.
3. `app/api/sync/route.ts` validates the body with Zod, gets the user from the
   token, loads the user's active device, and verifies the ECDSA signature over
   the canonical string.
4. The route calls `ingest_submissions` or `ingest_sessions` with the service
   role key. Student and device ids come from the token and device lookup, never
   from the request body.
5. Verification (code, time window, roster, location, duplicates, expiry) runs
   in SQL. A submission with no matching session stays `pending`.
6. The client stores each result and retries only transient failures.

## RLS rules

- Clients cannot insert or update `submissions` or `sessions`; there are no write
  policies, and write privileges are revoked as a second layer.
- Students cannot read `sessions`, because the code lives there. Students get
  their percentages from the `my_attendance()` function.
- Lecturers see only data for courses they teach, and only when `approved = true`.
- Signup can claim `student` or `lecturer` only. Lecturers start unapproved.
  Admins are created by hand.

## Verification rules

For each pending submission, the server checks:

1. A session with the same course and code whose window contains `client_ts`
   (with a few minutes of slack).
2. The student is on the class list.
3. The submission arrived within 48 hours of `client_ts`.
4. Location distance from the session, if both sides have coordinates. Far
   submissions are flagged, not rejected.
5. Duplicates are rejected.

## Supabase setup

- Keep refresh token rotation on and do not set a session time limit, so the app
  stays logged in.
- Start the pilot with email confirmation off; turn it on before rollout.
- Put `SUPABASE_SERVICE_ROLE_KEY` in server-only env vars. Never prefix it with
  `NEXT_PUBLIC_`.
- Enable `pg_cron` and schedule the commented `sweep_pending` job.
- Apply `supabase/migrations/0001_init.sql` to a fresh dev project first.

## Known gaps

- **Matric number squatting.** Anyone can sign up with someone else's matric
  number. Handle disputes by hand in the pilot; later tie signup to a one-time
  PIN on the class list or a school-email check.
- **Clock mismatch.** A phone clock far off will miss the session window.
  Prompt students to enable automatic time.
- **Rebind abuse.** A student could repeatedly ask for a new phone. Lecturer
  approval on each rebind is the control.
- **Rate limiting.** `/api/sync` has no rate limit yet.
- **Tests.** No test runner is configured yet.

## Open questions

- How to reduce proxy attendance beyond time-boxed codes: rotating codes, device
  binding, optional location checks.
- Whether a USSD or SMS fallback is needed for phones without a browser.
- How universities and departments are onboarded in the first release.
