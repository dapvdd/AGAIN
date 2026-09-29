import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/log-input";
import type { Category, Log, LogWithCategories, Pillar } from "@/lib/types";

/**
 * The only place that reads the domain tables.
 *
 * Every query runs as the signed-in user through the anon client, so Row
 * Level Security is what actually decides visibility: there is no
 * user_id filter to forget and no service-role key to fall back on. A row
 * belonging to somebody else is not an error here, it simply does not exist.
 */

const LOG_COLUMNS =
  "id, user_id, logged_on, pillar, title, body, created_at, updated_at";
const CATEGORY_COLUMNS = "id, user_id, name, created_at, updated_at";

const RECENT_LOGS_LIMIT = 20;

/** The seven fixed pillars, in compass order. */
export const getPillars = cache(async (): Promise<Pillar[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pillars")
    .select("key, label, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error("The pillar compass could not be read.");
  }

  return (data ?? []) as Pillar[];
});

/** The current user's own categories. RLS keeps it to theirs. */
export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Your categories could not be read.");
  }

  return (data ?? []) as Category[];
});

/** The user's archive, newest day first, with the newest entry of a day on top. */
export const getRecentLogs = cache(
  async (limit: number = RECENT_LOGS_LIMIT): Promise<LogWithCategories[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("logs")
      .select(LOG_COLUMNS)
      .order("logged_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error("Your logs could not be read.");
    }

    return attachCategories(supabase, (data ?? []) as Log[]);
  },
);

/**
 * One log by id, or null when it does not exist *for this user*. A forged id
 * is indistinguishable from a missing one, which is the point.
 */
export const getLog = cache(
  async (id: string): Promise<LogWithCategories | null> => {
    if (!isUuid(id)) {
      return null;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("logs")
      .select(LOG_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error("This log could not be read.");
    }

    if (!data) {
      return null;
    }

    const [log] = await attachCategories(supabase, [data as Log]);
    return log ?? null;
  },
);

/**
 * Resolves the categories for a set of logs in two further queries rather
 * than one embedded select per log: the join table has no ownership column,
 * so its rows are fetched by log id and the names come from the categories
 * table, which RLS scopes to the caller.
 */
async function attachCategories(
  supabase: SupabaseClient,
  logs: Log[],
): Promise<LogWithCategories[]> {
  if (logs.length === 0) {
    return [];
  }

  const { data: linkData, error: linkError } = await supabase
    .from("log_categories")
    .select("log_id, category_id")
    .in(
      "log_id",
      logs.map((log) => log.id),
    );

  if (linkError) {
    throw new Error("The categories of these logs could not be read.");
  }

  const links = (linkData ?? []) as { log_id: string; category_id: string }[];

  if (links.length === 0) {
    return logs.map((log) => ({ ...log, categories: [] }));
  }

  const categoryIds = [...new Set(links.map((link) => link.category_id))];
  const { data: categoryData, error: categoryError } = await supabase
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .in("id", categoryIds);

  if (categoryError) {
    throw new Error("Your categories could not be read.");
  }

  const byId = new Map(
    ((categoryData ?? []) as Category[]).map((category) => [
      category.id,
      category,
    ]),
  );

  return logs.map((log) => ({
    ...log,
    categories: links
      .filter((link) => link.log_id === log.id)
      .map((link) => byId.get(link.category_id))
      .filter((category): category is Category => Boolean(category))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
