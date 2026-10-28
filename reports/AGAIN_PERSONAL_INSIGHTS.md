# AGAIN — Personal Insights Report

> **Operation Rebirth — Phase 3**
> Reported: 2026-10-28 · Environment: local repo `H:\Grad\PROJECTS\AGAIN`
>
> **Decision honored:** "Full explainability" was selected for the insights
> surface. That decision is the contract this report documents and the code
> enforces: **every number the page draws is a pure function of the user's own
> logged records, and nothing is inferred, guessed, or extrapolated.**
>
> **How verified:** `tests/insights.test.ts` (16 tests) covers every derivation;
> `tsc --noEmit`, `eslint .` clean; `next build` compiles `/app/insights`.

---

## 1. The design contract (written into `src/lib/insights.ts`)

The insights module opens with guardrails that are the point, not ceremony:

1. **No manipulative streak mechanics.** Streaks exist, but they are shown as
   measurements with their date ranges, never "don't break the chain" guilt.
   Days are compared, not judged.
2. **No guilt-based messaging.** An empty day is not a failure. There are no red
   marks, no "you missed X days", no shame.
3. **No unsupported psychological interpretation.** We count what the user wrote;
   we never psychoanalyze the words. No sentiment analysis, no personality
   claims, no "you seem down" guesses.
4. **Everything is explainable.** Each insight block lists the source window
   (the specific dates) it was computed from.

## 2. What the page shows

| Section | Derivation | Explainability |
| --- | --- | --- |
| **Totals** | entries, days logged, entries/day, first/last log, span | each number is a count from rows the user wrote |
| **Pillars** | per-pillar entries, days logged, days-since-window consistency | a pillar with zero entries is reported as 0 — never invented, never punished |
| **Weekday pattern** | real weekdays with entries (Mon-Sun) | only data the user actually wrote |
| **Categories** | most-used tags with entry and day counts | only the caller's own categories |
| **Months** | entry/days per month + delta vs previous | oldest first, change from predecessor |
| **Milestones** | first entry, every hundredth entry, a full written week | each links to the log that earned it |

The window is **12 whole weeks** (`insightWindow`) ending in today's week —
deterministic per user and per day, and stated in the page so "what am I being
shown?" has one answer.

## 3. Honesty where it matters

- **Denominator disclosure.** Pillar consistency is *days written / days in the
  window*, and the report says so. A 0.5 for GYM means "present half the days",
  which is a fact about the records, not a verdict.
- **No invented targets.** There is no goal-setting, no "optimal" weekday, no
  comparison to other users. The seven pillars are fixed reference data; a
  pillar never gets a synthetic name.
- **Data-time boundaries.** Insights use the user's own calendar day
  (`logged_on`), never the server timestamp, matching the rest of the app.

## 4. Test coverage (`tests/insights.test.ts`)

- window computation (incl. week boundaries and `null` on malformed input);
- totals incl. span/first/last across all-time vs window;
- pillar breakdown: zero-entry pillars, consistency math, day dedupe;
- category breakdown: ordering, day dedupe, window filtering;
- weekday breakdown: distribution, Monday-Sunday indexing, de-duplication;
- milestone loop emits **all** hundreds (fixed in this operation), the full-week
  milestone, and empty-archive safety;
- month summaries: ordering, deltas, and the first-month edge.

## 5. How to read it (given to the user, not the other way round)

Every block on the page is a *selection* of the user's own archive, and the page
links to history/search to prove it. If a number surprises someone, the answer is
one click away in the logs it was counted from.

---

*Artifacts: `src/lib/insights.ts` (pure module), `src/app/app/insights/*`, nav +
`reports/AGAIN_UX_IMPROVEMENTS.md`. Verification: 213 unit tests pass (16 are
insights), tsc/eslint clean, build compiles the insights route.*
