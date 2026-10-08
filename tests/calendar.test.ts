import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  calendarWeeks,
  daysInMonth,
  formatMonth,
  isLeapYear,
  isSameMonth,
  monthBounds,
  monthLabel,
  monthOfDate,
  parseDate,
  parseMonth,
  startOfWeek,
  toDateString,
  weekdayIndex,
  WEEKDAY_LABELS,
} from "@/lib/calendar";

describe("parseMonth", () => {
  it("reads YYYY-MM", () => {
    expect(parseMonth("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("2026-01")).toEqual({ year: 2026, month: 1 });
  });

  it.each([
    ["2026-00", "month zero"],
    ["2026-13", "month 13"],
    ["2026-1", "single-digit month"],
    ["2026-10-01", "a day, not a month"],
    ["October 2026", "not a literal"],
    ["", "empty"],
  ])("rejects %s (%s)", (value) => {
    expect(parseMonth(value)).toBeNull();
  });

  it("rejects null and undefined", () => {
    expect(parseMonth(null)).toBeNull();
    expect(parseMonth(undefined)).toBeNull();
  });
});

describe("monthOfDate", () => {
  it("reads the month a day falls in", () => {
    expect(monthOfDate("2026-10-08")).toEqual({ year: 2026, month: 10 });
  });

  it("rejects a day that is not a day", () => {
    expect(monthOfDate("2026-10")).toBeNull();
    expect(monthOfDate("nope")).toBeNull();
  });
});

describe("parseDate", () => {
  it("unpacks a real day", () => {
    expect(parseDate("2026-06-15")).toEqual({ year: 2026, month: 6, day: 15 });
  });

  it("reads 29 February in a leap year", () => {
    expect(parseDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it.each([
    ["2026-02-30", "not a day at all"],
    ["2026-04-31", "31 April"],
    ["2026-00-10", "month zero"],
    ["2026-13-10", "month 13"],
    ["2026-06-00", "day zero"],
    ["2026-06-32", "day 32"],
    ["2026-06", "a month without a day"],
  ])("rejects %s (%s)", (value) => {
    expect(parseDate(value)).toBeNull();
  });
});

describe("leap years and month lengths", () => {
  it.each([
    [2024, true],
    [2000, true],
    [1900, false],
    [2026, false],
    [2100, false],
    [400, true],
  ])("%i is leap: %s", (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });

  it("gives February 29 days only in a leap year", () => {
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 1900, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2000, month: 2 })).toBe(29);
  });

  it("keeps the odd months right", () => {
    expect(daysInMonth({ year: 2026, month: 4 })).toBe(30);
    expect(daysInMonth({ year: 2026, month: 12 })).toBe(31);
  });
});

describe("addDays", () => {
  it("steps forward across a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("steps backward across a year boundary", () => {
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("steps over 29 February", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("is its own inverse", () => {
    for (const date of ["1970-01-01", "2024-02-29", "2026-10-08", "2099-12-31"]) {
      expect(addDays(addDays(date, 400)!, -400)).toBe(date);
      expect(addDays(addDays(date, -400)!, 400)).toBe(date);
    }
  });

  it("leaves day zero alone: a zero step is the same day", () => {
    expect(addDays("2026-06-15", 0)).toBe("2026-06-15");
  });

  it.each([
    [1.5, "a fractional step is not a day"],
    [Number.NaN, "not a number"],
    [Number.MAX_SAFE_INTEGER + 1, "beyond safe integer range"],
  ])("refuses %s (%s)", (delta) => {
    expect(addDays("2026-06-15", delta)).toBeNull();
  });

  it("refuses a day it cannot read", () => {
    expect(addDays("2026-02-30", 1)).toBeNull();
  });

  it("refuses a step that would leave the four-digit year shape", () => {
    expect(addDays("9999-12-31", 1)).toBeNull();
    expect(addDays("0000-01-01", -1)).toBeNull();
  });
});

describe("weekdayIndex", () => {
  it("indexes Monday-first", () => {
    expect(WEEKDAY_LABELS[0]).toBe("Mon");
    expect(WEEKDAY_LABELS[6]).toBe("Sun");
    expect(WEEKDAY_LABELS).toHaveLength(7);
  });

  it("knows the epoch was a Thursday", () => {
    expect(weekdayIndex("1970-01-01")).toBe(3);
  });

  it("knows Monday and Sunday", () => {
    expect(weekdayIndex("2026-10-05")).toBe(0);
    expect(weekdayIndex("2026-10-04")).toBe(6);
  });

  it("returns null for a day it cannot read", () => {
    expect(weekdayIndex("nope")).toBeNull();
  });
});

describe("startOfWeek", () => {
  it("walks back to the Monday of the same week", () => {
    expect(startOfWeek("2026-10-08")).toBe("2026-10-05");
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
  });

  it("walks back across the month boundary on a Sunday", () => {
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28");
  });

  it("returns null for a day it cannot read", () => {
    expect(startOfWeek("2026-02-30")).toBeNull();
  });
});

describe("addMonths", () => {
  it("steps forward across a year boundary", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
  });

  it("steps backward across a year boundary with no month zero", () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
  });

  it("steps by a large distance", () => {
    expect(addMonths({ year: 2026, month: 6 }, 18)).toEqual({
      year: 2027,
      month: 12,
    });
  });
});

describe("monthBounds", () => {
  it("covers a whole month with an exclusive end", () => {
    expect(monthBounds({ year: 2026, month: 2 })).toEqual({
      start: "2026-02-01",
      endExclusive: "2026-03-01",
    });
  });

  it("ends December in January of the next year", () => {
    expect(monthBounds({ year: 2026, month: 12 })).toEqual({
      start: "2026-12-01",
      endExclusive: "2027-01-01",
    });
  });

  it("ends February on the right day in a leap year", () => {
    expect(monthBounds({ year: 2024, month: 2 })).toEqual({
      start: "2024-02-01",
      endExclusive: "2024-03-01",
    });
  });
});

describe("labels", () => {
  it("formats a month key", () => {
    expect(formatMonth({ year: 2026, month: 6 })).toBe("2026-06");
    expect(formatMonth({ year: 2026, month: 1 })).toBe("2026-01");
  });

  it("names a month", () => {
    expect(monthLabel({ year: 2026, month: 10 })).toBe("October 2026");
  });

  it("compares months", () => {
    expect(
      isSameMonth({ year: 2026, month: 6 }, { year: 2026, month: 6 }),
    ).toBe(true);
    expect(
      isSameMonth({ year: 2026, month: 6 }, { year: 2025, month: 6 }),
    ).toBe(false);
  });

  it("pads day parts", () => {
    expect(toDateString(2026, 1, 5)).toBe("2026-01-05");
    expect(toDateString(2026, 12, 31)).toBe("2026-12-31");
  });
});

describe("calendarWeeks", () => {
  const months = [
    { year: 2026, month: 10 },
    { year: 2026, month: 12 },
    { year: 2024, month: 2 },
    { year: 2026, month: 2 },
    { year: 2026, month: 6 },
    { year: 2021, month: 8 },
  ];

  it.each(months)("draws a valid grid for $year-$month", (month) => {
    const weeks = calendarWeeks(month);
    const length = daysInMonth(month);

    expect(weeks.length).toBeGreaterThanOrEqual(4);
    expect(weeks.length).toBeLessThanOrEqual(6);

    const cells = weeks.flat();
    expect(cells).toHaveLength(weeks.length * 7);

    // Every cell is a real, readable day — no day 0, no day 32, no silent
    // roll into the wrong month.
    for (const cell of cells) {
      expect(parseDate(cell.date)).not.toBeNull();
    }

    // The grid starts on the Monday that holds the first of the month.
    expect(weekdayIndex(cells[0].date)).toBe(0);
    expect(weekdayIndex(cells[cells.length - 1].date)).toBe(6);

    // The in-month cells are exactly the days of the month, in order.
    const inMonth = cells.filter((cell) => cell.inMonth);
    expect(inMonth).toHaveLength(length);
    expect(inMonth.map((cell) => cell.day)).toEqual(
      Array.from({ length }, (_, index) => index + 1),
    );

    // Consecutive cells are consecutive days.
    for (let index = 1; index < cells.length; index += 1) {
      expect(addDays(cells[index - 1].date, 1)).toBe(cells[index].date);
    }
  });

  it("starts a Thursday month on the previous Monday", () => {
    const weeks = calendarWeeks({ year: 2026, month: 10 });
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual({
      date: "2026-09-28",
      day: 28,
      inMonth: false,
    });
  });

  it("rolls December's trailing cells into January without inventing a 32nd", () => {
    const weeks = calendarWeeks({ year: 2026, month: 12 });
    const cells = weeks.flat();
    expect(cells[cells.length - 1]).toEqual({
      date: "2027-01-03",
      day: 3,
      inMonth: false,
    });
    expect(cells.every((cell) => cell.day <= 31)).toBe(true);
  });

  it("includes 29 February in a leap year", () => {
    const cells = calendarWeeks({ year: 2024, month: 2 }).flat();
    expect(cells.some((cell) => cell.date === "2024-02-29")).toBe(true);
    expect(cells[cells.length - 1].date).toBe("2024-03-03");
  });

  it("never shows 29 February in a common year", () => {
    const cells = calendarWeeks({ year: 2026, month: 2 }).flat();
    expect(cells.some((cell) => cell.date === "2026-02-29")).toBe(false);
    expect(cells[cells.length - 1].date).toBe("2026-03-01");
  });
});
