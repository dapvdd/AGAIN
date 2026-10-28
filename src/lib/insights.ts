/**
 * Personal insights — the archive measured for meaning, not for streaks.
 *
 * Everything here is a pure function of (logs, today), dependency-free and
 * framework-free like calendar.ts and consistency.ts. Every number the page
 * draws comes from one of these functions applied to the user's real logged
 * data; nothing is inferred, guessed, or extrapolated, so every insight can be
 * explained by pointing at the records it came from.
 *
 * Design guardrails, written down because they are the point:
 * - No manipulative streak mechanics: streaks exist, but they are shown as
 *   measurements with their date ranges, never as "don't break the chain"
 *   guilt. Days are compared, not judged.
 * - No guilt-based messaging: an empty day is not a failure, so no red marks,
 *   no "you missed X days", no shame.
 * - No unsupported psychological interpretation: we count what the user wrote,
 *   we never psychoanalyze the words. No sentiment analysis, no personality
 *   claims, no "you seem down" guesses.
 * - Everything is explainable: each insight block lists the source window
 *   (the specific dates) it was computed from.
 */
import {
  addDays,
  daysBetween,
  startOfWeek,
  weekdayIndex,
} from "@/lib/calendar";

/**
 * A minimal view of a log that carries only what the insights need. The page
 * passes the full LogWithCategories rows; this keeps the pure module decoupled
 * from the DAL and its types.
 */
export interface InsightLog {
  id: string;
  logged_on: string;
  pillar: string | null;
  title: string | null;
  body: string;
  created_at: string;
  categoryIds?: string[];
}

export interface InsightWindow {
  /** `YYYY-MM-DD` lower bound, inclusive. */
  start: string;
  /** `YYYY-MM-DD` upper bound, inclusive. */
  end: string;
}

/** The last `weeks` whole weeks ending in today's week (Monday-Sunday). */
export function insightWindow(today: string, weeks: number): InsightWindow | null {
  const anchor = startOfWeek(today);
  if (anchor === null) {
    return null;
  }
  const start = addDays(anchor, -(weeks - 1) * 7);
  if (start === null) {
    return null;
  }
  return { start, end: today };
}

export interface InsightTotals {
  window: InsightWindow;
  days: number;
  daysLogged: number;
  entries: number;
  /** entries per logged day, 0 when no days were logged. */
  entriesPerDay: number;
  /** Days between the user's first log and last log, inclusive. */
  spanDays: number;
  /** The user's first-ever log date, if any. */
  firstLog: string | null;
  lastLog: string | null;
}

export function summarizeTotals(logs: ReadonlyArray<InsightLog>, window: InsightWindow): InsightTotals {
  const windowDays = new Set<string>();
  const entries = logs.filter((log) => log.logged_on >= window.start && log.logged_on <= window.end);
  const loggedDays = new Set(entries.map((log) => log.logged_on));
  for (const log of entries) {
    windowDays.add(log.logged_on);
  }

  let earliest: string | null = null;
  let latest: string | null = null;
  for (const log of logs) {
    if (earliest === null || log.logged_on < earliest) earliest = log.logged_on;
    if (latest === null || log.logged_on > latest) latest = log.logged_on;
  }

  const days = windowDays.size;
  const daysLogged = loggedDays.size;

  return {
    window,
    days,
    daysLogged,
    entries: entries.length,
    entriesPerDay: daysLogged === 0 ? 0 : Number((entries.length / daysLogged).toFixed(1)),
    spanDays: earliest === null || latest === null ? 0 : daysBetween(earliest, latest),
    firstLog: earliest,
    lastLog: latest,
  };
}

export interface PillarInsight {
  key: string;
  label: string;
  entries: number;
  daysLogged: number;
  /** dates written, for linking to history */
  days: string[];
  /** 0..1 consistency across the window (days present / window.days, capped at 1) */
  consistency: number;
}

/**
 * Per-pillar breakdown. The seven pillars are fixed reference data; a pillar
 * with zero entries is still reported (consistency 0), a pillar is never
 * punished and a name is never invented.
 */
export function pillarBreakdown(
  logs: ReadonlyArray<InsightLog>,
  window: InsightWindow,
  pillars: ReadonlyArray<{ key: string; label: string }>,
): PillarInsight[] {
  const windowStart = window.start;
  // How many calendar days the window spans — used as the denominator for a
  // pillar's consistency, so it is "days written / days elapsed", never judged.
  const windowDays = daysBetween(window.start, window.end);
  const result: PillarInsight[] = [];

  for (const pillar of pillars) {
    const matching = logs.filter(
      (log) => log.pillar === pillar.key && log.logged_on >= windowStart && log.logged_on <= window.end,
    );
    const days = [...new Set(matching.map((log) => log.logged_on))];
    result.push({
      key: pillar.key,
      label: pillar.label,
      entries: matching.length,
      daysLogged: days.length,
      days,
      consistency: windowDays === 0 ? 0 : days.length / windowDays,
    });
  }

  return result;
}

export interface CategoryInsight {
  id: string;
  name: string;
  entries: number;
  daysLogged: number;
}

/** The caller's own categories, ordered by most-used first. */
export function categoryBreakdown(
  logs: ReadonlyArray<InsightLog>,
  window: InsightWindow,
  categories: ReadonlyArray<{ id: string; name: string }>,
): CategoryInsight[] {
  return categories
    .map((category) => {
      const matching = logs.filter(
        (log) =>
          log.logged_on >= window.start &&
          log.logged_on <= window.end &&
          (log.categoryIds?.includes(category.id) ?? false),
      );
      const days = new Set(matching.map((log) => log.logged_on));
      return {
        id: category.id,
        name: category.name,
        entries: matching.length,
        daysLogged: days.size,
      } satisfies CategoryInsight;
    })
    .sort((a, b) => b.entries - a.entries || a.name.localeCompare(b.name));
}

export interface WeekdayInsight {
  /** 0 = Monday .. 6 = Sunday. */
  index: number;
  label: string;
  entries: number;
  daysLogged: number;
}

/** Which weekdays the user actually writes on, from real data only. */
export function weekdayBreakdown(
  logs: ReadonlyArray<InsightLog>,
  window: InsightWindow,
): WeekdayInsight[] {
  const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
  const counts = LABELS.map((label, index) => ({ index, label, entries: 0, daysLogged: 0 }) as WeekdayInsight);
  const loggedDays = new Set<string>();

  for (const log of logs) {
    if (log.logged_on < window.start || log.logged_on > window.end) continue;
    const dateKey = log.logged_on;
    const idx = weekdayIndexOf(dateKey);
    if (idx === null) continue;
    counts[idx].entries += 1;
    if (!loggedDays.has(dateKey)) {
      loggedDays.add(dateKey);
      counts[idx].daysLogged += 1;
    }
  }

  return counts;
}

/** 0 = Monday .. 6 = Sunday, or null for unparseable input (never reached, because parseDate is strict). */
function weekdayIndexOf(date: string): number | null {
  return weekdayIndex(date);
}

/**
 * A milestone: a first, a landmark, a reignited habit. Found from the user's
 * actual records, never invented. Each returns the log that made it, so the
 * page can link straight to the proof.
 */
export interface Milestone {
  kind: string;
  label: string;
  /** The log that earned it. */
  log: InsightLog;
  /** A human sentence shown to the user. */
  message: string;
}

export function findMilestones(
  logs: ReadonlyArray<InsightLog>,
  today: string,
): Milestone[] {
  const milestones: Milestone[] = [];
  if (logs.length === 0) {
    return milestones;
  }

  const ordered = [...logs].sort((a, b) =>
    a.logged_on === b.logged_on
      ? a.created_at.localeCompare(b.created_at)
      : a.logged_on.localeCompare(b.logged_on),
  );

  // 1. First entry ever
  milestones.push({
    kind: "first",
    label: "First entry",
    log: ordered[0],
    message: "The archive began.",
  });

  // 2. Every hundredth entry (100, 200, …) — counting entries, not days.
  const hundreds = Math.floor(ordered.length / 100);
  for (let hundred = 1; hundred <= hundreds; hundred += 1) {
    const milestoneLog = ordered[hundred * 100 - 1];
    if (milestoneLog) {
      milestones.push({
        kind: "count",
        label: `${hundred * 100} entries`,
        log: milestoneLog,
        message: `You wrote ${hundred * 100}.`,
      });
    }
  }

  // 3. A full calendar week written (7 distinct days within one week).
  const week = startOfWeek(today);
  if (week !== null) {
    const daysThisWeek = new Set(
      ordered
        .filter((log) => log.logged_on >= week && log.logged_on <= today)
        .map((log) => log.logged_on),
    );
    if (daysThisWeek.size >= 7) {
      milestones.push({
        kind: "week",
        label: "A full week",
        log: ordered[ordered.length - 1],
        message: "Every day of this week is in the archive.",
      });
    }
  }

  return milestones;
}

export interface MonthSummary {
  /** `YYYY-MM`. */
  key: string;
  label: string;
  entries: number;
  daysLogged: number;
  /** change vs previous month's entries, 0 when there is no previous month */
  deltaEntries: number;
}

/** One summary per month that has at least one log, oldest first, with the change from its predecessor. */
export function monthlySummaries(logs: ReadonlyArray<InsightLog>): MonthSummary[] {
  const byMonth = new Map<string, { entries: number; days: Set<string> }>();
  for (const log of logs) {
    const key = log.logged_on.slice(0, 7);
    let bucket = byMonth.get(key);
    if (!bucket) {
      bucket = { entries: 0, days: new Set() };
      byMonth.set(key, bucket);
    }
    bucket.entries += 1;
    bucket.days.add(log.logged_on);
  }

  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  return months.map(([key, bucket], index) => {
    const previous = index > 0 ? months[index - 1][1].entries : null;
    return {
      key,
      label: monthKeyLabel(key),
      entries: bucket.entries,
      daysLogged: bucket.days.size,
      deltaEntries: previous === null ? 0 : bucket.entries - previous,
    };
  });
}

export interface InsightReport {
  totals: InsightTotals;
  pillars: PillarInsight[];
  categories: CategoryInsight[];
  weekdays: WeekdayInsight[];
  milestones: Milestone[];
  months: MonthSummary[];
}

export function buildInsights(
  logs: ReadonlyArray<InsightLog>,
  today: string,
  pillars: ReadonlyArray<{ key: string; label: string }>,
  categories: ReadonlyArray<{ id: string; name: string }>,
  weeks = 12,
): InsightReport | null {
  const window = insightWindow(today, weeks);
  if (window === null) {
    return null;
  }

  return {
    totals: summarizeTotals(logs, window),
    pillars: pillarBreakdown(logs, window, pillars),
    categories: categoryBreakdown(logs, window, categories),
    weekdays: weekdayBreakdown(logs, window),
    milestones: findMilestones(logs, today),
    months: monthlySummaries(logs),
  };
}

// --- small calendar/common helpers (locally kept so the module is standalone) ---

function monthKeyLabel(key: string): string {
  const m = parseInt(key.slice(5, 7), 10);
  const y = parseInt(key.slice(0, 4), 10);
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  if (m < 1 || m > 12) return key;
  return `${names[m - 1]} ${y}`;
}
