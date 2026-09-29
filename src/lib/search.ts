/**
 * Input rules for the archive search box. Deliberately dependency-free and
 * framework-free, like log-input.ts, so the page that reads ?q= and the DAL
 * that queries it cannot disagree about what a usable query is.
 *
 * Nothing here reads a session or a user id. The query is a bag of words, not
 * an authority: it carries no ownership, and RLS still decides which rows it
 * can reach.
 */

/**
 * The ceiling on one query. A search box is for finding a remembered phrase,
 * and a URL is not a good place to put a novel — the bound keeps the request
 * line and the tsquery itself to a sane size. It is well past anything a
 * person types to find an entry in their own archive.
 */
export const SEARCH_QUERY_MAX_LENGTH = 200;

/**
 * A query ready to be sent to the database, or null when there is nothing to
 * search for.
 *
 * Trimming and the length cap live here rather than at the query site so that
 * `?q=%20%20` and `?q=push+day` take the same path as what was typed: an
 * absent query and a blank one are both "no search yet", never a round trip
 * that returns an empty tsquery matching nothing.
 */
export function normalizeSearchQuery(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim().slice(0, SEARCH_QUERY_MAX_LENGTH);

  return trimmed === "" ? null : trimmed;
}
