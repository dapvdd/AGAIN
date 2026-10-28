# AGAIN — Product Audit

> **Operation Rebirth — Phase 1**
> Audited: 2026-10-28 · Environment: local repo `H:\Grad\PROJECTS\AGAIN` (@ `a82cbfa`), working tree clean, branch `master` (13 commits ahead of `origin`).
>
> **How verified:** every file in `src/` and `supabase/` read in full; test suite executed (`171/171` pass); `tsc --noEmit` clean; `eslint .` clean; `next build` succeeds with all 12 routes; remote server (`david-lab`) checked for an AGAIN deployment — none exists, so nothing on this repo is deployed anywhere yet.

---

## 1. What the application is today

AGAIN is a deliberately minimal, privacy-first **personal life log** — an archive of dated entries ("logs"), each optionally filed under one of seven fixed pillars (GYM, BUILD, STUDY, PRAY, REFLECT, LOVE, FAMILY) and any number of user-owned tags ("categories").

| Capability | Status | Where |
| --- | --- | --- |
| Authentication (email+password) | ✅ Working | `src/app/(auth)/login`, `src/lib/supabase/*`, `src/proxy.ts` |
| Create / read / update / delete logs | ✅ Working | `src/app/actions/logs.ts`, `src/lib/logs.ts` |
| Pillar filter on the log list | ✅ Working | `/app?pillar=…` |
| Category management (create/rename/delete, usage counts) | ✅ Working | `src/app/actions/categories.ts`, `src/components/category-manager.tsx` |
| Inline category creation from the log form | ✅ Working | `src/app/actions/logs.ts → ensureCategory` |
| Month history calendar | ✅ Working | `/app/history?month=…&day=…` |
| Full-text search (`websearch_to_tsquery`, GIN index) | ✅ Working | `/app/search?q=…` |
| Consistency dashboard (26-week heat map, streaks) | ✅ Working | `/app/dashboard` |
| Archive (all logs list), loading/error/not-found states | ✅ Working | `/app`, `app/error.tsx`, `app/not-found.tsx` |
| Export / backup | ❌ **Absent** | — |
| **Personal insights** (beyond raw consistency numbers) | ❌ **Absent** | — |
| **Habit tracking** (per-pillar consistency, per-category) | ❌ **Absent** (dashboard is global-only) | — |
| **Timeline** (paginated / long-range view) | ❌ **Absent** (only 20 most recent logs) | — |
| **Onboarding** for a new user | ❌ **Absent** (empty states exist, but no first-run guidance) | — |
| **Mobile experience** | ⚠️ Basic (responsive CSS only; no mobile-first affordances, quick add, or bottom nav) | — |
| Browser / E2E tests | ❌ **Absent** | — |
| CI | ❌ **Absent** | — |

**Overall architecture verdict:** the code is unusually well-engineered for its stage — consistent patterns, honest comments, server-authoritative validation, RLS-first security, deterministic pure logic. The dominant weakness is **missing product surface**, not broken code. The dominant *risk* is **unverified database-level guarantees** (RLS, triggers, cascades) because there is no integration test environment and no live deployment to exercise them.

---

## 2. Broken flows

None found in code that fault **at runtime**, but four flows are incomplete or latent:

1. **Sign-up flow renders an uncaught error surface after confirmation.** When signup requires email confirmation, `login-form.tsx` sets `mode("signin")` + info message. Fine. But if the Supabase project has *automatic confirmation disabled*, the user never sees why `signInWithPassword` fails — acceptable. **Latent bug:** after successful signup with `autoConfirm` (session returned), `router.replace(redirectTo)` runs before Supabase has fully written the session cookies to the browser client — the `proxy.ts` guard may briefly redirect back to `/login`. This is the classic `@supabase/ssr` race. Not reproduced here (no live env), but flagged.

2. **`next` open-redirect is handled correctly, but only on the login page.** `redirectTo` is validated on `/login`. The auth callback (`src/app/auth/callback/route.ts`) reads `next` search param and redirects to `${origin}${next}` **without validating** that `next` is a local path. `exchangeCodeForSession` succeeds only for the requesting user, so the blast radius is a post-sign-in redirect; still, a malicious `next=https://evil` after a valid code would redirect off-host. **Fix applied in this operation (see Security report).**

3. **Search has no way to navigate past the 50 most recent matches** — by design ("bounded, not paged"), acceptable, but combined with no timeline this means an archive >~50 matches for a term is effectively capped. Documented as an intentional trade-off, not a defect.

4. **No duplicate-submission guard.** A double-click on "Save log" / "Create account" can submit twice. `pending` disables the button client-side, but the Server Action itself has no idempotency/key and a replayed POST (or a double `enter`) creates two identical logs. This is the clearest **data-integrity** gap in the current app and is addressed in Phase 4 (deliverable: `AGAIN_DATA_INTEGRITY_REPORT.md`).

Potential latent failure: **any DAL read failure throws a generic string and renders `app/error.tsx`** — correct behavior.

---

## 3. Incomplete functionality

| Gap | Detail |
| --- | --- |
| No quick logging | The **only** way to log is `/app/logs/new` → a full 6-section form. A mobile user cannot log in under 5 fields. Mission-critical: "record an activity quickly without navigating unnecessary screens." |
| No per-pillar / per-category consistency | The dashboard measures the **whole archive**. A user cannot see "how consistent has GYM been?" or "what did I tag 'Health'?"; those are the natural units of habit. |
| No habit/goal tracking | No notion of a repeatable habit to "keep" — the seven pillars are the closest thing and are not usable as targets. |
| No long-range trend | Nothing above 26 weeks. No monthly/yearly summaries, no milestones, no comparison across months beyond `thisMonth`/`lastMonth` counts. |
| No export | No way to take the archive out. Data ownership is the product's stated value ("your data stays yours") yet has no exit path — a real privacy gap. |
| No onboarding | A brand-new user lands on an empty "Logs" list with a single CTA. No explanation of pillars/categories/consistency. |
| No reflection prompts | The philosophy is "REFLECT" is a pillar, and the dashboard empty state says "Nothing to measure yet" — but there is no weekly/monthly reflection surface. |
| Categories are not browsable | Categories link nowhere. You can see usages but cannot click a category to see its logs. |
| `/app/logs/[id]` has no previous/next navigation within a day or list | Only "Back to logs" and "Edit". |
| No pagination on archive | `/app` shows the 20 most recent logs, forever. Long archives are only reachable by search or calendar. |

---

## 4. UI inconsistencies

1. **Duplicate `firstLine()` helper** in `src/app/app/page.tsx:158`, `history/page.tsx:313`, `search/page.tsx:143` — three copies of the same function. Should move to `src/lib/format.ts`.
2. **Duplicate `single()` searchParam helper** in `page.tsx:153` and `history/page.tsx:283` and inline in `search/page.tsx:24` and `new/page.tsx:18`. Should move to a shared util.
3. **The button/link text convention is consistent but the CTA class string is copy-pasted** in at least 6 places (`app-nav` none; `page.tsx:50`, `dashboard/page.tsx:58`, `log-form.tsx:232`, `category-manager.tsx:114/222`, `search/page.tsx:60`). No shared `Button`/`PrimaryLink` component → risk of drift, which has not happened yet.
4. **`intl` formatting is duplicated**: `formatLoggedOn` vs inline month labels; acceptable but `format.ts` could export `shortMonth` and a `formatCount` helper (used by history day counts, dashboard stat unit, search matches, category usage).
5. **Dark mode** is consistently handled (`dark:` throughout) — no gaps found. The one inconsistency: `history/page.tsx` weekday labels and the dashboard `Legend` differ in tone naming (`text-zinc-500` vs `text-zinc-400`) for the same semantic role.
6. **Heading pattern is consistent** (`p` eyebrow + `h1`) across all protected pages — good. Login page differs (`h1` only) — minor.

---

## 5. Navigation problems

1. **No "New log" action in the persistent nav.** The "Add log" button lives only on `/app`. From dashboard you get "Log today", from history you get "Log this day", but there is **no global quick-add** — the single most frequent action in the product has no persistent home.
2. **No active state for the add action** — ties to (1).
3. **`/app` is the only entry point for the whole archive**; from a log detail page you can only get "back to logs", not to history/dashboard — the nav header is always present so this is minor.
4. **Mobile nav wraps to two rows** above `sm` (5 links + wordmark + sign-out) — functional but not optimized; no bottom nav, no hamburger, no quick-add FAB. See UX report for the chosen treatment.

---

## 6. Data integrity risks

Full treatment in `AGAIN_DATA_INTEGRITY_REPORT.md`. Summary:

| Risk | Severity | Status |
| --- | --- | --- |
| Log edit → save is not atomic across `logs.update` + `log_categories` delete/insert | Medium | **Present.** `saveLog` does delete-then-insert for tags; on tag-insert failure the log stays changed with old tags partially cleared. |
| Duplicate submissions (double submit / replay) | Medium | **Present.** No idempotency. |
| `user_id` untrusted by design (trigger overwrites) | — | ✅ Safe |
| Category names unique via unique index (no pre-check race) | — | ✅ Safe |
| RLS policies: **never tested against a real database** | **High (verification gap)** | ⏸️ Blocked locally (no Docker/Postgres/Supabase); documented matrix in `tests/README.md` |
| No export → single point of failure for data ownership | High (product risk) | ❌ Absent |

---

## 7. Slow queries

- The heaviest read, `getRecentLogs`, is bounded (20 rows) and rides `logs_user_logged_on_idx`. ✅
- `getLogDatesBetween` / `getLogDatesByMonth` ride the same index. ✅
- `searchLogs` uses GIN on the stored generated `search_vector`. ✅
- **One real inefficiency:** `getCategoryUsage` fetches **every** `log_categories` row for the caller (no bound) to count per category. For a large archive this is unbounded. It is called by `/app/categories` only; acceptable today, but should be a COUNT GROUP BY when the archive grows. Flagged as future work.
- `attachCategories` does 2 queries per set — bounded. ✅

---

## 8. Accessibility

The app is *better than average* by construction (all intentional). Verified gaps:

1. **`autoFocus` on the search box** (`search/page.tsx:56`) steals focus on every navigation to `/app/search` — including for keyboard/screen-reader users and on soft page loads; also scrolls the page on mobile. Recommend removing or gating.
2. **Pillar/category pills** (`log-form.tsx:110-158`) use `<label>` wrapping a hidden radio/checkbox — semantically correct, no `aria-pressed` needed. ✅ Good pattern. But the **`None` pillar radio + category checkboxes lack a visible selected hint for color-blind users** beyond the border color change (`peer-checked:border-zinc-900`) — border-width/style help, acceptable.
3. **Heat map cells** (`dashboard/page.tsx:127-137`) are `<span title=…>` inside a single `role="img"` summary — the *only* accessible label is the aggregate summary. Individual cells are not keyboard-focusable or individually labeled. Acceptable as a data-viz (summary provided), documented.
4. **`DeleteLog` and category delete** use inline confirm, buttons have text. ✅
5. **`CategoryManager` rename input `autoFocus`** (`category-manager.tsx:214`) — fine (intentional, same-line context).
6. **Focus ring** uses `focus-visible` with offset. ✅
7. **`prefers-reduced-motion`** honored globally. ✅
8. **Missing `aria-live`** for action success/error regions (login error, form errors are inline — inline errors under inputs are already conveyed on focus; the login page message is not polite-live. Minor.)
9. **`lang="en"` set. `sr-only` labels on search + inputs used.** ✅
10. **Color-only differences** in heat-map legend are accompanied by a text measure (`title` per cell has counts) — mitigated, but the `title` is hover-only (not touch). **Mobile users cannot read heat-map cell counts** (no tap affordance). Flagged for UX phase.
11. **No automated aXe / eslint-jsx-a11y coverage** — no tooling enforces the good practice. Phase 6 adds this.

---

## 9. Privacy posture

- **Data isolation is RLS-only and ownership trigger-assigned** — the correct Supabase model. Never uses service-role key. ✅
- **No analytics/tracking scripts, no third-party front-end JS** beyond Supabase/Next. ✅
- **No export** — the privacy promise ("your data stays yours") lacks a take-out path. ❌ (Phase 4/UX adds export.)
- **Emails stored in plain profile column** (user's own email; no MDN/PII policy burden here). Fine for a personal tool.
- **No audit of mutations** — cannot see "who changed what when". Low priority for single-user; not required.
- **Search/URLs** never contain PII beyond the user's own query in their own URL. ✅

---

## 10. Missing tests

Full matrix in `AGAIN_SECURITY_VERIFICATION.md` and the test tiers in `tests/README.md`. Summary:

| Layer | Status |
| --- | --- |
| Pure-logic unit tests (calendar, consistency, input rules, search) | ✅ 171 tests, meaningful |
| Server Action behavior with scripted client (`actions-security`, `dal-scoping`) | ✅ Meaningful regression tests |
| **RLS / cross-user isolation against a real DB** | ❌ Blocked (no runtime) — matrix written, unexecuted |
| **Auth flows** (signup/signin/signout/callback/proxy) | ❌ Untested |
| **Search DAL** (`textSearch`) | ❌ Untested (mock lacks `textSearch`) |
| **Browser E2E** | ❌ No Playwright |
| **Accessibility checks** | ❌ None + no tooling |
| **Export** | ❌ Feature absent, nothing to test |
| **New insights logic** | ❌ Feature absent |
| **Database migration verification** | ❌ No CI, no `supabase db` to run against |

---

## 11. Priority-ranked improvement plan (from this audit)

**Tier 1 — Product surface (the mission's core):**
1. **Quick logging** — one-step capture from anywhere (fast path). *UX report.*
2. **Per-pillar habit consistency + a real personal dashboard** with explainable insights from actual data. *UX report.*
3. **Mobile pass** — quick-add presence, touch-friendly heat map, tap targets. *UX report.*

**Tier 2 — Data/security correctness (hard guarantees):**
4. **Make log-save atomic** at the database layer (single RPC), add idempotency on create. *Data-integrity report.*
5. **Two-user isolation integration tests** with a disposable database + CI hedge for when a runtime exists; plus a **scripted two-user browser-level harness** that works today. *Security report.*
6. **Export** (JSON/CSV download) so the archive can be taken out and backed up. *UX + docs.*

**Tier 3 — Quality (mission Phase 6):**
7. **E2E (Playwright) + `eslint-plugin-jsx-a11y` + search DAL tests**; wire CI.
8. Document export/recovery; add data-integrity and security verification reports.

The remainder of this operation implements Tiers 1–3 against **development data only**, with no changes to production Supabase policies/schema without approval.
