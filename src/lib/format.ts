/**
 * Display formatting. Deterministic by construction: a fixed locale and an
 * explicit time zone, so the same value always renders the same string and a
 * server timezone never leaks into the archive.
 */

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const MOMENT_FORMAT = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** `2026-09-29` -> `Tue, Sep 29, 2026`. */
export function formatLoggedOn(loggedOn: string): string {
  const date = new Date(`${loggedOn}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return loggedOn;
  }
  return DAY_FORMAT.format(date);
}

/**
 * The first non-blank line of a note, so an untitled entry still deserves a
 * heading in a list. Shared by the log list, history's day list, and search
 * results, which previously each carried their own copy.
 */
export function firstLine(body: string): string {
  const line = body.split("\n").find((candidate) => candidate.trim() !== "");
  return (line ?? body).trim();
}

/**
 * Number word: the singular for one, plain digits otherwise, in the shape the
 * archive's labels already use ("1 log", "3 logs", "150 entries").
 */
export function countWord(options: {
  count: number;
  singular: string;
  plural?: string;
}): string {
  const plural = options.plural ?? `${options.singular}s`;
  return options.count === 1 ? options.singular : plural;
}

/**
 * searchParams values arrive as `string | string[] | undefined`; a repeated or
 * malformed one is treated as absent rather than guessed at. The same rule the
 * archive pages were already applying, in one place.
 */
export function singleParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** An ISO timestamp -> `Sep 29, 2026, 21:04 UTC`. */
export function formatMoment(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return `${MOMENT_FORMAT.format(date)} UTC`;
}
