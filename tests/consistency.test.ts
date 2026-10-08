import { describe, expect, it } from "vitest";
import {
  CONSISTENCY_WEEKS,
  buildConsistency,
  consistencyWindow,
} from "@/lib/consistency";
import { addDays, startOfWeek, weekdayIndex } from "@/lib/calendar";

/** A map of day -> logs on that day, which is what the DAL feeds this. */
function counts(entries: [string, number][]): Map<string, number> {
  return new Map(entries);
}

const TODAY = "2026-06-15";

describe("consistencyWindow", () => {
  it("covers whole Monday-to-Sunday weeks ending with today's week", () => {
    const window = consistencyWindow(TODAY);
    expect(window).not.toBeNull();

    const { start, endExclusive } = window!;
    expect(start).toBe("2025-12-22");
    expect(endExclusive).toBe("2026-06-22");
    expect(weekdayIndex(start)).toBe(0);
    expect(startOfWeek(TODAY)).toBe("2026-06-15");
    expect(addDays(start, CONSISTENCY_WEEKS * 7)).toBe(endExclusive);
    expect(start <= TODAY && TODAY < endExclusive).toBe(true);
  });

  it("has no window for a day the calendar cannot read", () => {
    expect(consistencyWindow("2026-02-30")).toBeNull();
  });
});

describe("buildConsistency", () => {
  it("measures an empty archive honestly", () => {
    const result = buildConsistency(new Map(), TODAY);

    expect(result.weeks).toHaveLength(CONSISTENCY_WEEKS);
    expect(result.windowStart).toBe("2025-12-22");
    expect(result.windowDays).toBe(CONSISTENCY_WEEKS * 7);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.daysLogged).toBe(0);
    expect(result.entriesLogged).toBe(0);
    expect(result.thisMonth).toBe(0);
    expect(result.lastMonth).toBe(0);
  });

  it("returns an empty measurement for a day the calendar cannot read", () => {
    const result = buildConsistency(counts([["2026-06-15", 1]]), "2026-02-30");

    expect(result.weeks).toEqual([]);
    expect(result.windowDays).toBe(0);
    expect(result.windowStart).toBe("2026-02-30");
    expect(result.currentStreak).toBe(0);
  });

  it("draws 26 weeks of seven days, each starting on a Monday", () => {
    const result = buildConsistency(new Map(), TODAY);

    for (const week of result.weeks) {
      expect(week.days).toHaveLength(7);
      expect(weekdayIndex(week.start)).toBe(0);
    }
    expect(result.weeks[0].start).toBe(result.windowStart);
  });

  it("marks today exactly once", () => {
    const result = buildConsistency(counts([[TODAY, 1]]), TODAY);
    const marked = result.weeks
      .flatMap((week) => week.days)
      .filter((day) => day.isToday);

    expect(marked).toHaveLength(1);
    expect(marked[0].date).toBe(TODAY);
    expect(marked[0].count).toBe(1);
  });

  it("cannot hold a log on a day that has not happened", () => {
    const result = buildConsistency(counts([["2026-06-20", 5]]), TODAY);
    const future = result.weeks
      .flatMap((week) => week.days)
      .find((day) => day.date === "2026-06-20");

    expect(future?.future).toBe(true);
    expect(future?.count).toBe(0);
    expect(result.entriesLogged).toBe(0);
    expect(result.daysLogged).toBe(0);
  });

  it("counts several logs on one day as one day and several entries", () => {
    const result = buildConsistency(counts([[TODAY, 3]]), TODAY);

    expect(result.daysLogged).toBe(1);
    expect(result.entriesLogged).toBe(3);
  });

  it("counts the run that ends today", () => {
    const result = buildConsistency(
      counts([
        ["2026-06-13", 1],
        ["2026-06-14", 1],
        [TODAY, 1],
      ]),
      TODAY,
    );

    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.daysLogged).toBe(3);
    expect(result.entriesLogged).toBe(3);
  });

  it("forgives today when it is still empty", () => {
    const result = buildConsistency(
      counts([
        ["2026-06-13", 1],
        ["2026-06-14", 1],
      ]),
      TODAY,
    );

    expect(result.currentStreak).toBe(2);
  });

  it("ends the run at the first genuinely missed day", () => {
    const result = buildConsistency(
      counts([
        ["2026-06-10", 1],
        ["2026-06-11", 1],
        ["2026-06-12", 1],
        ["2026-06-13", 1],
      ]),
      TODAY,
    );

    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(4);
  });

  it("counts a written today as a run of one when yesterday was missed", () => {
    const result = buildConsistency(counts([[TODAY, 1]]), TODAY);
    expect(result.currentStreak).toBe(1);
  });

  it("keeps the longest run even when the current one is shorter", () => {
    const result = buildConsistency(
      counts([
        ["2026-06-01", 1],
        ["2026-06-02", 1],
        ["2026-06-03", 1],
        ["2026-06-04", 1],
        ["2026-06-13", 1],
        ["2026-06-14", 1],
        [TODAY, 1],
      ]),
      TODAY,
    );

    expect(result.longestStreak).toBe(4);
    expect(result.currentStreak).toBe(3);
  });

  it("splits entries into this month and last month", () => {
    const result = buildConsistency(
      counts([
        ["2026-06-01", 2],
        ["2026-05-31", 4],
        ["2026-04-15", 9],
      ]),
      TODAY,
    );

    expect(result.thisMonth).toBe(2);
    expect(result.lastMonth).toBe(4);
    expect(result.entriesLogged).toBe(15);
    expect(result.daysLogged).toBe(3);
  });

  it("counts December as last month when today is in January", () => {
    const result = buildConsistency(counts([["2025-12-31", 4]]), "2026-01-10");

    expect(result.lastMonth).toBe(4);
    expect(result.thisMonth).toBe(0);
  });

  it("ignores days written outside the window", () => {
    const outside = addDays(TODAY, -200);
    expect(outside).not.toBeNull();

    const result = buildConsistency(counts([[outside!, 7]]), TODAY);

    expect(result.entriesLogged).toBe(0);
    expect(result.daysLogged).toBe(0);
    expect(
      result.weeks
        .flatMap((week) => week.days)
        .some((day) => day.date === outside),
    ).toBe(false);
  });

  it("is a pure function of the counts and today", () => {
    const archive = counts([
      ["2026-06-14", 2],
      [TODAY, 1],
    ]);

    expect(buildConsistency(archive, TODAY)).toEqual(
      buildConsistency(new Map(archive), TODAY),
    );
  });
});
