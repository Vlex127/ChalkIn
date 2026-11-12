# ChalkIn

Offline attendance for Nigerian universities.

ChalkIn lets a lecturer start a class session, students check in from their
phones without a network, and the records sync automatically when a connection
returns. It is built for large classes and patchy data.

## Status

Early build. The landing page, offline core, sync route, and initial database
migration exist. Auth screens, dashboards, and the service worker are next. The
migration has not been run against a live Supabase project yet.

## Stack

- Next.js 15 (App Router) and React 19
- TypeScript in strict mode
- Tailwind CSS
- Supabase for Postgres, Auth, and row-level security
- Zod for request validation
- `idb` for the IndexedDB queue
- Web Crypto ECDSA P-256 device keys
- Vitest for tests (planned)

## Getting started

Requires Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## Scripts

```bash
pnpm dev     # local dev server
pnpm build   # production build
pnpm start   # run the production build
pnpm lint    # eslint
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values. `.env.local` is
git-ignored.

| Variable                        | Used by         | Notes                       |
| ------------------------------- | --------------- | --------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client + server | Supabase project URL        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Public anon key             |
| `SUPABASE_SERVICE_ROLE_KEY`     | server only     | Never expose to the browser |

`/api/sync` needs the service role key. It must never be prefixed with
`NEXT_PUBLIC_`.

## Project structure

```
app/                 routes, landing page, /api/sync route
components/          shared React components
lib/
  crypto/            canonical signing strings, device keys
  offline/           IndexedDB schema, outbox, sync engine
  supabase/          browser client
supabase/migrations/ database schema, RLS, and RPCs
docs/                architecture, flows, and notes
public/              static assets and web manifest
```

## Database setup

The migration lives at `supabase/migrations/0001_init.sql`. Apply it to a fresh
Supabase dev project before running the app:

```bash
supabase db push
```

Or paste it into the Supabase SQL editor. Enable `pg_cron` and schedule the
commented `sweep_pending` job. See [`docs/architecture.md`](docs/architecture.md)
for the RLS and verification rules.

## How sync works

1. A check-in or session is written to IndexedDB first.
2. `lib/offline/sync.ts` batches queued items and POSTs them to `/api/sync`.
3. The route verifies the device signature and calls the ingest RPCs with the
   service role key.
4. Verification (code, time window, roster, location, duplicates) runs in SQL.

## Testing

No test runner is configured yet. Vitest will be added with the first tests for
the canonical signing strings and the sync queue. Until then, run `pnpm build`
and `pnpm lint` before pushing.

## Roadmap

1. Landing page and project docs (done)
2. Offline core and `/api/sync` (done)
3. Supabase auth screens and role routing
4. PWA service worker and install prompt
5. Lecturer dashboard, roster upload, and reports
6. Vitest coverage for signing and sync logic

## Documentation

- [Architecture](docs/architecture.md)
- [Lecturer flow](docs/flows/lecturer.md)
- [Student flow](docs/flows/student.md)
- [Offline queue notes](docs/offline-queue.md)

## License

MIT. See [`LICENSE`](LICENSE).
