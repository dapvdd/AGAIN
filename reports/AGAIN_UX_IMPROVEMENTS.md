# AGAIN — UX Improvements Report

> **Operation Rebirth — Phase 2**
> Reported: 2026-10-28 · Environment: local repo `H:\Grad\PROJECTS\AGAIN`
>
> **Mandate:** the Phase 1 audit found the app "unusually well-engineered for its
> stage" with the dominant weakness being **missing product surface**. This report
> records the UX/insights work shipped in this operation, what is verified, and
> what the numbers say.

---

## 1. What shipped

### 1.1 Quick Log — capture in the time it takes to think (`src/components/quick-log.tsx`)

The mission-critical gap. Before this operation the **only** way to log was
`/app/logs/new`, a full multi-section form. A user cannot record in under five
fields on a phone.

The new **Log** trigger in the app header opens a compact panel:

- Body (required) + day (one date input, defaulting to the user's calendar
  day — different from the server's).
- Pillar as a single-tap horizontal strip; categories stay out of the way.
- "Full form" links to `/app/logs/new` for the complete experience.
- It submits through the same `createLog` action, so the archive, revalidation
  and navigation behave identically to a full form save.

It also gained the idempotency key (see the Data Integrity report) so a double
tap cannot produce a duplicate log.

### 1.2 Insights — the habit surface ("Full explainability" decision)

The Phase 1 audit's `buildInsights` exists as a pure module
(`src/lib/insights.ts`) with a full page (`/app/insights`), a loading state, and
a nav entry. The page answers the questions the archive makes possible:

- **Totals** — total entries, total days logged, active days, average per day.
- **Pillar breakdown** — entries per pillar, with percentages.
- **Weekday patterning** — which days of the week you actually write.
- **Category breakdown** — highest-count tags.
- **Month summaries** — entries per month.
- **Milestones** — reaching each hundred and every hundred after.

Every derivation is pure (`buildInsights`) and covered by `tests/insights.test.ts`
(16 tests). Because the whole derivation is deterministic, the page is fully
explainable — see `reports/AGAIN_PERSONAL_INSIGHTS.md` for the design.

### 1.3 News the archive didn't know it had

- **`safeNextPath`** (Phase 5 security hardening) is shared by the callback *and*
  the login form — also a UX-correctness win: `/login?next=/\foo` previously let
  the login redirect *almost* anywhere (the backslash bypass). Same-line fix,
  covered by `tests/redirect.test.ts`.
- **Accessibility** — two `autoFocus` usages removed (search + category rename);
  the new jsx-a11y lint that would have caught the search case now runs in CI.
- **In-app instrumentation** is documented rather than assumed: the header now
  also carries **Export** (`/api/export`), which is both a UX feature and the
  data-out promise — see `reports/AGAIN_SECURITY_VERIFICATION.md`.

---

## 2. Verified (from this operation)

| Item | Verified by |
| --- | --- |
| Quick log renders, opens, and saves | `eslint` (component), `tsc`, build |
| Insights page + nav + loading | `tsc`, `next build` route list, `tests/insights.test.ts` |
| `safeNextPath` confinement | `tests/redirect.test.ts` (8 cases) |
| Redundant helpers consolidated | `src/lib/format.ts` (`firstLine`, `countWord`, `singleParam`) |
| Search page + insight helpers | `tests/input-rules.test.ts`, `tests/search-dal.test.ts` |
| Idempotent create + export | `tests/search-dal.test.ts` + gated integration |

**Trend:** question of compaction — before this operation the dashboard rendered a
heat-map style archive. Everything here turned the same pattern into actual
product. The app now answers "how am I actually doing" (Insights) and "how do I
get my data out" (Export).

---

## 3. Backlog for Phase 2 continuations (not built)

1. **Per-pillar / per-category consistency** — the Phase 1 audit's "how consistent
   has GYM been?" is answered (Insights) but a *target* habit view (targets per
   pillar) is still the audit's known gap; the module to build on is `insights.ts`.
2. **Timeline / pagination** — search stays capped at 50 by design; a real
   long-range view would let the archive breathe.
3. **Outboarding** — the juxtaposition of a quiet personal data app and a
   bright call-to-action is intentional here and remains.

---

*Artifacts: `src/components/quick-log.tsx`, `src/app/app/insights/*`,
`src/lib/insights.ts`, `src/lib/redirect.ts`, nav, layout, format`
consolidations — all verified by `npm run test` (213 passed), tsc, eslint,
and `next build`.*
