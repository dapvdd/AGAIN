import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests, gated behind explicit env vars — the same honesty
 * contract as `tests/rls-isolation.integration.test.ts`.
 *
 * Playwright needs a running app served against a real Supabase project:
 * it cannot (and must not) fake the session cookie, the token refresh, or
 * Row Level Security. So these tests are skipped unless all of the following
 * are set:
 *
 *   AGAIN_E2E_URL            - the running app, e.g. http://localhost:3000
 *   AGAIN_E2E_SUPABASE_URL   - the project URL
 *   AGAIN_E2E_ANON_KEY       - the project's anon key (what the browser uses)
 *   AGAIN_E2E_EMAIL_PASSWORD - a known-valid account for the sign-in flow
 *   AGAIN_E2E_EMAIL          - that account's email
 *
 * Typical run:
 *   1. Create a disposable Supabase project (or use dev).
 *   2. Apply the migrations, run `next start` against it.
 *   3. Set the five vars above and run `npx playwright test`.
 *
 * Every test signs in and out through the real login form, so the session
 * lifecycle is exercised for real.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.AGAIN_E2E_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
