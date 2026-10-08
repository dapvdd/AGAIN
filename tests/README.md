# Tests

`npm test` runs the suite (`vitest run`). The stack is deliberately minimal:
**Vitest only** — no DOM, no component rendering, no browser, no test
database. See `vitest.config.mts` for the two aliases it needs (`@` and
`server-only`).

## What the suite covers, and what it does not

There are three tiers, and only the first two are automated here.

**1. Pure logic (unit tests, no I/O).**
`log-input.test.ts`, `calendar.test.ts`, `consistency.test.ts`,
`input-rules.test.ts`. These modules are dependency-free by design, so the
tests assert behaviour directly: date and uuid validation, title/body bounds,
pillar and category rules, search normalisation, calendar arithmetic and grid
generation, streak/consistency maths, month boundaries and leap years.

**2. Application behaviour around the database (unit tests, scripted client).**
`actions-security.test.ts`, `dal-scoping.test.ts`. A scripted Supabase client
(`support/fake-supabase.ts`) records every statement the application builds
and answers with whatever the test scripted. These prove:

- every Server Action checks the session before it touches a row;
- no statement the application sends carries a client-supplied `user_id`;
- malformed ids are refused before any round trip;
- an id that resolves to no row is reported as *not found*, never as a
  successful write;
- categories are proved to be the caller's before they are attached;
- retagging is delete-then-insert, and a new log is removed again when its
  categories cannot be attached;
- the read path filters by pillar and refuses days/ranges it cannot read.

**3. Not automated here (database-owned and environment-owned properties).**

- **Row Level Security.** The empty results in tier 2 are *scripted*; they
  exercise the application's reaction to a filtered result, never the
  filtering. Whether PostgreSQL hides another user's row is decided by the
  policies in `supabase/migrations` and by the `set_user_id` trigger, and is
  still covered only by the live, manual security verification. No test in
  this repository should ever be described as an RLS test.
- **Auth/JWT verification.** `auth.getUser()` is stubbed. Cookie parsing,
  token refresh and the proxy remain covered by running the app.
- **`ON DELETE CASCADE` in the database.** The application-level assumption
  (one delete on `logs`, no explicit join cleanup) is asserted; the cascade
  itself is PostgreSQL's.
- **Full-stack behaviour** (Server Actions over HTTP, revalidation in a real
  request, UI). Covered by the existing `lint` / `tsc` / `build` checks and
  by manual verification.

There is no integration environment for tier 3: no credentials, no service
role key and no test database are committed or invented for testing. If one
ever exists, tier 3 is where it belongs — not inside these unit tests.

## Integration tier — blocked, not implemented

There are **no integration tests in this repository, deliberately**. The
Phase 17 environment audit found no disposable database to run them against:

| capability | status |
| --- | --- |
| container runtime (docker / podman / nerdctl / colima) | missing |
| WSL 2 (Docker Desktop's requirement on Windows) | not installed |
| Supabase CLI, `supabase/config.toml` | missing |
| PostgreSQL server or client (`psql`, `pg_ctl`, `initdb`) | missing |
| listener on 5432 / 54321 / 8000 | none |
| Docker/Supabase config, `SUPABASE_ACCESS_TOKEN` | absent (`.env.local` unread, untouched) |

`supabase start` needs a container runtime, so the official disposable stack —
GoTrue, `auth.users`, `auth.uid()`, the `anon` and `authenticated` roles the
grants target — cannot be started here. Substituting a hand-written `auth`
schema, roles or `auth.uid()` would test the substitute rather than Supabase:
that is the mocked-RLS trap this repository refuses, so no such stand-in was
built and no test claims to cover RLS.

**To enable the tier later:** install Docker Desktop (WSL 2 backend) and the
Supabase CLI; `supabase start`, then `supabase db reset` so the two existing
migrations run **unchanged**; take the local API URL and anon key from
`supabase status`. Two test users sign up through local GoTrue and every
assertion runs with that user's own JWT — never with the service-role key,
which stays a setup/cleanup privilege, clearly separated from the assertions.

**Security matrix waiting to be executed** (derived from
`supabase/migrations/20260924000100_init.sql` and
`20260927000100_core_domain.sql`):

1. **profiles** — A reads/updates own row; A cannot read B's; same for B.
2. **logs** — own INSERT/SELECT/UPDATE/DELETE succeed; cross-user
   SELECT/UPDATE/DELETE affect zero rows (both directions).
3. **`set_user_id`** — a client-supplied `user_id` is overwritten by
   `auth.uid()` on `logs` and on `categories`.
4. **categories** — own CRUD; cross-user read/update/delete invisible;
   `categories_user_lower_name_key` keeps names unique per user,
   case-insensitively.
5. **log_categories** — both parents must belong to the caller: a user can
   attach neither a foreign category to their own log nor their own category
   to a foreign log; links are invisible across users; deleting a category
   removes its links and leaves the logs untouched.
6. **cascades** — deleting a log removes only its `log_categories` rows;
   deleting an `auth.users` row cascades to profiles, logs and categories.
7. **pillars** — `SELECT` for `authenticated`, denied for `anon`; no
   INSERT/UPDATE/DELETE path for anyone (no policy, no grant).
8. **privileges** — the migration's `revoke all ... from anon, authenticated`
   followed by its exact grants: anon holds no privilege on any domain table,
   authenticated holds only the intended operations.

Until such an environment exists, every guarantee above remains covered only
by the live, manual verification — and by nothing in this repository.
