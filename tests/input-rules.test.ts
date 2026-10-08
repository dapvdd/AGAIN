import { describe, expect, it } from "vitest";
import {
  CATEGORY_NAME_MAX_LENGTH,
  validateCategoryName,
} from "@/lib/category-input";
import {
  SEARCH_QUERY_MAX_LENGTH,
  normalizeSearchQuery,
} from "@/lib/search";

describe("normalizeSearchQuery", () => {
  it("treats an absent query as no search yet", () => {
    expect(normalizeSearchQuery(undefined)).toBeNull();
  });

  it("treats a blank query as no search yet", () => {
    expect(normalizeSearchQuery("")).toBeNull();
    expect(normalizeSearchQuery("   ")).toBeNull();
    expect(normalizeSearchQuery(" \n\t ")).toBeNull();
  });

  it("trims what was typed", () => {
    expect(normalizeSearchQuery("  push day  ")).toBe("push day");
  });

  it("keeps a real query as typed", () => {
    expect(normalizeSearchQuery('bench "5x5" -machine')).toBe(
      'bench "5x5" -machine',
    );
  });

  it("keeps a query of exactly the maximum length", () => {
    const query = "a".repeat(SEARCH_QUERY_MAX_LENGTH);
    expect(normalizeSearchQuery(query)).toBe(query);
  });

  it("caps a query past the maximum length", () => {
    const result = normalizeSearchQuery("b".repeat(SEARCH_QUERY_MAX_LENGTH + 50));
    expect(result).toHaveLength(SEARCH_QUERY_MAX_LENGTH);
  });
});

describe("validateCategoryName", () => {
  it("accepts a name as typed", () => {
    expect(validateCategoryName("Work")).toBeNull();
  });

  it("accepts a name with surrounding space, judged after trimming", () => {
    expect(validateCategoryName("  Deep work  ")).toBeNull();
  });

  it("rejects an empty name", () => {
    expect(validateCategoryName("")).toBe("A category needs a name.");
  });

  it("rejects a name that is only space", () => {
    expect(validateCategoryName("    ")).toBe("A category needs a name.");
  });

  it("accepts a name of exactly the maximum length", () => {
    expect(
      validateCategoryName("n".repeat(CATEGORY_NAME_MAX_LENGTH)),
    ).toBeNull();
  });

  it("rejects one character more than the maximum length", () => {
    expect(
      validateCategoryName("n".repeat(CATEGORY_NAME_MAX_LENGTH + 1)),
    ).toBe(`Keep a category name under ${CATEGORY_NAME_MAX_LENGTH} characters.`);
  });

  it("does not pre-judge case-insensitive duplicates: the index decides", () => {
    expect(validateCategoryName("work")).toBeNull();
    expect(validateCategoryName("WORK")).toBeNull();
  });
});
