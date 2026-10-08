/**
 * Application-level security tests for the Server Actions.
 *
 * These prove what the application itself guarantees:
 *   - every entry point checks the session before it touches a row;
 *   - no statement the application builds carries a client-supplied user_id;
 *   - ids that are malformed are refused before any round trip;
 *   - an id the database hands back as "not visible" is reported as not
 *     found, never as a successful write;
 *   - categories are proved to be the caller's before they are attached.
 *
 * The empty results standing in for "the row is not visible" are *scripted*.
 * Whether PostgreSQL actually hides those rows is the work of the RLS
 * policies, which no test here can see; that remains covered by the live,
 * manual security verification against a real database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import {
  createCategory,
  deleteCategory,
  renameCategory,
} from "@/app/actions/categories";
import { createLog, deleteLog, updateLog } from "@/app/actions/logs";
import { INITIAL_CATEGORY_RESULT } from "@/lib/category-input";
import { EMPTY_LOG_FORM_STATE } from "@/lib/log-input";
import {
  createFakeSupabase,
  responderFor,
  type FakeResponse,
  type FakeSupabase,
} from "./support/fake-supabase";
import {
  ATTACKER_ID,
  CATEGORY_A,
  CATEGORY_B,
  CURRENT_USER,
  FOREIGN_CATEGORY,
  LOG_ID,
  PILLAR_RESPONSE,
  TEST_ENV,
  applyEnv,
} from "./support/fixtures";

const harness = vi.hoisted(() => ({
  client: null as unknown,
  creations: 0,
  redirects: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    harness.creations += 1;
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
  user: typeof CURRENT_USER | null = CURRENT_USER,
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
  harness.creations = 0;
  harness.redirects.length = 0;
  active = null;
  vi.clearAllMocks();
  restoreEnv = applyEnv(TEST_ENV);
});

afterEach(() => {
  restoreEnv();
  vi.useRealTimers();
  // No statement may go unanswered: a test that passes because a query fell
  // through to the default error is not a test at all.
  expect(active?.unhandled ?? []).toEqual([]);
});

type AuthCase = [name: string, run: () => Promise<unknown>];

const AUTH_CASES: AuthCase[] = [
  ["createLog", () => createLog(EMPTY_LOG_FORM_STATE, form({ body: "Hello." }))],
  [
    "updateLog",
    () => updateLog(EMPTY_LOG_FORM_STATE, form({ log_id: LOG_ID, body: "Hi." })),
  ],
  ["deleteLog", () => deleteLog(form({ log_id: LOG_ID }))],
  [
    "createCategory",
    () => createCategory(INITIAL_CATEGORY_RESULT, form({ name: "Work" })),
  ],
  [
    "renameCategory",
    () =>
      renameCategory(
        INITIAL_CATEGORY_RESULT,
        form({ category_id: CATEGORY_A, name: "Work" }),
      ),
  ],
  ["deleteCategory", () => deleteCategory(form({ category_id: CATEGORY_A }))],
];

describe("authentication", () => {
  it.each(AUTH_CASES)(
    "sends an unauthenticated %s call to /login before any statement",
    async (_name, run) => {
      useFake({}, null);

      await expect(run()).rejects.toThrow("NEXT_REDIRECT:/login");

      expect(harness.redirects).toEqual(["/login"]);
      expect(active?.calls).toEqual([]);
    },
  );

  it("degrades to unauthenticated when the Supabase env is absent, without building a client", async () => {
    applyEnv({ url: null, anonKey: null });
    harness.client = null;

    await expect(
      createCategory(INITIAL_CATEGORY_RESULT, form({ name: "Work" })),
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(harness.creations).toBe(0);
    expect(harness.redirects).toEqual(["/login"]);
  });

  it("builds one client for the session check and one for the write", async () => {
    useFake({ "insert:categories": { data: null, error: null } });

    await createCategory(INITIAL_CATEGORY_RESULT, form({ name: "Work" }));

    expect(harness.creations).toBe(2);
  });
});

describe("createLog", () => {
  it("never lets the form supply a user_id", async () => {
    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      "insert:logs": { data: [{ id: LOG_ID }] },
      "delete:log_categories": { data: null, error: null },
    });

    await expect(
      createLog(
        EMPTY_LOG_FORM_STATE,
        form({
          logged_on: "2026-06-15",
          pillar: "GYM",
          title: "Push day",
          body: "Bench 5x5.",
          user_id: ATTACKER_ID,
        }),
      ),
    ).rejects.toThrow(`NEXT_REDIRECT:/app/logs/${LOG_ID}`);

    const [insert] = fake.callsTo("logs", "insert");
    expect(insert.payload).toEqual({
      logged_on: "2026-06-15",
      pillar: "GYM",
      title: "Push day",
      body: "Bench 5x5.",
    });
    expect(insert.payload).not.toHaveProperty("user_id");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/app", "layout");
  });

  it("treats a blank day as today", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T09:30:00.000Z"));

    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      "insert:logs": { data: [{ id: LOG_ID }] },
      "delete:log_categories": { data: null, error: null },
    });

    await expect(
      createLog(
        EMPTY_LOG_FORM_STATE,
        form({
          logged_on: "",
          pillar: "",
          title: "A day",
          body: "Written today.",
        }),
      ),
    ).rejects.toThrow(`NEXT_REDIRECT:/app/logs/${LOG_ID}`);

    expect(fake.callsTo("logs", "insert")[0].payload).toMatchObject({
      logged_on: "2026-06-15",
      pillar: null,
      title: "A day",
    });
  });

  it("refuses a pillar the compass does not hold before any write", async () => {
    const fake = useFake({ "select:pillars": PILLAR_RESPONSE });

    const state = await createLog(
      EMPTY_LOG_FORM_STATE,
      form({
        logged_on: "2026-06-15",
        pillar: "HACK",
        title: "Title",
        body: "Body.",
      }),
    );

    expect(state.errors.pillar).toBe("That is not one of the seven pillars.");
    expect(fake.callsTo("logs", "insert")).toEqual([]);
  });

  it("refuses a category id that is not a uuid before any round trip", async () => {
    const fake = useFake({ "select:pillars": PILLAR_RESPONSE });

    const state = await createLog(
      EMPTY_LOG_FORM_STATE,
      form({
        logged_on: "2026-06-15",
        body: "Body.",
        category_ids: ["not-a-uuid"],
      }),
    );

    expect(state.errors.categories).toBe(
      "One of the selected categories is not valid.",
    );
    expect(fake.callsTo("categories")).toEqual([]);
    expect(fake.callsTo("logs", "insert")).toEqual([]);
  });

  it("refuses to attach a category that is not the caller's", async () => {
    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      // Stand-in for RLS: the ownership check sees none of them.
      "select:categories": { data: [] },
    });

    const state = await createLog(
      EMPTY_LOG_FORM_STATE,
      form({
        logged_on: "2026-06-15",
        body: "Body.",
        category_ids: FOREIGN_CATEGORY,
      }),
    );

    expect(state.errors.categories).toBe(
      "One or more categories are not yours.",
    );
    expect(fake.callsTo("logs", "insert")).toEqual([]);
    expect(fake.callsTo("log_categories")).toEqual([]);
  });

  it("reuses an existing category name instead of failing on it", async () => {
    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      "insert:categories": {
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      },
      "select:categories": { data: [{ id: CATEGORY_A }] },
      "insert:logs": { data: [{ id: LOG_ID }] },
      "delete:log_categories": { data: null, error: null },
      "insert:log_categories": { data: null, error: null },
    });

    await expect(
      createLog(
        EMPTY_LOG_FORM_STATE,
        form({
          logged_on: "2026-06-15",
          title: "Title",
          body: "Body.",
          new_category: "100%_focus",
        }),
      ),
    ).rejects.toThrow(`NEXT_REDIRECT:/app/logs/${LOG_ID}`);

    const ilike = fake
      .callsTo("categories", "select")
      .flatMap((call) => call.filters)
      .filter((filter) => filter.kind === "ilike");

    // The lookup escapes the pattern characters the name contains, so a name
    // with % or _ matches itself and nothing else.
    expect(ilike).toEqual([
      { kind: "ilike", column: "name", value: "100\\%\\_focus" },
    ]);
  });

  it("removes a new log again when its categories cannot be attached", async () => {
    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      "insert:categories": { data: [{ id: CATEGORY_A }] },
      "select:categories": { data: [{ id: CATEGORY_A }] },
      "insert:logs": { data: [{ id: LOG_ID }] },
      "delete:log_categories": { data: null, error: null },
      "insert:log_categories": {
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      },
      "delete:logs": { data: [{ id: LOG_ID }], error: null },
    });

    const state = await createLog(
      EMPTY_LOG_FORM_STATE,
      form({
        logged_on: "2026-06-15",
        title: "Title",
        body: "Body.",
        new_category: "New tag",
      }),
    );

    expect(state.errors.form).toBe(
      "The log was saved, but its categories could not be attached.",
    );

    const rollback = fake.callsTo("logs", "delete");
    expect(rollback).toHaveLength(1);
    expect(rollback[0].filters).toEqual([
      { kind: "eq", column: "id", value: LOG_ID },
    ]);
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });
});

describe("updateLog", () => {
  it("refuses a log id that is not a uuid without touching the database", async () => {
    const fake = useFake({});

    const state = await updateLog(
      EMPTY_LOG_FORM_STATE,
      form({ log_id: "forged-id", logged_on: "2026-06-15", body: "Body." }),
    );

    expect(state.errors.form).toBe("That log could not be found.");
    expect(fake.calls).toEqual([]);
  });

  it("reports a log the database hands back as absent", async () => {
    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      // Stand-in for RLS: the id is well-formed but resolves to no row.
      "select:logs": { data: [] },
    });

    const state = await updateLog(
      EMPTY_LOG_FORM_STATE,
      form({ log_id: LOG_ID, logged_on: "2026-06-15", body: "Body." }),
    );

    expect(state.errors.form).toBe("That log no longer exists.");
    expect(fake.callsTo("logs", "update")).toEqual([]);
    expect(fake.callsTo("log_categories")).toEqual([]);
  });

  it("does not claim a save when the update itself comes back empty", async () => {
    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      "select:logs": { data: [{ id: LOG_ID }] },
      "update:logs": { data: [] },
    });

    const state = await updateLog(
      EMPTY_LOG_FORM_STATE,
      form({ log_id: LOG_ID, logged_on: "2026-06-15", body: "Body." }),
    );

    expect(state.errors.form).toBe("That log no longer exists.");
    expect(fake.callsTo("log_categories")).toEqual([]);
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });

  it("retags by clearing the old links before writing the new ones", async () => {
    const fake = useFake({
      "select:pillars": PILLAR_RESPONSE,
      "select:logs": { data: [{ id: LOG_ID }] },
      "select:categories": { data: [{ id: CATEGORY_A }, { id: CATEGORY_B }] },
      "update:logs": { data: [{ id: LOG_ID }] },
      "delete:log_categories": { data: null, error: null },
      "insert:log_categories": { data: null, error: null },
    });

    await expect(
      updateLog(
        EMPTY_LOG_FORM_STATE,
        form({
          log_id: LOG_ID,
          logged_on: "2026-06-15",
          title: "Edited",
          body: "New words.",
          category_ids: [CATEGORY_A, CATEGORY_B],
          user_id: ATTACKER_ID,
        }),
      ),
    ).rejects.toThrow(`NEXT_REDIRECT:/app/logs/${LOG_ID}`);

    expect(fake.calls.map((call) => `${call.op}:${call.table}`)).toEqual([
      "select:pillars",
      "select:logs",
      "select:categories",
      "update:logs",
      "delete:log_categories",
      "insert:log_categories",
    ]);

    expect(fake.callsTo("logs", "update")[0].payload).toEqual({
      logged_on: "2026-06-15",
      pillar: null,
      title: "Edited",
      body: "New words.",
    });
    expect(fake.callsTo("logs", "update")[0].payload).not.toHaveProperty(
      "user_id",
    );

    expect(fake.callsTo("log_categories", "insert")[0].payload).toEqual([
      { log_id: LOG_ID, category_id: CATEGORY_A },
      { log_id: LOG_ID, category_id: CATEGORY_B },
    ]);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/app", "layout");
  });
});

describe("deleteLog", () => {
  it("issues exactly one delete and leaves the join rows to the database's cascade", async () => {
    const fake = useFake({
      "delete:logs": { data: [{ id: LOG_ID }], error: null },
    });

    await expect(deleteLog(form({ log_id: LOG_ID }))).rejects.toThrow(
      "NEXT_REDIRECT:/app",
    );

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({
      table: "logs",
      op: "delete",
      filters: [{ kind: "eq", column: "id", value: LOG_ID }],
    });
    expect(fake.callsTo("log_categories")).toEqual([]);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/app", "layout");
  });

  it("issues no statement for a log id that is not a uuid", async () => {
    const fake = useFake({});

    await expect(deleteLog(form({ log_id: "forged-id" }))).rejects.toThrow(
      "NEXT_REDIRECT:/app",
    );

    expect(fake.calls).toEqual([]);
  });
});

describe("category actions", () => {
  it("never lets the form supply a user_id when creating a category", async () => {
    const fake = useFake({ "insert:categories": { data: null, error: null } });

    const result = await createCategory(
      INITIAL_CATEGORY_RESULT,
      form({ name: "  Work  ", user_id: ATTACKER_ID }),
    );

    expect(result).toEqual({ ok: true, saved: true });

    const [insert] = fake.callsTo("categories", "insert");
    expect(insert.payload).toEqual({ name: "Work" });
    expect(insert.payload).not.toHaveProperty("user_id");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/app", "layout");
  });

  it("refuses a category id that is not a uuid without touching the database", async () => {
    const fake = useFake({});

    const result = await renameCategory(
      INITIAL_CATEGORY_RESULT,
      form({ category_id: "forged-id", name: "Renamed" }),
    );

    expect(result).toEqual({
      ok: false,
      errors: { form: "That category no longer exists." },
    });
    expect(fake.calls).toEqual([]);
  });

  it("reports a rename of a category the database hands back as absent", async () => {
    const fake = useFake({
      // Stand-in for RLS: the update matches no visible row.
      "update:categories": { data: null },
    });

    const result = await renameCategory(
      INITIAL_CATEGORY_RESULT,
      form({ category_id: CATEGORY_A, name: "Renamed", user_id: ATTACKER_ID }),
    );

    expect(result).toEqual({
      ok: false,
      errors: { form: "That category no longer exists." },
    });
    expect(fake.callsTo("categories", "update")[0].payload).toEqual({
      name: "Renamed",
    });
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });
});
