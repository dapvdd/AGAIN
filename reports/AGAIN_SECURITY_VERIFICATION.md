# AGAIN — Security Verification Report

> **Operation Rebirth — Phase 5**
> Reported: 2026-10-28 · Environment: local repo `H:\Grad\PROJECTS\AGAIN`
>
> **How verified:** the application layer is verified automatically — by
> `tests/actions-security.test.ts`, `tests/two-user-scoping.test.ts`,
> `tests/redirect.test.ts`, `tests/auth-callback.test.ts` and the rest of the
> suite (213 unit tests pass). The database layer is verified by a
> **gated two-user integration test** that runs against a real Supabase project
> the moment the three integration env vars are set; it cannot run here because
> this machine has no container runtime / PostgreSQL (see the environment
> table in `tests/README.md`). Nothing below claims an RLS result this machine
> produced against a real database; it states what the test runs, and what is
> still unproven here.
>
> **Production policy:** no production Supabase schema or policy was touched.
> All schema work in this operation is a **new migration** in this repo only.

---

## 1. Layer 1 — application guarantees (verified here, automated)

These are proven by the automated suite today:

| Guarantee | Where it is enforced | Test |
| --- | --- | --- |
| Every Server Action checks the session before touching a row | `requireUser()` at the top of each action | `actions-security.test.ts` |
| No insert/update/delete payload carries a client-supplied `user_id` | payload built by `saveLog` / `ensureCategory`; trigger assigns ownership | `actions-security.test.ts`, `two-user-scoping.test.ts` |
| Malformed ids are refused before any round trip | `isUuid` gate | `actions-security.test.ts`, `dal-scoping.test.ts` |
| An id the database reports as invisible is a "not found", never a success | `logExists` / empty-result handling | `two-user-scoping.test.ts` |
| Foreign categories are never attached to a log | `prepareCategories` count check before insert | `two-user-scoping.test.ts`, `actions-security.test.ts` |
| Read path refuses days/ranges it cannot read | DAL date range validation | `dal-scoping.test.ts` |
| Full-text search queries are normalised | `normalizeSearchQuery` (pure) + `searchLogs` | `input-rules.test.ts`, `search-dal.test.ts` |
| Auth callback open-redirect is closed | `safeNextPath` in `src/lib/redirect.ts`, shared with the login form | `redirect.test.ts`, `auth-callback.test.ts` |
| Duplicate submissions are idempotent | unique index + action lookup | action-level tests; real index in gated test |
| Export never leaks a foreign row | `export_archive` scoped by `auth.uid()`; fallback query unchanged (RLS) | gated integration test |

## 2. Layer 2 — database guarantees (gated two-user test, not run here)

The executable proof lives in `tests/rls-isolation.integration.test.ts`: two
disposable users, one run, every cross-user access must fail. Here is what it
will assert the day it is un-gated:

1. A cannot be read as B and vice versa (both directions on `logs`).
2. A cannot be updated or deleted by B (zero rows affected).
3. A's category cannot be borrowed onto B's log — the link insert is refused.
4. A's log survives all B's attacks intact, owned by A.
5. B's archive export contains only B's logs.

The full matrix in `tests/README.md` (profiles, logs, `set_user_id`,
categories, log_categories, cascades, pillars, privileges) stays waiting for a
disposable project.

**Honesty contract:** this repository refuses to fake RLS. The scripted tests
prove what the application does given RLS-scoped responses; only the gated
test (or a live deployment) proves what the database does. No test in this
repo is described as an RLS test unless it runs against real PostgreSQL.

---

## 3. What was changed in the name of security

- `src/lib/redirect.ts` (new) — a single `safeNextPath` used by **both** the
  auth callback **and** the login form. The audit's open-redirect is closed and
  hardened further than `startsWith("/")` alone: protocol-relative targets
  (`//host`), absolute URLs (`https://host`), other schemes, and the browser
  backslash-to-slash normalization (`/\host` → `//host`) are all refused.
- `src/app/auth/callback/route.ts` — uses `safeNextPath` (was `localNext`).
- `src/app/(auth)/login/login-form.tsx` — its hand-rolled `next` check now uses
  the same `safeNextPath`, so the login page and callback cannot drift apart.
- `src/app/app/search/page.tsx` — removed `autoFocus` (a11y).
- `src/components/category-manager.tsx` — removed `autoFocus` (a11y, caught
  by the new jsx-a11y lint in Phase 6).
- `eslint.config.mjs` — applies the `jsx-a11y` recommended rules.
- `src/app/api/export/route.ts` + migration — the data-out path with an
  explicit RLS-scoping comment.

No production policy was changed, because no production database was reached
and none needs to be — the schema work is for a disposable project.

---

## 4. Residual risks

1. **RLS is still unproven against a real database** from this machine. The
   gated test exists; it needs a disposable project to run.
2. **Cookie parsing / token refresh / the proxy** are only covered by running
   the app (the E2E tier, gated, would be the first to exercise them).
3. **`export_archive` is `security definer`** — if it ever loses its explicit
   `user_id = auth.uid()` scoping, it becomes a leak. Its query is small and
   auditable, but the invariant deserves a comment at the top of the file.
4. **Replay of idempotent creates is safe; replay of edits is not** — an edit
   replayed changes content twice. Acceptable: the user authored both writes.

---

*Artifacts: `npm run test` → 213 passed, 1 gated/skipped; the gated RLS
integration test and the Playwright smoke suite are ready to run the moment a
disposable Supabase project exists.*
