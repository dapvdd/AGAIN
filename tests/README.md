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
