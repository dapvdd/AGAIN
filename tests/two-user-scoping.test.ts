/**
 * Two-user scoping at the application layer: what happens when the database,
 * enforcing RLS, hands a *second user's* id into the application paths.
 *
 * These tests are deliberately scripted — they answer statements the way RLS
 * would — and they prove the application itself behaves correctly under cross
 * -user pressure: that it never sends a client-supplied user_id, that a
 * foreign log id is treated as nonexistent, that a foreign category is never
 * linked, and that ownership never comes from the request.
 *
 * What they do NOT prove is RLS itself. That is in
 * tests/rls-isolation.integration.test.ts, gated behind a real database. This
 * file proves the *application* half of the two-user guarantee; the integration
 * test proves the *database* half. Together they form the deliverable
 * "two-user security verification".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLog, deleteLog, updateLog } from "@/app/actions/logs";
import { EMPTY_LOG_FORM_STATE } from "@/lib/log-input";
import {
  createFakeSupabase,
  responderFor,
  type FakeResponse,
  type FakeSupabase,
} from "./support/fake-supabase";
import {
  ATTACKER_ID,
  CURRENT_USER,
  FOREIGN_CATEGORY,
  LOG_ID,
  PILLAR_RESPONSE,
  TEST_ENV,
  applyEnv,
} from "./support/fixtures";

const harness = vi.hoisted(() => ({
  client: null as unknown,
  redirects: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    if (harness.client === null) {
      throw new Error("A Supabase client was requested without a scripted fake.");
    }
    return harness.client;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    harness.redirects.push(path);
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

let restoreEnv: () => void = () => {};
let active: FakeSupabase | null = null;

function useFake(
  responses: Record<string, FakeResponse>,
  user = CURRENT_USER,
): FakeSupabase {
  const fake = createFakeSupabase({ respond: responderFor(responses), user });
  harness.client = fake.client;
  active = fake;
  return fake;
}

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        data.append(key, item);
      }
    } else {
      data.set(key, value);
    }
  }
  return data;
}

beforeEach(() => {
  harness.client = null;
  harness.redirects.length = 0;
  active = null;
  vi.clearAllMocks();
  restoreEnv = applyEnv(TEST_ENV);
});

afterEach(() => {
  restoreEnv();
  expect(active?.unhandled ?? []).toEqual([]);
});

describe("two-user scoping (user A acts; user B's records are the target)", () => {
  it("treats a log belonging to user B as nonexistent for updates", async () => {
    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      // The write path first checks the log exists: RLS answers "no row".
      "select:logs": { data: [] },
    });

    const result = await updateLog(
      EMPTY_LOG_FORM_STATE,
      form({ log_id: LOG_ID, logged_on: "2026-06-15", body: "Edited." }),
    );

    // A log that is not yours is indistinguishable from one that does not exist.
    expect(result.errors.form).toBe("That log no longer exists.");
    // No update statement was ever built — the missing-row check stopped it.
    expect(fake.callsTo("logs", "update")).toEqual([]);
  });

  it("refuses to attach a category owned by user B to user A's new log", async () => {
    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      // Stand-in for RLS: the ownership check asks for A's row and sees none,
      // because that category belongs to B.
      "select:categories": { data: [] },
    });

    const result = await createLog(
      EMPTY_LOG_FORM_STATE,
      form({
        logged_on: "2026-06-15",
        body: "A personal note.",
        category_ids: [FOREIGN_CATEGORY],
      }),
    );

    expect(result.errors.categories).toBe(
      "One or more categories are not yours.",
    );
    // No insert was attempted — the ownership check refused before the write.
    expect(fake.callsTo("logs", "insert")).toEqual([]);
    expect(fake.callsTo("log_categories", "insert")).toEqual([]);
  });

  it("never forwards a user_id borrowed from another user in an insert payload", async () => {
    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      "insert:logs": { data: [{ id: "new-log-id" }] },
      "delete:log_categories": { data: null, error: null },
      "insert:log_categories": { data: null, error: null },
    });

    await expect(
      createLog(
        EMPTY_LOG_FORM_STATE,
        form({
          logged_on: "2026-06-15",
          body: "Mine.",
          user_id: ATTACKER_ID, // a forged field the application must never read
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/app/logs/new-log-id");

    const insert = fake.callsTo("logs", "insert")[0];
    // The body and the day are sent; ownership is not. The trigger assigns it.
    expect(Object.keys(insert.payload as Record<string, unknown>)).not.toContain(
      "user_id",
    );
    expect((insert.payload as Record<string, string>).body).toBe("Mine.");
  });

  it("requests deletion without a user_id, and only for the exact id", async () => {
    const fake = useFake({
      "delete:logs": {
        data: [{ id: LOG_ID }],
        error: null,
      },
    });

    await expect(
      deleteLog(form({ log_id: LOG_ID, user_id: ATTACKER_ID })),
    ).rejects.toThrow("NEXT_REDIRECT:/app");

    const del = fake.callsTo("logs", "delete")[0];
    expect(Object.keys(del.payload ?? {})).not.toContain("user_id");
    expect(del.filters).toContainEqual({
      kind: "eq",
      column: "id",
      value: LOG_ID,
    });
    // RLS decides whether that id named A's row or B's row.
  });

  it("treats a read of B's log as an empty result, then returns no categories", async () => {
    const fake = useFake({
      "select:logs": { data: [] }, // B's log is invisible to A
    });

    const { getLog } = await import("@/lib/logs");
    expect(await getLog(LOG_ID)).toBeNull();
    expect(fake.callsTo("log_categories")).toEqual([]);
  });
});
