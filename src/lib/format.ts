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

/** An ISO timestamp -> `Sep 29, 2026, 21:04 UTC`. */
export function formatMoment(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return `${MOMENT_FORMAT.format(date)} UTC`;
}
