import { test, expect } from "@playwright/test";

/**
 * Gated end-to-end tests: run only when the env vars are set. See
 * playwright.config.ts for the full instructions.
 *
 * The reason they are gated, and not part of `npm test`, is the same reason
 * the RLS integration test is not part of the unit suite: a test browser
 * cannot use a scripted fake because a scripted fake would not prove
 * anything about the real cookie/session/data path. These tests exercise the
 * real thing, so they need a real thing to exercise.
 */

const E2E_ENABLED = Boolean(
  process.env.AGAIN_E2E_URL &&
    process.env.AGAIN_E2E_SUPABASE_URL &&
    process.env.AGAIN_E2E_ANON_KEY &&
    process.env.AGAIN_E2E_EMAIL &&
    process.env.AGAIN_E2E_EMAIL_PASSWORD,
);

const describeE2E = E2E_ENABLED ? test.describe : test.describe.skip;

describeE2E("public pages render", () => {
  test("the root page renders the brand", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Again", { exact: false }).first()).toBeVisible();
  });

  test("visiting /app while signed out redirects to /login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });
});

describeE2E("sign-in flow", () => {
  test("signs in and out through the real form", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.AGAIN_E2E_EMAIL!);
    await page.getByLabel("Password").fill(process.env.AGAIN_E2E_EMAIL_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Landed inside the app.
    await expect(page).toHaveURL(/\/app([\/?#]|$)/);
    await expect(
      page.getByRole("heading", { name: /Keep showing up/i }),
    ).toBeVisible();

    // The export endpoint is reachable and returns the user's own JSON.
    const exportResponse = await page.request.get("/api/export");
    expect(exportResponse.ok()).toBe(true);
    const archive = await exportResponse.json();
    expect(typeof archive.user_id).toBe("string");
    expect(Array.isArray(archive.logs)).toBe(true);

    // Sign out and confirm the app is no longer reachable.
    await page.getByRole("button", { name: /Sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    const afterSignOut = await page.request.get("/app");
    expect(afterSignOut.url()).toMatch(/\/login/);
  });
});
