/**
 * Input rules for the category surface. Deliberately dependency-free and
 * framework-free, like log-input.ts and search.ts, so the component that draws
 * the form and the Server Actions that persist it cannot disagree about what a
 * usable category name is. The database constraints in
 * 20260927000100_core_domain.sql (`btrim(name) <> ''`, `char_length(name) <=
 * 60`) remain the backstop; this module exists so the user is told what is
 * wrong instead of being refused by a check violation.
 *
 * Nothing here reads a session or a user id. Ownership is decided by the
 * authenticated session and by RLS, never by a value that arrives in a form.
 */

// Re-exported rather than moved: the constant already belongs to the log form's
// input rules, and the log form still imports it from there. The category
// surface gets one import site of its own without moving anything.
import { CATEGORY_NAME_MAX_LENGTH } from "@/lib/log-input";

export { CATEGORY_NAME_MAX_LENGTH };

export interface CategoryErrors {
  /** A problem with the name the user typed. */
  name?: string;
  /** A problem with the request rather than the name. */
  form?: string;
}

/**
 * What a category write hands back to the form.
 *
 * `saved` rather than an empty error object: a form that collapses or clears
 * itself on success needs to tell a completed write from a render it has not
 * submitted yet, and an errors object is empty in both cases. Keeping that
 * distinction in the value means the form never has to guess.
 */
export type CategoryResult =
  | { ok: true; saved: boolean }
  | { ok: false; errors: CategoryErrors };

export const INITIAL_CATEGORY_RESULT: CategoryResult = { ok: true, saved: false };

/**
 * The message for a name the user rejected, or null when the name is usable.
 *
 * Case-insensitive uniqueness is *not* checked here. It is decided by the
 * `categories_user_lower_name_key` index, so a pre-check would be a race that
 * two requests can both pass; the write below is what reports the collision.
 */
export function validateCategoryName(raw: string): string | null {
  const name = raw.trim();

  if (name === "") {
    return "A category needs a name.";
  }

  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    return `Keep a category name under ${CATEGORY_NAME_MAX_LENGTH} characters.`;
  }

  return null;
}
