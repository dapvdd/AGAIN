/**
 * Application-level tests for the read path (the DAL).
 *
 * They prove that the application refuses ids it cannot read, scopes the
 * queries it builds, and reacts sanely when a row or a join target comes back
 * empty. The empty results are *scripted* stand-ins for what RLS would hide —
 * they exercise the application's handling of a filtered result, never the
 * filtering itself. Which rows PostgreSQL actually shows belongs to the RLS
 * policies and stays covered by the live, manual security verification.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLog,
  getLogDatesBetween,
  getLogsByDate,
  getRecentLogs,
} from "@/lib/logs";
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
});

afterEach(() => {
  expect(active?.unhandled ?? []).toEqual([]);
});

describe("getLog", () => {
  it("resolves a forged id to null without a round trip", async () => {
    const fake = useFake({});

    expect(await getLog("forged-id")).toBeNull();
    expect(fake.calls).toEqual([]);
  });

  it("resolves an id the database reports as absent to null", async () => {
    const fake = useFake({
      // Stand-in for RLS: well-formed id, no visible row.
      "select:logs": { data: [] },
    });

    expect(await getLog(LOG_ID)).toBeNull();
    expect(fake.callsTo("logs", "select")).toHaveLength(1);
    expect(fake.callsTo("log_categories")).toEqual([]);
  });

  it("drops a link whose category is not visible rather than leaking a name", async () => {
    useFake({
      "select:logs": { data: [LOG_ROW] },
      "select:log_categories": {
        data: [
          { log_id: LOG_ID, category_id: CATEGORY_A },
          { log_id: LOG_ID, category_id: CATEGORY_B },
        ],
      },
      // Stand-in for RLS: only one of the two categories is visible.
      "select:categories": {
        data: [
          {
            id: CATEGORY_B,
            user_id: CURRENT_USER.id,
            name: "Bench",
            created_at: "2026-06-01T00:00:00.000Z",
            updated_at: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    });

    const log = await getLog(LOG_ID);

    expect(log?.categories.map((category) => category.name)).toEqual(["Bench"]);
  });

  it("attaches the caller's categories in name order", async () => {
    useFake({
      "select:logs": { data: [LOG_ROW] },
      "select:log_categories": {
        data: [
          { log_id: LOG_ID, category_id: CATEGORY_A },
          { log_id: LOG_ID, category_id: CATEGORY_B },
        ],
      },
      "select:categories": {
        data: [
          {
            id: CATEGORY_A,
            user_id: CURRENT_USER.id,
            name: "Cardio",
            created_at: "2026-06-01T00:00:00.000Z",
            updated_at: "2026-06-01T00:00:00.000Z",
          },
          {
            id: CATEGORY_B,
            user_id: CURRENT_USER.id,
            name: "Bench",
            created_at: "2026-06-01T00:00:00.000Z",
            updated_at: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    });

    const log = await getLog(LOG_ID);

    expect(log?.categories.map((category) => category.name)).toEqual([
      "Bench",
      "Cardio",
    ]);
  });
});

describe("getRecentLogs", () => {
  it("filters by pillar when one is given", async () => {
    const fake = useFake({ "select:logs": { data: [] } });

    await getRecentLogs(20, "GYM");

    expect(fake.calls[0].filters).toContainEqual({
      kind: "eq",
      column: "pillar",
      value: "GYM",
    });
    expect(fake.calls[0].limit).toBe(20);
  });

  it("sends no pillar filter when none is given", async () => {
    const fake = useFake({ "select:logs": { data: [] } });

    await getRecentLogs(20);

    expect(
      fake.calls[0].filters.filter((filter) => filter.column === "pillar"),
    ).toEqual([]);
  });
});

describe("getLogsByDate", () => {
  it("returns nothing, and asks nothing, for a day the calendar cannot read", async () => {
    const fake = useFake({});

    expect(await getLogsByDate("2026-02-30")).toEqual([]);
    expect(fake.calls).toEqual([]);
  });
});

describe("getLogDatesBetween", () => {
  it("returns nothing, and asks nothing, for an empty or inverted range", async () => {
    const fake = useFake({});

    expect(await getLogDatesBetween("2026-06-15", "2026-06-15")).toEqual([]);
    expect(await getLogDatesBetween("2026-06-20", "2026-06-15")).toEqual([]);
    expect(await getLogDatesBetween("nope", "2026-06-15")).toEqual([]);
    expect(fake.calls).toEqual([]);
  });
});
