> Earlier sketch. The final design uses ECDSA device keys and the
> `ingest_submissions` / `ingest_sessions` RPCs. See
> [`architecture.md`](architecture.md) and
> [`../supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).

# Database model (Supabase / Postgres)

One catch shapes the whole design. Offline, the student's phone never knows which session it's submitting to. It only knows the course and the code they typed. So the server has to match submissions to sessions later, using **course + code + time window**.

```sql
-- people
create table profiles (
  id uuid primary key references auth.users,
  role text not null check (role in ('student','lecturer','admin')),
  full_name text not null,
  matric_no text unique,          -- students
  staff_no text unique            -- lecturers
);

-- academic structure
create table courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,             -- 'CSC 301'
  title text,
  semester text not null          -- '2026/2027-1'
);

create table course_lecturers (
  course_id uuid references courses,
  lecturer_id uuid references profiles,
  primary key (course_id, lecturer_id)
);

create table enrollments (
  course_id uuid references courses,
  student_id uuid references profiles,
  primary key (course_id, student_id)
);

-- one active phone per student
create table devices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles,
  device_hash text not null,
  bound_at timestamptz default now(),
  revoked_at timestamptz
);
create unique index one_active_device
  on devices (student_id) where revoked_at is null;

-- created by the lecturer's phone (ID generated client-side, offline)
create table sessions (
  id uuid primary key,            -- client-generated
  course_id uuid not null references courses,
  lecturer_id uuid not null references profiles,
  code char(6) not null,
  opened_at timestamptz not null, -- lecturer's clock
  closed_at timestamptz,
  lat double precision, lng double precision,
  received_at timestamptz default now()   -- server clock
);

-- created by student phones (ID generated client-side, offline)
create table submissions (
  id uuid primary key,            -- client-generated = idempotency key
  student_id uuid not null references profiles,
  course_id uuid not null references courses,
  device_hash text not null,
  code_entered char(6) not null,
  client_ts timestamptz not null,
  lat double precision, lng double precision, accuracy_m real,
  received_at timestamptz default now(),
  status text not null default 'pending'
    check (status in ('pending','verified','flagged','rejected','expired')),
  flag_reason text,
  session_id uuid references sessions   -- filled in by verification
);
create unique index one_per_session
  on submissions (student_id, session_id) where session_id is not null;
```

**Verification** is a `security definer` function. It runs when a submission arrives and again when a session arrives, since either can come first. For each pending submission it:
1. Finds a session with the same `course_id` and `code` whose window contains `client_ts` (with a few minutes of slack).
2. Checks the student is enrolled.
3. Checks `device_hash` matches their active device.
4. Compares distance to the session's lat/lng, and flags rather than rejects when it's far.
5. Checks `received_at - client_ts` is under 48 hours, otherwise `expired`.
6. Sets `verified`, `flagged`, or `rejected`, and sets `session_id`.

**RLS rules that matter:**
- Students can insert only their own submissions and read only their own rows.
- **Students must never be able to read `sessions`**, because `code` lives there. If they can, anyone can query the code and fake attendance. Lecturers read only sessions for their own courses.

An `attendance` view (verified submissions grouped by student and course, divided by session count) gives you the 75% number.

# Offline queue logic

**IndexedDB stores on the phone**
- `outbox`: submissions (student) and sessions (lecturer), each with `id`, `payload`, `state`, `attempts`, `lastError`
- `cache`: roster/courses, the device token, last sync time

**States:** `queued` → `sending` → `synced`, or `queued` again with retry on a network error. A server verdict of `rejected` or `expired` is final and never retried.

**1. Submit (offline-safe, no network call)**
```ts
async function submitCode(courseId: string, code: string) {
  const pos = await getPositionOrNull();          // GPS works offline, may be null
  const record = {
    id: crypto.randomUUID(),                      // idempotency key
    courseId, codeEntered: code,
    deviceHash: await getDeviceHash(),
    clientTs: new Date().toISOString(),
    lat: pos?.lat, lng: pos?.lng, accuracy: pos?.acc,
  };
  await db.put('outbox', { id: record.id, kind: 'submission',
    payload: record, state: 'queued', attempts: 0 });
  trySync();                                      // fire and forget
  return record.id;                               // show as receipt number
}
```

**2. Sync (safe to run any time, any number of times)**
```ts
let syncing = false;
async function trySync() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const items = await db.getAllFromIndex('outbox', 'state', 'queued');
    for (const batch of chunk(items, 20)) {
      const { data, error } = await supabase.rpc('upsert_submissions',
        { items: batch.map(i => i.payload) });
      if (error) { await markRetry(batch, error); break; }   // stop, back off
      for (const r of data) await markResult(r.id, r.status); // synced/rejected
    }
  } finally { syncing = false; }
}
```
`upsert_submissions` does `insert ... on conflict (id) do nothing`, so a retry after a dropped connection can't create duplicates. If the phone sent the data but lost the response, the next retry is harmless.

**3. When sync fires**
- On app open and on `visibilitychange` (the main trigger, and the only one that works on iPhone)
- On the `online` event
- Right after each submit
- Android Chrome only: a Background Sync registration as a bonus
- Backoff after failures: 30s, 2m, 10m, capped. Never hammer a weak 2G connection.

**4. Making it hard to lose data**
- Call `navigator.storage.persist()` on first run so the browser is less likely to evict the queue.
- On iPhone, show a one-time "Add to Home Screen" prompt, since an installed PWA isn't subject to the 7-day wipe.
- Always show a banner: "2 submissions pending, open with data to sync". A pending item is never silent.
- After sync, fetch final statuses and update the receipt (Pending → Verified / Flagged).

**5. The lecturer's phone uses the same queue**
Session create and close are queued the same way. The dashboard shows "Not synced yet" until the session lands on the server, then triggers the matching of waiting submissions. Remind the lecturer to sync before leaving the hall area.

**Edge cases to handle**
- Student submits twice: the unique index on `(student_id, session_id)` keeps one.
- Same code reused across two sessions of the same course: matching on the time window resolves it. Make the app avoid generating a code the lecturer used for that course in the last 24 hours.
- Wrong phone clock: compare `client_ts` against `received_at` and flag big gaps.
- Typo in the code: the app should accept it locally (it can't verify), so tell the student "can't be confirmed until sync, double-check the board".

Do you want to go on to the lecturer-side screens and flow next, or turn this into the actual Supabase migration and the Next.js PWA setup (service worker and IndexedDB wrapper)?
