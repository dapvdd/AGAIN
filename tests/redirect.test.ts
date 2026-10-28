/**
 * Unit tests for `safeNextPath` — the shared confinement of a user-supplied
 * `next` redirect target (used by the auth callback route and the login form).
 *
 * The whole point of this module is that a `next` that ships the user off this
 * origin is refused. Browsers normalize backslashes to slashes in URLs, so a
 * `\host` target is indistinguishable from `//host` — the classic open-redirect
 * bypass that a naive `startsWith("/")` check misses. The helper must reject
 * backslashes outright.
 */

import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/redirect";

describe("safeNextPath", () => {
  it("keeps a plain internal path", () => {
    expect(safeNextPath("/app/search")).toBe("/app/search");
    expect(safeNextPath("/app/logs/new")).toBe("/app/logs/new");
  });

  it("defaults to /app when absent or empty", () => {
    expect(safeNextPath(null)).toBe("/app");
    expect(safeNextPath(undefined)).toBe("/app");
    expect(safeNextPath("")).toBe("/app");
  });

  it("refuses protocol-relative (//) targets", () => {
    expect(safeNextPath("//evil.example")).toBe("/app");
  });

  it("refuses absolute http/https targets", () => {
    expect(safeNextPath("https://evil.example")).toBe("/app");
    expect(safeNextPath("http://evil.example/x")).toBe("/app");
  });

  it("refuses other schemes", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/app");
    expect(safeNextPath("data:text/html,x")).toBe("/app");
  });

  it("refuses a leading backslash (browser-normalized to //)", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/app");
    expect(safeNextPath("\\evil.example")).toBe("/app");
  });

  it("refuses non-slash starts", () => {
    expect(safeNextPath("app/search")).toBe("/app");
  });
});
