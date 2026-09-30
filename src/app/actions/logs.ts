"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { getPillars } from "@/lib/logs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CATEGORY_NAME_MAX_LENGTH,
  isUuid,
  todayIso,
  validateLogInput,
  type LogFormErrors,
  type LogFormState,
  type LogInput,
} from "@/lib/log-input";

/**
 * Every entry point here re-checks the session before touching a row, even
 * though the page that renders the form already did: a Server Action is a
 * public POST endpoint and can be invoked directly, with a forged id, by
 * anyone who knows the URL. Authorization itself is RLS, not this file — the
 * anon client carries the caller's JWT, and no statement below sends a
 * user_id, so the database is what refuses a row that is not the caller's.
 */

const UNIQUE_VIOLATION = "23505";

type SaveResult =
  | { ok: true; id: string }
  | { ok: false; errors: LogFormErrors };

export async function createLog(
  _previous: LogFormState,
  formData: FormData,
): Promise<LogFormState> {
  await requireUser();

  let result: SaveResult;
  try {
    result = await saveLog(null, formData);
  } catch {
    return { errors: { form: "The log could not be saved. Try again." } };
  }

  if (!result.ok) {
    return { errors: result.errors };
  }

  revalidatePath("/app", "layout");
  redirect(`/app/logs/${result.id}`);
}

export async function updateLog(
  _previous: LogFormState,
  formData: FormData,
): Promise<LogFormState> {
  await requireUser();

  const logId = readString(formData, "log_id");
  if (!isUuid(logId)) {
    return { errors: { form: "That log could not be found." } };
  }

  let result: SaveResult;
  try {
    result = await saveLog(logId, formData);
  } catch {
    return { errors: { form: "The log could not be saved. Try again." } };
  }

  if (!result.ok) {
    return { errors: result.errors };
  }

  revalidatePath("/app", "layout");
  redirect(`/app/logs/${result.id}`);
}

export async function deleteLog(formData: FormData): Promise<void> {
  await requireUser();

  const logId = readString(formData, "log_id");
  if (isUuid(logId)) {
    const supabase = await createSupabaseServerClient();
    // The log_categories rows go with it: the join table's foreign key to
    // logs is ON DELETE CASCADE, so retagging and cleanup stay in one place.
    await supabase.from("logs").delete().eq("id", logId).select("id");
  }

  revalidatePath("/app", "layout");
  redirect("/app");
}

/**
 * Shared by create and edit. `existingId` is null for a new entry. Returns
 * field errors rather than throwing so the form can show them next to the
 * inputs the user has to fix.
 */
async function saveLog(
  existingId: string | null,
  formData: FormData,
): Promise<SaveResult> {
  const supabase = await createSupabaseServerClient();

  const input = readLogInput(formData);
  const pillarKeys = (await getPillars()).map((pillar) => pillar.key);
  const errors = validateLogInput(input, pillarKeys);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  if (existingId !== null && !(await logExists(supabase, existingId))) {
    return { ok: false, errors: { form: "That log no longer exists." } };
  }

  const categories = await prepareCategories(supabase, input);
  if (categories.error) {
    return { ok: false, errors: { categories: categories.error } };
  }

  const row = {
    logged_on: input.loggedOn,
    pillar: input.pillar === "" ? null : input.pillar,
    title: input.title === "" ? null : input.title,
    body: input.body.trim(),
  };

  let id = existingId;

  if (id === null) {
    const { data, error } = await supabase
      .from("logs")
      .insert(row)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { ok: false, errors: { form: "The log could not be saved." } };
    }

    id = (data as { id: string }).id;
  } else {
    const { data, error } = await supabase
      .from("logs")
      .update(row)
      .eq("id", id)
      .select("id");

    if (error) {
      return { ok: false, errors: { form: "The log could not be saved." } };
    }

    // RLS filtered the update: no row back means it is not the caller's log
    // (or it has since been deleted), which is not something to report as a
    // successful save.
    if (!data || data.length === 0) {
      return { ok: false, errors: { form: "That log no longer exists." } };
    }
  }

  // Retagging is delete-then-insert by design: the join table carries no
  // updatable column and has no UPDATE policy.
  const { error: clearError } = await supabase
    .from("log_categories")
    .delete()
    .eq("log_id", id);

  if (clearError) {
    return { ok: false, errors: { form: "The categories could not be updated." } };
  }

  if (categories.ids.length > 0) {
    const { error: linkError } = await supabase
      .from("log_categories")
      .insert(
        categories.ids.map((category_id) => ({ log_id: id, category_id })),
      );

    if (linkError) {
      if (existingId === null) {
        // A new entry is all-or-nothing: do not leave a log behind that has
        // lost the categories the user just wrote.
        await supabase.from("logs").delete().eq("id", id);
      }
      return {
        ok: false,
        errors: {
          form: "The log was saved, but its categories could not be attached.",
        },
      };
    }
  }

  return { ok: true, id };
}

/**
 * The categories a save should end up with: the ones already checked, plus a
 * new one typed into the form. Every id is proved to belong to the caller
 * before it is attached, so a hand-crafted request cannot borrow somebody
 * else's label (and with it, its name, which a join would disclose).
 */
async function prepareCategories(
  supabase: SupabaseClient,
  input: LogInput,
): Promise<{ ids: string[]; error?: string }> {
  const ids = new Set<string>();

  for (const raw of input.categoryIds) {
    const id = raw.trim();
    if (id === "") {
      continue;
    }
    if (!isUuid(id)) {
      return { ids: [], error: "One of the selected categories is not valid." };
    }
    ids.add(id);
  }

  if (input.newCategory !== "") {
    const created = await ensureCategory(supabase, input.newCategory);
    if ("error" in created) {
      return { ids: [], error: created.error };
    }
    ids.add(created.id);
  }

  if (ids.size === 0) {
    return { ids: [] };
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .in("id", [...ids]);

  if (error) {
    return { ids: [], error: "Your categories could not be read." };
  }

  // RLS means this query can only ever return the caller's own categories, so
  // a foreign id shows up as a count that does not add up.
  if ((data ?? []).length !== ids.size) {
    return { ids: [], error: "One or more categories are not yours." };
  }

  return { ids: [...ids] };
}

/**
 * Inline category creation. Ownership is assigned by the set_user_id trigger,
 * not by anything sent here. A name that already exists for this user is
 * reused rather than refused: the schema allows one name per user, and
 * re-using it is what the user meant.
 */
async function ensureCategory(
  supabase: SupabaseClient,
  name: string,
): Promise<{ id: string } | { error: string }> {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { error: "A category needs a name." };
  }

  if (trimmed.length > CATEGORY_NAME_MAX_LENGTH) {
    return {
      error: `Keep a category name under ${CATEGORY_NAME_MAX_LENGTH} characters.`,
    };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: trimmed })
    .select("id")
    .maybeSingle();

  if (!error && data) {
    return { id: (data as { id: string }).id };
  }

  if (error?.code !== UNIQUE_VIOLATION) {
    return { error: "That category could not be created." };
  }

  const existing = await findCategoryByName(supabase, trimmed);
  if (existing === null) {
    return { error: "That category could not be created." };
  }

  return { id: existing };
}

/**
 * The uniqueness index is on lower(name), so the match is case-insensitive.
 * ilike expresses the same comparison through PostgREST; the pattern is
 * escaped so a name containing % or _ still matches itself.
 */
async function findCategoryByName(
  supabase: SupabaseClient,
  name: string,
): Promise<string | null> {
  const pattern = name.replace(/[\\%_]/g, (character) => `\\${character}`);

  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .ilike("name", pattern)
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data as { id: string } | null)?.id ?? null;
}

async function logExists(
  supabase: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("logs")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  return !error && Boolean(data);
}

function readLogInput(formData: FormData): LogInput {
  return {
    // A blank day means "today". The form pre-fills the user's own calendar
    // day; this is the fallback for a submission that arrives without one.
    loggedOn: readString(formData, "logged_on") || todayIso(),
    pillar: readString(formData, "pillar").trim(),
    title: readString(formData, "title").trim(),
    body: readString(formData, "body"),
    categoryIds: readStrings(formData, "category_ids"),
    newCategory: readString(formData, "new_category").trim(),
  };
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readStrings(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string =>
    typeof value === "string",
  );
}
