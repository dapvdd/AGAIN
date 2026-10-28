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

export const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar month. `month` is 1..12, never 0. */
export interface CalendarMonth {
  year: number;
  month: number;
}

/** A calendar day, unpacked. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
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

/**
 * Unpacks a `YYYY-MM-DD` day. The pattern alone would accept "2026-02-30", so
 * the parts are checked against the real length of the month: a day that does
 * not exist is not a day, and silently rolling it into March would move the
 * whole grid.
 */
export function parseDate(value: string): CalendarDate | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) {
    return null;
  }

  if (day < 1 || day > daysInMonth({ year, month })) {
    return null;
  }

  return { year, month, day };
}

/**
 * Steps a day by any distance, in either direction, across leap years and
 * year boundaries: the last of December plus one is the first of January, and
 * the 29th of February plus one is the first of March.
 *
 * Days are counted rather than accumulated, so stepping a day 146 097 times
 * lands on the same weekday four hundred years later — which is exactly the
 * property a heat map needs and the reason this does not use `Date`. A
 * fractional or absurd step is not a day at all and is refused, because
 * truncating it silently would answer a different question.
 */
export function addDays(date: string, delta: number): string | null {
  const parsed = parseDate(date);
  if (!parsed || !Number.isInteger(delta) || !Number.isSafeInteger(delta)) {
    return null;
  }

  const { year, month, day } = civilFromDays(
    daysFromCivil(parsed.year, parsed.month, parsed.day) + delta,
  );

  // Four digits is the shape the rest of the app reads, so a step far enough
  // to leave it is refused rather than returned as a year nobody can parse.
  if (year < 0 || year > 9999) {
    return null;
  }

  return toDateString(year, month, day);
}

/**
 * The number of days from `start` (inclusive) to `end` (inclusive).
 * Used by the insights module to report the span between the user's first
 * and last log without re-importing the calendar arithmetic.
 */
export function daysBetween(start: string, end: string): number {
  const sp = parseDate(start);
  const ep = parseDate(end);
  if (sp === null || ep === null) {
    return 0;
  }
  return Math.abs(daysFromCivil(sp.year, sp.month, sp.day) - daysFromCivil(ep.year, ep.month, ep.day)) + 1;
}

/** Monday-first weekday index, 0 = Monday .. 6 = Sunday, as `WEEKDAY_LABELS`. */
export function weekdayIndex(date: string): number | null {
  const parsed = parseDate(date);
  if (!parsed) {
    return null;
  }

  return mondayIndex(daysFromCivil(parsed.year, parsed.month, parsed.day));
}

/** The Monday of the week a day falls in. */
export function startOfWeek(date: string): string | null {
  const index = weekdayIndex(date);
  return index === null ? null : addDays(date, -index);
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

/**
 * Days since 1970-01-01, counted rather than accumulated. This is the civil
 * calendar as arithmetic: 400-year eras of 146 097 days, 365-day years, and a
 * leap day every fourth year except the centuries. Integer maths on the
 * proleptic Gregorian calendar means the answer does not depend on a
 * timezone, a locale, or a `Date` that can be constructed with the wrong
 * month.
 */
function daysFromCivil(year: number, month: number, day: number): number {
  const shifted = month <= 2 ? year - 1 : year;
  const era = Math.floor(shifted / 400);
  const yearOfEra = shifted - era * 400;
  const dayOfYear =
    Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;

  return era * 146097 + dayOfEra - 719468;
}

/** The exact inverse of `daysFromCivil`. */
function civilFromDays(days: number): CalendarDate {
  const shifted = days + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra +
      Math.floor(yearOfEra / 4) -
      Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex + (monthIndex < 10 ? 3 : -9);

  return { year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** Monday-first weekday index, 0 = Monday .. 6 = Sunday. */
function mondayIndex(days: number): number {
  // Day 0 is Thursday 1970-01-01, which is index 3 on a Monday-first week.
  return (((days + 3) % 7) + 7) % 7;
}

/**
 * The rendered grid: whole Monday-to-Sunday weeks covering the month, with
 * the neighbours' days filling the first and last rows. The number of weeks
 * follows the month (four to six), so a short February does not render a
 * screen of empty cells.
 */
export function calendarWeeks(month: CalendarMonth): CalendarDay[][] {
  const length = daysInMonth(month);
  const leading = mondayIndex(
    daysFromCivil(month.year, month.month, 1),
  );
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
