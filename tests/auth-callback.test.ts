/**
 * Tests for the auth callback's redirect handling.
 *
 * The callback exchanges an authorization code for a session and then redirects
 * to the `next` parameter. `next` is user-controlled, so it must be confined to
 * same-origin paths: an open redirect would let a link like
 * `/auth/callback?next=https://evil.example` ship the user off-host right
 * after their fresh session is minted. These tests pin the confinement to
 * local paths only.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/callback/route";
import {
  TEST_ENV,
  applyEnv,
} from "./support/fixtures";

const harness = vi.hoisted(() => ({
  exchange: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      exchangeCodeForSession: harness.exchange,
    },
  }),
}));

let restoreEnv: () => void = () => {};

beforeEach(() => {
  restoreEnv = applyEnv(TEST_ENV);
  harness.exchange.mockReset();
  harness.exchange.mockResolvedValue({ error: null });
});

afterEach(() => {
  restoreEnv();
  vi.clearAllMocks();
});

function callCallback(pathname: string): Promise<{
  status: number;
  location: string | null;
}> {
  return GET(new Request(`http://localhost${pathname}`) as never).then(
    (response) => ({
      status: response.status,
      location: response.headers.get("location"),
    }),
  );
}

describe("auth callback redirect confinement", () => {
  it.each([
    ["missing", "/auth/callback?code=abc", "/app"],
    ["a local path", "/auth/callback?code=abc&next=/app/search", "/app/search"],
    ["a nested local path", "/auth/callback?code=abc&next=/app/logs/new", "/app/logs/new"],
    ["a protocol-relative host", "/auth/callback?code=abc&next=//evil.example", "/app"],
    ["an absolute external url", "/auth/callback?code=abc&next=https://evil.example", "/app"],
    ["an encoded external url", "/auth/callback?code=abc&next=https%3A%2F%2Fevil.example", "/app"],
    ["a backslash trick", "/auth/callback?code=abc&next=/\\evil.example", "/app"],
  ])("confines %s to a local target", async (_label, pathname, expected) => {
    const response = await callCallback(pathname);
    expect(response.status).toBe(307);
    expect(response.location).toBe(`http://localhost${expected}`);
  });

  it("falls back to /login when no code is present", async () => {
    const response = await callCallback("/auth/callback?next=/app/search");
    expect(response.location).toBe("http://localhost/login");
  });
});
