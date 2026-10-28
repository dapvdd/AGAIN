/**
 * A safe in-app redirect target from a user-controllable `next` query string.
 *
 * Keeps the user on this host after an auth step. Two classic bypasses are
 * rejected outright:
 *   - scheme/protocol-relative targets — `//host` and `https://host` (the `//`
 *     prefix is caught, and `:` enforces "no scheme at all", covering
 *     `http://host`);
 *   - a leading backslash — browsers treat `/\host` as `//host` (the scheme-
 *     relative case again), so a target must not contain `\`.
 *
 * Everything else is accepted as-is and is guaranteed not to leave the origin
 * because it is returned as a relative path.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw === "") {
    return "/app";
  }
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/app";
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    return "/app";
  }
  return raw;
}
