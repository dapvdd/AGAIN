/**
 * Input rules shared by the log forms and the Server Actions that persist
 * them. Deliberately dependency-free and framework-free: the client uses the
 * length constants for its own affordances (maxlength, hints) and the server
 * uses the same predicates, so the browser and the database agree on what a
 * valid entry is. The database constraints remain the final backstop; this
 * module exists so the user is told what is wrong instead of being rejected
 * by a check violation.
 *
 * Nothing here reads a session or a user id. Ownership is decided by the
 * authenticated session and by RLS, never by a value that arrives in a form.
 */

export const TITLE_MAX_LENGTH = 140;
export const BODY_MAX_LENGTH = 20_000;
export const CATEGORY_NAME_MAX_LENGTH = 60;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * A calendar day in the exact form PostgreSQL's `date` type expects. The
 * round-trip through Date.UTC is what rejects "2026-02-30": the pattern alone
 * would happily accept it.
 */
export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Today as a `date` literal, for the server-side default. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface LogInput {
  loggedOn: string;
  /** Empty string means "no pillar"; the form's "None" choice. */
  pillar: string;
  title: string;
  body: string;
  categoryIds: string[];
  newCategory: string;
}

export type LogFormField =
  | "loggedOn"
  | "pillar"
  | "title"
  | "body"
  | "categories"
  | "form";

export type LogFormErrors = Partial<Record<LogFormField, string>>;

export interface LogFormState {
  errors: LogFormErrors;
}

export const EMPTY_LOG_FORM_STATE: LogFormState = { errors: {} };

/**
 * Server-authoritative validation. `pillarKeys` is the set of pillars the
 * database actually holds, so a value the client invented cannot be stored
 * even if the compass ever changes.
 */
export function validateLogInput(
  input: LogInput,
  pillarKeys: readonly string[],
): LogFormErrors {
  const errors: LogFormErrors = {};

  if (!isDateOnly(input.loggedOn)) {
    errors.loggedOn = "Pick a real day.";
  }

  if (input.pillar !== "" && !pillarKeys.includes(input.pillar)) {
    errors.pillar = "That is not one of the seven pillars.";
  }

  if (input.title.length > TITLE_MAX_LENGTH) {
    errors.title = `Keep the title under ${TITLE_MAX_LENGTH} characters.`;
  }

  const body = input.body.trim();
  if (body.length === 0) {
    errors.body = "Write something. An entry without words is not an entry.";
  } else if (body.length > BODY_MAX_LENGTH) {
    errors.body = `Keep the note under ${BODY_MAX_LENGTH} characters.`;
  }

  if (input.newCategory.length > CATEGORY_NAME_MAX_LENGTH) {
    errors.categories = `Keep a category name under ${CATEGORY_NAME_MAX_LENGTH} characters.`;
  }

  if (input.categoryIds.some((id) => !isUuid(id))) {
    errors.categories = "One of the selected categories is not valid.";
  }

  return errors;
}
