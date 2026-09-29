/**
 * Consistency, as arithmetic.
 *
 * Deliberately dependency-free and framework-free, like log-input.ts and
 * calendar.ts: the page draws this and the DAL feeds it, and neither can
 * disagree about what a streak is. Everything is a pure function of the days
 * that hold at least one log plus today's date, so the same archive always
 * draws the same grid.
 *
 * A missed day is not a failure. The current streak is measured from today
 * when today is written and from yesterday when it is not, because a day that
 * is not over yet cannot break anything. Nothing here reads a session, a user
 * id, or a query string: ownership is the DAL's problem and RLS's.
 */

import {
  addDays,
  addMonths,
  formatMonth,
  monthOfDate,
  startOfWeek,
} from "@/lib/calendar";

/**
 * Columns in the heat map. Half a year is long enough to show a habit forming
 * and short enough to stay one screen wide; a full year of squares is a scroll
 * nobody makes on a phone.
 */
export const CONSISTENCY_WEEKS = 26;

export interface ConsistencyDay {
  /** `YYYY-MM-DD`. */
  date: string;
  day: number;
  /** Logs on this day, already clamped to zero for days that have not happened. */
  count: number;
  /** After today: an unfinished week, not a blank one. */
  future: boolean;
  isToday: boolean;
}

export interface ConsistencyWeek {
  /** Monday of this column. */
  start: string;
  days: ConsistencyDay[];
}

export interface Consistency {
  weeks: ConsistencyWeek[];
  /** Consecutive written days ending today, or ending yesterday if today is still open. */
  currentStreak: number;
  /** The longest run of written days inside the window. */
  longestStreak: number;
  /** Days inside the window, up to today, holding at least one log. */
  daysLogged: number;
  /** Every log in the window, not only the days that hold them. */
  entriesLogged: number;
  /** Entries logged this month and last month, for the month-on-month line. */
  thisMonth: number;
  lastMonth: number;
  /** The first day the grid can mark. */
  windowStart: string;
  /** Days the window spans, days that have not happened yet included. */
  windowDays: number;
}

/**
 * The range the heat map covers: whole Monday-to-Sunday weeks, the same shape
 * History draws, ending with the week that today falls in. The upper bound is
 * exclusive so the caller can hand it straight to a range predicate.
 *
 * Exposed separately from the grid so the page can ask the database for
 * exactly these days and nothing else.
 */
export function consistencyWindow(
  today: string,
): { start: string; endExclusive: string } | null {
  const anchor = startOfWeek(today);
  if (anchor === null) {
    return null;
  }

  const start = addDays(anchor, -(CONSISTENCY_WEEKS - 1) * 7);
  const endExclusive = addDays(anchor, 7);

  if (start === null || endExclusive === null) {
    return null;
  }

  return { start, endExclusive };
}

/**
 * The heat map and the numbers under it.
 *
 * `counts` maps a day to how many logs it holds; days that are absent are
 * simply days with nothing written, which is the normal case rather than an
 * error. ISO days sort correctly as plain strings, which is why the walk
 * below can compare them directly and never construct a `Date`.
 */
export function buildConsistency(
  counts: ReadonlyMap<string, number>,
  today: string,
): Consistency {
  const window = consistencyWindow(today);

  if (window === null) {
    return emptyConsistency(today);
  }

  const thisMonth = monthOfDate(today);
  const lastMonth =
    thisMonth === null ? null : addMonths(thisMonth, -1);
  const thisMonthKey = thisMonth === null ? null : formatMonth(thisMonth);
  const lastMonthKey = lastMonth === null ? null : formatMonth(lastMonth);

  const days: ConsistencyDay[] = [];
  let daysLogged = 0;
  let entriesLogged = 0;
  let thisMonthEntries = 0;
  let lastMonthEntries = 0;
  let run = 0;
  let longestStreak = 0;

  for (let index = 0; index < CONSISTENCY_WEEKS * 7; index += 1) {
    const date = addDays(window.start, index);
    if (date === null) {
      return emptyConsistency(today);
    }

    // A day that has not happened cannot hold a log, whatever the archive says.
    const future = date > today;
    const count = future ? 0 : (counts.get(date) ?? 0);

    days.push({
      date,
      day: Number(date.slice(8, 10)),
      count,
      future,
      isToday: date === today,
    });

    if (future) {
      // An unfinished week breaks nothing and contributes nothing.
      run = 0;
      continue;
    }

    if (count > 0) {
      daysLogged += 1;
      entriesLogged += count;
      run += 1;
      if (run > longestStreak) {
        longestStreak = run;
      }
    } else {
      run = 0;
    }

    const monthKey = date.slice(0, 7);
    if (monthKey === thisMonthKey) {
      thisMonthEntries += count;
    } else if (monthKey === lastMonthKey) {
      lastMonthEntries += count;
    }
  }

  return {
    weeks: chunk(days),
    currentStreak: currentStreak(days),
    longestStreak,
    daysLogged,
    entriesLogged,
    thisMonth: thisMonthEntries,
    lastMonth: lastMonthEntries,
    windowStart: window.start,
    windowDays: CONSISTENCY_WEEKS * 7,
  };
}

/**
 * How long the run is that ends now.
 *
 * Walking back from today, today itself is forgiven when it is still empty —
 * the day is not over — and the first genuinely missed day before it ends the
 * run. That is the whole difference between a streak and a punishment.
 */
function currentStreak(days: readonly ConsistencyDay[]): number {
  let streak = 0;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (day.future) {
      continue;
    }
    if (day.count > 0) {
      streak += 1;
      continue;
    }
    if (streak === 0 && day.isToday) {
      continue;
    }
    break;
  }

  return streak;
}

function chunk(days: readonly ConsistencyDay[]): ConsistencyWeek[] {
  const weeks: ConsistencyWeek[] = [];

  for (let index = 0; index < days.length; index += 7) {
    const slice = days.slice(index, index + 7);
    weeks.push({ start: slice[0].date, days: slice });
  }

  return weeks;
}

/**
 * A day the calendar cannot read has no window to draw. Returning an empty
 * measurement keeps the page honest instead of inventing a grid around a date
 * that was never real.
 */
function emptyConsistency(today: string): Consistency {
  return {
    weeks: [],
    currentStreak: 0,
    longestStreak: 0,
    daysLogged: 0,
    entriesLogged: 0,
    thisMonth: 0,
    lastMonth: 0,
    windowStart: today,
    windowDays: 0,
  };
}
