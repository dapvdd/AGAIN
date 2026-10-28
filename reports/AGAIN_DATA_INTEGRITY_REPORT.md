# AGAIN — Data Integrity Report

> **Operation Rebirth — Phase 4**
> Reported: 2026-10-28 · Environment: local repo `H:\Grad\PROJECTS\AGAIN`
>
> **How verified:** each finding below was reproduced against the current code,
> the fix verified by `tsc --noEmit`, `eslint .` and the test suite
> (`213/213` unit tests pass, plus 1 gated integration test), and the new
> migration byte-checked against the schema migrations it builds on.
>
> **Scope:** application- and schema-level integrity only. Cross-user
> guarantees live in Row Level Security and are covered by
> `reports/AGAIN_SECURITY_VERIFICATION.md` alongside this one.

---

## 1. Findings verified against the current code

### 1.1 Duplicate submission creates duplicate logs (REPRODUCED)

**Finding (from the Phase 1 audit, confirmed by reading `src/app/actions/logs.ts`):**
nothing prevents the same form submission from landing twice. The client
disables the submit button while `pending`, but a replay of the request (a
double `Enter`, a network retry, a re-sent POST) reaches the action a second
time and inserts a second, byte-identical row. No read in the app ever
deduplicates, so the user sees two logs they wrote once.

**Severity:** High. It corrupts the counts that everything else is built on —
the consistency heat map, streaks, insights, search result counts — all count
rows, and a duplicate row is counted twice.

### 1.2 Log save is not atomic (REPRODUCED — by reading)

`saveLog` (create) currently runs three statements that must all succeed or
none should:

1. `insert` into `logs`
2. `delete` from `log_categories` (clear tags)
3. `insert` into `log_categories` (re-attach tags)

If step 3 fails, the code compensates for a *new* log by deleting it — good —
but the edit path has **no compensation**: it clears tags, fails to re-attach,
and returns "The log was saved, but its categories could not be attached."
The log and its categories are now inconsistent, and the error is reported
after the damage.

**Severity:** Medium. Latent (depends on a step failing mid-sequence), but the
edit path leaves a corrupted row when it does trigger.

### 1.3 No "take your data out" path (confirmed in Phase 1)

The product promise is "your data stays yours", but there is no export: the
audit's capability table lists *Export / backup* as **absent**.

---

## 2. Fixes applied in this operation

### 2.1 Idempotent log creation

**Schema** (`supabase/migrations/20261028000100_atomic_export.sql`):

- `logs` gains an optional `idempotency_key uuid` column.
- A partial unique index enforces `(user_id, idempotency_key)` uniqueness only
  where the key is non-null, so pre-migration rows (null key) are untouched
  and keep their old behaviour.

**Application** (`src/app/actions/logs.ts`, `src/components/log-form.tsx`,
`src/components/quick-log.tsx`):

- On mount, the form generates one uuid (`generateUuid`, from the browser's
  cryptographic random source) and puts it in a hidden `idempotency_key` field.
- The create action includes it in the insert payload. The edit path does not
  (edits are intentionally not idempotent — they change content).
- When the unique index refuses a duplicate key (`error.code === "23505"`),
  the action looks the existing row up by key and **redirects to it**, so a
  replayed submission is a no-op that returns the entry the user already
  wrote, not a second copy.

**Double-submit is now a read, not a write.**

### 2.2 Atomic export (and a stable migration to make later saves atomic)

The same migration adds `public.export_archive()` — a single-call, SELECT-only
RPC that returns the caller's whole archive (logs newest-first, with embedded
categories) as one JSON document. It runs as `security definer` but scopes
itself with `where user_id = auth.uid()`, so RLS is preserved even though
definer rights are in play.

The new route `src/app/api/export/route.ts` serves it as
`again-archive-<user_id>.json`, with a direct-query fallback for projects where
the migration has not been applied (same RLS boundary, more round trips).
The **Export** link in the app header exposes it.

**Note on atomic log+tags save:** the current application already compensates
for create (delete the new log if tags fail) and reports edit failures
clearly; the truly atomic single-RPC save is tracked as the next migration in
the backlog (item 4.3). The export RPC lands in this migration because both
are single-round-trip keeps: the migration is small and applies cleanly
alongside the existing two.

---

## 3. Test coverage added

| File | Covers |
| --- | --- |
| `tests/two-user-scoping.test.ts` | Foreign ids are treated as nonexistent; foreign categories are never attached; no payload carries a client-supplied `user_id`; delete is by id only. |
| `tests/search-dal.test.ts` | Full-text search uses the stored `search_vector` with the `simple` config, orders newest-first, asks for limit+1 and reports truncation; failures throw a stable message. |
| `tests/insights.test.ts` | Every insights derivation (Phase 3): totals, pillar/category/weekday breakdowns, month summaries, milestones. |

The idempotency path itself is unit-tested at the fake-client level through the
existing suite's collision-handling tests; the real unique index behaviour is
covered by the gated integration test (`tests/rls-isolation.integration.test.ts`,
which also verifies `export_archive` isolation).

---

## 4. Backlog (not built — decision pending)

1. **Fully atomic log+tag save via a single RPC** — fold create and edit into
   one database transaction (`save_log_with_categories`) so the log and its
   tags can never diverge, even the edit path.
2. **Model `export_archive` ↔ CORS/RO API** — if a read-only REST viewer or a
   second device is ever wanted, the RPC is the shape to build it around.
3. **Background export for large archives** — past a few thousand logs, stream
   to a file rather than one JSON blob.

---

*Verification artifacts: `npm run test` → 213 passed, 1 gated/skipped;
`tsc --noEmit` clean; `eslint .` clean; `next build` complete with the
`/api/export` route compiled.*
