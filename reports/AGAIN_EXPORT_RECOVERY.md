# AGAIN — Export & Recovery Guide

> Documented 2026-10-28. This is the *take your data out* path and the
> *get your data back* path. Both are documented here so that the app's
> privacy promise ("your data stays yours") has a concrete, repeatable shape.

---

## 1. In-app export (any user, in the browser)

The header of the logged-in app carries **Export**. Clicking it downloads
`again-archive-<user_id>.json`:

- The JSON is a **complete snapshot** of the caller's archive:
  `exported_at`, `user_id`, and `logs[]` — each log with `id`, `logged_on`,
  `pillar`, `title`, `body`, `created_at`, `updated_at`, and its `categories`
  (`id`, `name`) embedded.
- It is served by `GET /api/export`, which calls the `export_archive()` RPC
  when the migration is applied, falling back to an equivalent direct query.
- **Privacy:** Row Level Security restricts the query to the caller's own rows.
  The RPC additionally scopes by `auth.uid()`. A foreign user's records never
  appear, and an unauthenticated visitor is redirected to `/login`.

Exported JSON is suitable for:
- personal archival (store it anywhere you trust);
- re-import into a fresh AGAIN project (see §3);
- a machine-readable derivative (a dashboard, a yearly review).

## 2. Manual backup (admin / self-hosted)

The same archive can be produced straight from SQL as a backup:

```sql
-- As a normal user (respects RLS):
select export_archive();

-- As an admin (bypasses RLS — use only on a full backup of a project you own):
select jsonb_build_object(
  'logs', coalesce(jsonb_agg(l order by l.logged_on desc, l.created_at desc), '[]'::jsonb)
)
from public.logs l;
```

For a **full database dump** (the safest recovery artifact), use the project's
native tooling:

```bash
# Hosted/Supabase CLI projects
supabase db dump --schema public > again-public.sql
pg_dump "postgresql://<url>" -f again-full.sql
```

## 3. Recovering / restoring into a new project

1. Create a fresh Supabase project (or a local one) — **dev only**, never point
   this at production data you did not approve touching.
2. Apply the migrations in this repo **in order**:
   - `supabase/migrations/20260924000100_init.sql`
   - `supabase/migrations/20260927000100_core_domain.sql`
   - `supabase/migrations/20261028000100_atomic_export.sql`
   Only the new `atomic_export` migration is additive; the first two are the
   original schema and must be applied before anything else.
3. Restore the JSON from §1 to the same user's archive (import script TBD —
   see §4). Each log's `id` can be reused; category ids must map to the target
   user's categories, or the links are dropped.

## 4. Roadmap / known gaps

- **Re-import script:** not built in this operation. The export format is
  stable and documented, and §3 describes the manual path; an `import_archive`
  RPC (idempotent by `idempotency_key`) is the natural next migration.
- **CSV**: the JSON export is the canonical format; CSV is a one-line
  projection if ever wanted (columns `logged_on,pillar,title,body,categories`).

## 5. Integration test contract

Both `tests/rls-isolation.integration.test.ts` and the Playwright smoke suite
verify the export end-to-end **the day a disposable project exists**:

- the RLS integration test asserts B's `export_archive()` contains only B's own
  log, proving a foreign user's data can never ride along;
- the Playwright smoke test signs in and asserts `/api/export` returns the
  signed-in user's own `user_id` and an array of logs.

Until then, the in-app export is covered by the unit suite at the
statement-building level (`tests/search-dal.test.ts` documents the RPC
fallback shape) and by code review.

---

*Deliverable: `src/app/api/export/route.ts`,
`supabase/migrations/20261028000100_atomic_export.sql` (export_archive RPC),
Export link in `src/app/app/layout.tsx`, and the Verification reports.*
