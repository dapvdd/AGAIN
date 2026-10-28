/**
 * Tests for the search read path (`searchLogs`).
 *
 * They prove the query the application builds for full-text search: that it
 * rides the stored `search_vector` column with the same config the column was
 * generated with, that it asks for one row more than the limit so truncation
 * can be reported, and that the results are ordered newest-day-first. The
 * "no rows" cases are *scripted* stand-ins for what RLS would hide, exactly as
 * in the other DAL tests — nothing here pretends to test Row Level Security.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchLogs } from "@/lib/logs";
import {
  createFakeSupabase,
  responderFor,
  type FakeResponse,
  type FakeSupabase,
} from "./support/fake-supabase";
import {
  CATEGORY_A,
  CATEGORY_B,
  CURRENT_USER,
  LOG_ID,
} from "./support/fixtures";

const harness = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    if (harness.client === null) {
      throw new Error("A Supabase client was requested without a scripted fake.");
    }
    return harness.client;
  },
}));

let active: FakeSupabase | null = null;

function useFake(responses: Record<string, FakeResponse>): FakeSupabase {
  const fake = createFakeSupabase({ respond: responderFor(responses) });
  harness.client = fake.client;
  active = fake;
  return fake;
}

const LOG_ROW = {
  id: LOG_ID,
  user_id: CURRENT_USER.id,
  logged_on: "2026-06-15",
  pillar: "GYM",
  title: "Push day",
  body: "Bench 5x5.",
  created_at: "2026-06-15T09:00:00.000Z",
  updated_at: "2026-06-15T09:00:00.000Z",
};

beforeEach(() => {
  harness.client = null;
  active = null;
  vi.clearAllMocks();
});

afterEach(() => {
  expect(active?.unhandled ?? []).toEqual([]);
});

describe("searchLogs", () => {
  it("searches the stored search_vector with the matching simple config", async () => {
    const fake = useFake({
      "select:logs": { data: [LOG_ROW] },
      "select:log_categories": { data: [] },
    });

    const results = await searchLogs("bench");

    const search = fake.callsTo("logs", "select")[0];
    expect(search.filters).toContainEqual({
      kind: "fts",
      column: "search_vector",
      value: {
        query: "bench",
        type: "websearch",
        config: "simple",
      },
    });
    // The machine column is never selected.
    expect(search.columns).not.toContain("search_vector");
    expect(results.logs.map((log) => log.id)).toEqual([LOG_ID]);
    expect(results.truncated).toBe(false);
  });

  it("sorts matches by newest day, then newest write", async () => {
    const fake = useFake({
      "select:logs": {
        data: [
          { ...LOG_ROW, id: "old-id", logged_on: "2026-06-14" },
          { ...LOG_ROW, id: "new-id", logged_on: "2026-06-16" },
          { ...LOG_ROW, id: "same-day-a", logged_on: "2026-06-15", created_at: "2026-06-15T08:00:00.000Z" },
          { ...LOG_ROW, id: "same-day-b", logged_on: "2026-06-15", created_at: "2026-06-15T10:00:00.000Z" },
        ],
      },
      "select:log_categories": { data: [] },
    });

    await searchLogs("push");

    const search = fake.callsTo("logs", "select")[0];
    expect(search.orders).toEqual([
      { column: "logged_on", ascending: false },
      { column: "created_at", ascending: false },
    ]);
  });

  it("asks for one row more than the limit and reports truncation", async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      ...LOG_ROW,
      id: `trunc-${i}`,
    }));
    const fake = useFake({
      "select:logs": { data: rows },
      "select:log_categories": { data: [] },
    });

    const results = await searchLogs("again");

    expect(fake.callsTo("logs", "select")[0].limit).toBe(51);
    expect(results.logs).toHaveLength(50);
    expect(results.truncated).toBe(true);
  });

  it("reports no matches as an empty list, not an error", async () => {
    const fake = useFake({
      "select:logs": { data: [] },
    });

    const results = await searchLogs("a-word-that-matches-nothing");

    expect(results.logs).toEqual([]);
    expect(results.truncated).toBe(false);
    expect(fake.callsTo("log_categories")).toEqual([]);
  });

  it("attaches the caller's own visible categories to each match", async () => {
    useFake({
      "select:logs": { data: [LOG_ROW] },
      "select:log_categories": {
        data: [
          { log_id: LOG_ID, category_id: CATEGORY_A },
          { log_id: LOG_ID, category_id: CATEGORY_B },
        ],
      },
      // Only one of the two categories is visible to the caller (RLS stand-in).
      "select:categories": {
        data: [
          { id: CATEGORY_B, user_id: CURRENT_USER.id, name: "Visible" },
        ],
      },
    });

    const results = await searchLogs("bench");

    expect(results.logs[0].categories.map((c) => c.id)).toEqual([CATEGORY_B]);
  });

  it("throws a stable error when the search statement fails", async () => {
    useFake({
      "select:logs": {
        data: null,
        error: { code: "PGRST000", message: "boom" },
      },
    });

    await expect(searchLogs("bench")).rejects.toThrow(
      "The archive could not be searched.",
    );
  });
});
