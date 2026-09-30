"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/log-input";
import {
  validateCategoryName,
  type CategoryErrors,
  type CategoryResult,
} from "@/lib/category-input";

/**
 * Every entry point here re-checks the session before touching a row, even
 * though the page that renders the form already did: a Server Action is a
 * public POST endpoint and can be invoked directly, with a forged id, by
 * anyone who knows the URL. Authorization itself is RLS, not this file — the
 * anon client carries the caller's JWT, nothing below ever sends a user_id,
 * and the set_user_id trigger assigns ownership on insert even if one were
 * supplied.
 *
 * Nothing below reports a database message back to the browser: PostgREST
 * errors name the table, the column, and the index, and a form is not the
 * place for a schema detail. Every failure is one of the fixed strings here.
 */

const UNIQUE_VIOLATION = "23505";

const NAME_TAKEN = "You already have a category with that name.";
const NOT_FOUND = "That category no longer exists.";

export async function createCategory(
  _previous: CategoryResult,
  formData: FormData,
): Promise<CategoryResult> {
  await requireUser();

  const name = readName(formData);
  const invalid = validateCategoryName(name);
  if (invalid !== null) {
    return fail({ name: invalid });
  }

  const supabase = await createSupabaseServerClient();

  // The name and nothing else. The unique index is on (user_id, lower(name)),
  // so "work" collides with "Work" for this user and with nobody else.
  const { error } = await supabase
    .from("categories")
    .insert({ name: name.trim() });

  if (error !== null) {
    return fail(
      error.code === UNIQUE_VIOLATION
        ? { name: NAME_TAKEN }
        : { form: "That category could not be created. Try again." },
    );
  }

  revalidateArchive();
  return { ok: true, saved: true };
}

export async function renameCategory(
  _previous: CategoryResult,
  formData: FormData,
): Promise<CategoryResult> {
  await requireUser();

  const categoryId = readString(formData, "category_id");
  if (!isUuid(categoryId)) {
    return fail({ form: NOT_FOUND });
  }

  const name = readName(formData);
  const invalid = validateCategoryName(name);
  if (invalid !== null) {
    return fail({ name: invalid });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name: name.trim() })
    .eq("id", categoryId)
    .select("id")
    .maybeSingle();

  if (error !== null) {
    return fail(
      error.code === UNIQUE_VIOLATION
        ? { name: NAME_TAKEN }
        : { form: "That category could not be renamed. Try again." },
    );
  }

  // RLS filtered the update: no row back means it is not the caller's category
  // (or it has since been deleted), which is not a rename to report as done.
  // A guessed id is therefore indistinguishable from a nonexistent one.
  if (data === null) {
    return fail({ form: NOT_FOUND });
  }

  // Renaming a category to its own name in another case ("Work" -> "work") is
  // not a collision: the index is on lower(name), and uniqueness only
  // conflicts with a *different* row, so the same row updating its own value
  // is accepted. No special case is needed, and none should be added.

  revalidateArchive();
  return { ok: true, saved: true };
}

/**
 * Removing a category removes the label and nothing else.
 *
 * The `log_categories` rows go with it — that table's foreign key to
 * categories is ON DELETE CASCADE — and `logs` holds no reference to a
 * category at all, so there is no path from this statement to a log row. The
 * entries that carried the tag keep every word they were written with; they
 * simply lose one label.
 *
 * A plain form action rather than one with state: a failed delete leaves the
 * row in the list the action re-renders, which is its own quiet answer and
 * needs no error message to be believed.
 */
export async function deleteCategory(formData: FormData): Promise<void> {
  await requireUser();

  const categoryId = readString(formData, "category_id");
  if (isUuid(categoryId)) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("categories").delete().eq("id", categoryId).select("id");
  }

  revalidateArchive();
}

/**
 * A category name is printed on the log list, on the log itself, in the
 * calendar's day list, in search results, and in the pickers on the new and
 * edit forms. One write changes what every page in the protected area says, so
 * all of them are revalidated together — the /app layout covers every page
 * beneath it, the same way signOut revalidates the root layout.
 */
function revalidateArchive(): void {
  revalidatePath("/app", "layout");
}

function fail(errors: CategoryErrors): CategoryResult {
  return { ok: false, errors };
}

function readName(formData: FormData): string {
  return readString(formData, "name");
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
