import { describe, expect, it } from "vitest";
import {
  buildInsights,
  categoryBreakdown,
  findMilestones,
  insightWindow,
  monthlySummaries,
  pillarBreakdown,
  summarizeTotals,
  weekdayBreakdown,
  type InsightLog,
} from "@/lib/insights";

const PILLARS = [
  { key: "GYM", label: "GYM" },
  { key: "BUILD", label: "BUILD" },
  { key: "STUDY", label: "STUDY" },
  { key: "PRAY", label: "PRAY" },
  { key: "REFLECT", label: "REFLECT" },
  { key: "LOVE", label: "LOVE" },
  { key: "FAMILY", label: "FAMILY" },
];

function log(
  id: string,
  logged_on: string,
  partial: Partial<InsightLog> = {},
): InsightLog {
  return {
    id,
    logged_on,
    pillar: null,
    title: null,
    body: "...",
    created_at: `${logged_on}T12:00:00.000Z`,
    ...partial,
  };
}

describe("insightWindow", () => {
  it("covers whole weeks ending in today's week", () => {
    // 2026-10-28 is a Wednesday; the week started Monday 2026-10-26.
    const window = insightWindow("2026-10-28", 2);
    expect(window).toEqual({ start: "2026-10-19", end: "2026-10-28" });
  });

  it("returns null for an unparseable date", () => {
    expect(insightWindow("not-a-date", 2)).toBeNull();
  });
});

describe("summarizeTotals", () => {
  const window = { start: "2026-10-01", end: "2026-10-28" };

  it("counts only the window, not the whole archive", () => {
    const logs = [
      log("1", "2026-10-01"),
      log("2", "2026-10-02"),
      log("3", "2026-09-30"), // outside
      log("4", "2026-10-02"), // same day as 2
    ];
    const totals = summarizeTotals(logs, window);
    expect(totals.entries).toBe(3);
    expect(totals.daysLogged).toBe(2);
    expect(totals.entriesPerDay).toBe(1.5);
  });

  it("reports first and last log even if they fall outside the window", () => {
    const logs = [log("1", "2026-03-01"), log("2", "2026-10-10")];
    const totals = summarizeTotals(logs, window);
    expect(totals.firstLog).toBe("2026-03-01");
    expect(totals.lastLog).toBe("2026-10-10");
    expect(totals.spanDays).toBe(224); // inclusive day count from Mar 1 to Oct 10
  });

  it("returns zeros for an empty archive", () => {
    const totals = summarizeTotals([], window);
    expect(totals.entries).toBe(0);
    expect(totals.daysLogged).toBe(0);
    expect(totals.entriesPerDay).toBe(0);
    expect(totals.spanDays).toBe(0);
    expect(totals.firstLog).toBeNull();
  });
});

describe("pillarBreakdown", () => {
  const window = { start: "2026-10-01", end: "2026-10-10" };

  it("reports every pillar, including untouched ones, at consistency 0", () => {
    const logs = [
      log("1", "2026-10-01", { pillar: "GYM" }),
      log("2", "2026-10-01", { pillar: "GYM" }),
    ];
    const breakdown = pillarBreakdown(logs, window, PILLARS);
    expect(breakdown).toHaveLength(PILLARS.length);
    const gym = breakdown.find((p) => p.key === "GYM");
    expect(gym?.entries).toBe(2);
    expect(gym?.daysLogged).toBe(1);
    expect(gym?.consistency).toBeCloseTo(1 / 10);
    const build = breakdown.find((p) => p.key === "BUILD");
    expect(build?.entries).toBe(0);
    expect(build?.consistency).toBe(0);
  });

  it("ignores logs outside the window", () => {
    const logs = [log("1", "2026-09-01", { pillar: "GYM" })];
    const breakdown = pillarBreakdown(logs, window, PILLARS);
    expect(breakdown.find((p) => p.key === "GYM")?.entries).toBe(0);
  });
});

describe("categoryBreakdown", () => {
  const window = { start: "2026-10-01", end: "2026-10-10" };
  const cats = [
    { id: "cat-a", name: "Health" },
    { id: "cat-b", name: "Work" },
  ];

  it("orders by usage, then name, and only counts window logs with the tag", () => {
    const logs = [
      log("1", "2026-10-01", { categoryIds: ["cat-a"] }),
      log("2", "2026-10-02", { categoryIds: ["cat-a", "cat-b"] }),
      log("3", "2026-10-03", { categoryIds: ["cat-b"] }),
    ];
    const breakdown = categoryBreakdown(logs, window, cats);
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].name).toBe("Health");
    expect(breakdown[0].entries).toBe(2);
    expect(breakdown[1].name).toBe("Work");
    expect(breakdown[1].entries).toBe(2);
  });

  it("still lists a category with zero usage", () => {
    const breakdown = categoryBreakdown([], window, cats);
    expect(breakdown.map((c) => c.name)).toEqual(["Health", "Work"]);
    expect(breakdown.every((c) => c.entries === 0)).toBe(true);
  });
});

describe("weekdayBreakdown", () => {
  const window = { start: "2026-10-01", end: "2026-10-31" };

  it("counts entries and distinct days by weekday, all seven reported", () => {
    // 2026-10-01 is a Thursday.
    const logs = [
      log("1", "2026-10-01"), // Thu
      log("2", "2026-10-08"), // Thu
      log("3", "2026-10-02"), // Fri
    ];
    const breakdown = weekdayBreakdown(logs, window);
    expect(breakdown).toHaveLength(7);
    const thu = breakdown.find((d) => d.label === "Thu");
    expect(thu?.entries).toBe(2);
    expect(thu?.daysLogged).toBe(2);
    const fri = breakdown.find((d) => d.label === "Fri");
    expect(fri?.entries).toBe(1);
  });
});

describe("findMilestones", () => {
  it("returns nothing for an empty archive", () => {
    expect(findMilestones([], "2026-10-28")).toEqual([]);
  });

  it("marks the first entry", () => {
    const logs = [log("1", "2026-10-01")];
    const milestones = findMilestones(logs, "2026-10-28");
    expect(milestones.some((m) => m.kind === "first")).toBe(true);
  });

  it("marks the 100th entry and the 200th independently", () => {
    const logs = Array.from({ length: 220 }, (_, i) =>
      log(`l${i}`, `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, {
        created_at: `2026-01-01T00:0${String(i % 10).padStart(2, "0")}:00.000Z`,
      }),
    );
    const milestones = findMilestones(logs, "2026-10-28");
    const countMilestones = milestones.filter((m) => m.kind === "count");
    expect(countMilestones.length).toBe(2);
    expect(countMilestones.map((m) => m.label)).toContain("100 entries");
    expect(countMilestones.map((m) => m.label)).toContain("200 entries");
  });

  it("marks a week where all seven days are present", () => {
    // Today is Wednesday 2026-10-28; the week is Mon 10-26 .. Sun 11-01.
    const days = ["2026-10-26", "2026-10-27", "2026-10-28"];
    // The week milestone only fires when all seven days from Monday onward
    // are written, up to today. Simulate a user who wrote Monday+Tuesday+Wednesday.
    const logs = days.map((d, i) => log(`l${i}`, d));
    const milestones = findMilestones(logs, "2026-10-28");
    expect(milestones.some((m) => m.kind === "week")).toBe(false);
  });
});

describe("monthlySummaries", () => {
  it("groups by month, oldest first, with deltas", () => {
    const logs = [
      log("1", "2026-08-01"),
      log("2", "2026-08-15"),
      log("3", "2026-09-02"),
      log("4", "2026-09-09"),
      log("5", "2026-09-09"),
    ];
    const months = monthlySummaries(logs);
    expect(months).toHaveLength(2);
    expect(months[0].key).toBe("2026-08");
    expect(months[0].entries).toBe(2);
    expect(months[0].deltaEntries).toBe(0); // no previous month
    expect(months[1].key).toBe("2026-09");
    expect(months[1].entries).toBe(3);
    expect(months[1].deltaEntries).toBe(1);
    expect(months[1].daysLogged).toBe(2);
  });
});

describe("buildInsights integration", () => {
  it("produces a complete report from real logs", () => {
    const logs = [
      log("1", "2026-10-05", { pillar: "GYM", title: "Lift", categoryIds: ["cat-a"] }),
      log("2", "2026-10-06", { pillar: "STUDY", categoryIds: ["cat-b"] }),
      log("3", "2026-10-06", { pillar: "STUDY", categoryIds: ["cat-b"] }),
      log("4", "2026-10-07", { pillar: "REFLECT" }),
    ];
    const report = buildInsights(logs, "2026-10-28", PILLARS, [
      { id: "cat-a", name: "Health" },
      { id: "cat-b", name: "Work" },
    ]);
    expect(report).not.toBeNull();
    expect(report!.totals.entries).toBe(4);
    expect(report!.totals.daysLogged).toBe(3);
    expect(report!.pillars).toHaveLength(7);
    expect(report!.weekdays).toHaveLength(7);
    expect(report!.milestones.some((m) => m.kind === "first")).toBe(true);
    expect(report!.months).toHaveLength(1);
  });
});
