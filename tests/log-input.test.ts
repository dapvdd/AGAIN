import { describe, expect, it } from "vitest";
import {
  BODY_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  isDateOnly,
  isUuid,
  validateLogInput,
  type LogInput,
} from "@/lib/log-input";
import { PILLARS } from "@/lib/pillars";

const UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function input(overrides: Partial<LogInput> = {}): LogInput {
  return {
    loggedOn: "2026-06-15",
    pillar: "GYM",
    title: "Push day",
    body: "Bench 5x5, then accessories.",
    categoryIds: [],
    newCategory: "",
    ...overrides,
  };
}

describe("isUuid", () => {
  it("accepts the canonical lowercase form", () => {
    expect(isUuid(UUID)).toBe(true);
  });

  it("accepts uppercase hex, which PostgreSQL also accepts", () => {
    expect(isUuid("ABCDEF12-3456-7890-ABCD-EF1234567890")).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["not-a-uuid", "arbitrary text"],
    ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa", "too short"],
    ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa0", "too long"],
    ["aaaaaaaa-aaaa-4aaa-8aaa", "missing the last group"],
    ["aaaaaaaa-aaaa-4aaa-8aaa-gggggggggggg", "non-hex digits"],
    ["aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaaaaaa", "no hyphens"],
  ])("rejects %s (%s)", (value) => {
    expect(isUuid(value)).toBe(false);
  });
});

describe("isDateOnly", () => {
  it("accepts a real day", () => {
    expect(isDateOnly("2026-06-15")).toBe(true);
  });

  it("accepts 29 February in a leap year", () => {
    expect(isDateOnly("2024-02-29")).toBe(true);
  });

  it.each([
    ["2026-02-29", "29 February in a common year"],
    ["2026-02-30", "a day that does not exist"],
    ["2026-04-31", "31 April"],
    ["1900-02-29", "century leap year rule"],
    ["2026-13-01", "month 13"],
    ["2026-1-01", "single-digit month"],
    ["20260615", "no hyphens"],
    ["2026-06-15T00:00:00Z", "a timestamp, not a day"],
    ["", "empty"],
    ["today", "not a date"],
  ])("rejects %s (%s)", (value) => {
    expect(isDateOnly(value)).toBe(false);
  });
});

describe("validateLogInput", () => {
  it("accepts a well-formed entry", () => {
    expect(validateLogInput(input(), PILLARS)).toEqual({});
  });

  it("accepts an entry with no pillar and no categories", () => {
    expect(validateLogInput(input({ pillar: "" }), PILLARS)).toEqual({});
  });

  it("rejects a day the calendar cannot read", () => {
    const errors = validateLogInput(input({ loggedOn: "2026-02-30" }), PILLARS);
    expect(errors.loggedOn).toBe("Pick a real day.");
  });

  it("accepts a title of exactly the maximum length", () => {
    const errors = validateLogInput(
      input({ title: "t".repeat(TITLE_MAX_LENGTH) }),
      PILLARS,
    );
    expect(errors.title).toBeUndefined();
  });

  it("rejects one character more than the maximum title length", () => {
    const errors = validateLogInput(
      input({ title: "t".repeat(TITLE_MAX_LENGTH + 1) }),
      PILLARS,
    );
    expect(errors.title).toBe(`Keep the title under ${TITLE_MAX_LENGTH} characters.`);
  });

  it("rejects an entry with no words", () => {
    const errors = validateLogInput(input({ body: "   \n  " }), PILLARS);
    expect(errors.body).toBe(
      "Write something. An entry without words is not an entry.",
    );
  });

  it("accepts a body of exactly the maximum length", () => {
    const errors = validateLogInput(
      input({ body: "b".repeat(BODY_MAX_LENGTH) }),
      PILLARS,
    );
    expect(errors.body).toBeUndefined();
  });

  it("rejects one character more than the maximum body length", () => {
    const errors = validateLogInput(
      input({ body: "b".repeat(BODY_MAX_LENGTH + 1) }),
      PILLARS,
    );
    expect(errors.body).toBe(`Keep the note under ${BODY_MAX_LENGTH} characters.`);
  });

  it.each(PILLARS)("accepts the %s pillar", (pillar) => {
    expect(validateLogInput(input({ pillar }), PILLARS)).toEqual({});
  });

  it("accepts an empty pillar as the form's None choice", () => {
    expect(validateLogInput(input({ pillar: "" }), PILLARS)).toEqual({});
  });

  it("rejects a pillar the compass does not hold", () => {
    const errors = validateLogInput(input({ pillar: "MEDITATE" }), PILLARS);
    expect(errors.pillar).toBe("That is not one of the seven pillars.");
  });

  it("rejects a pillar whose case does not match the compass", () => {
    const errors = validateLogInput(input({ pillar: "gym" }), PILLARS);
    expect(errors.pillar).toBe("That is not one of the seven pillars.");
  });

  it("rejects a category id that is not a uuid", () => {
    const errors = validateLogInput(
      input({ categoryIds: [UUID, "not-a-uuid"] }),
      PILLARS,
    );
    expect(errors.categories).toBe("One of the selected categories is not valid.");
  });

  it("accepts category ids that are uuids", () => {
    const errors = validateLogInput(
      input({ categoryIds: [UUID, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"] }),
      PILLARS,
    );
    expect(errors).toEqual({});
  });

  it("accepts a new category name of exactly the maximum length", () => {
    const errors = validateLogInput(
      input({ newCategory: "n".repeat(CATEGORY_NAME_MAX_LENGTH) }),
      PILLARS,
    );
    expect(errors.categories).toBeUndefined();
  });

  it("rejects a new category name past the maximum length", () => {
    const errors = validateLogInput(
      input({ newCategory: "n".repeat(CATEGORY_NAME_MAX_LENGTH + 1) }),
      PILLARS,
    );
    expect(errors.categories).toBe(
      `Keep a category name under ${CATEGORY_NAME_MAX_LENGTH} characters.`,
    );
  });

  it("reports each broken field at once so the form can mark them all", () => {
    const errors = validateLogInput(
      input({ loggedOn: "yesterday", pillar: "HACK", body: " " }),
      PILLARS,
    );
    expect(Object.keys(errors).sort()).toEqual(["body", "loggedOn", "pillar"]);
  });

  it("never reports a form-level error: field errors are the only shape", () => {
    const errors = validateLogInput(input({ loggedOn: "nope" }), PILLARS);
    expect(errors.form).toBeUndefined();
  });
});
