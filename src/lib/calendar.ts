/**
 * Calendar arithmetic, done with integers on purpose.
 *
 * Every function here is pure: no Date, no timezone, no locale. A month grid
 * is a pure function of (year, month), and building it that way means a
 * month boundary can never produce a day 0, a day 32, or a silent roll into
 * the wrong month — the class of bug that only shows up in December.
 *
 * The week starts on Monday, and month names are fixed rather than
 * formatted, so the same input always renders the same output.
 */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export const WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar month. `month` is 1..12, never 0. */
export interface CalendarMonth {
  year: number;
  month: number;
}

export interface CalendarDay {
  /** `YYYY-MM-DD`. */
  date: string;
  day: number;
  /** False for the leading and trailing days borrowed from the neighbours. */
  inMonth: boolean;
}

/** Parses `YYYY-MM`. Anything else is not a month. */
export function parseMonth(value: string | undefined | null): CalendarMonth | null {
  if (!value) {
    return null;
  }

  const match = MONTH_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  return { year: Number(match[1]), month: Number(match[2]) };
}

/** The month a `YYYY-MM-DD` day falls in. */
export function monthOfDate(value: string): CalendarMonth | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  return { year: Number(match[1]), month: Number(match[2]) };
}

export function formatMonth(month: CalendarMonth): string {
  return `${month.year}-${pad2(month.month)}`;
}

export function monthLabel(month: CalendarMonth): string {
  return `${MONTH_NAMES[month.month - 1]} ${month.year}`;
}

export function isSameMonth(a: CalendarMonth, b: CalendarMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(month: CalendarMonth): number {
  if (month.month === 2) {
    return isLeapYear(month.year) ? 29 : 28;
  }
  return MONTH_LENGTHS[month.month - 1];
}

/**
 * Steps a month by any distance, crossing year boundaries in both
 * directions: December plus one is January of the next year, and there is no
 * month zero to fall into.
 */
export function addMonths(month: CalendarMonth, delta: number): CalendarMonth {
  const zeroBased = month.year * 12 + (month.month - 1) + delta;
  const year = Math.floor(zeroBased / 12);
  const index = zeroBased - year * 12;

  return { year, month: index + 1 };
}

/** First day of the month, and the first day of the month after it. */
export function monthBounds(month: CalendarMonth): {
  start: string;
  endExclusive: string;
} {
  const next = addMonths(month, 1);

  return {
    start: toDateString(month.year, month.month, 1),
    endExclusive: toDateString(next.year, next.month, 1),
  };
}

/** Monday-first weekday index, 0 = Monday .. 6 = Sunday. */
function mondayIndex(year: number, month: number): number {
  // Date.UTC is used purely as a calendar calculator here; only the weekday
  // is read, and UTC has no daylight saving to disagree with.
  const weekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (weekday + 6) % 7;
}

/**
 * The rendered grid: whole Monday-to-Sunday weeks covering the month, with
 * the neighbours' days filling the first and last rows. The number of weeks
 * follows the month (four to six), so a short February does not render a
 * screen of empty cells.
 */
export function calendarWeeks(month: CalendarMonth): CalendarDay[][] {
  const length = daysInMonth(month);
  const leading = mondayIndex(month.year, month.month);
  const total = leading + length;
  const weekCount = Math.ceil(total / 7);
  const days: CalendarDay[] = [];

  for (let index = 0; index < weekCount * 7; index += 1) {
    const dayOffset = index - leading;

    // Before the first of the month: the tail of the previous month.
    if (dayOffset < 0) {
      const previous = addMonths(month, -1);
      const day = daysInMonth(previous) + dayOffset + 1;
      days.push({
        date: toDateString(previous.year, previous.month, day),
        day,
        inMonth: false,
      });
      continue;
    }

    if (dayOffset < length) {
      days.push({
        date: toDateString(month.year, month.month, dayOffset + 1),
        day: dayOffset + 1,
        inMonth: true,
      });
      continue;
    }

    // Past the last of the month: the head of the next one. Rolling through
    // addMonths rather than continuing the count is what keeps December from
    // inventing a 32nd.
    const next = addMonths(month, 1);
    const day = dayOffset - length + 1;
    days.push({
      date: toDateString(next.year, next.month, day),
      day,
      inMonth: false,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}
