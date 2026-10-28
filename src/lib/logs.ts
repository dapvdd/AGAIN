import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDateOnly, isUuid } from "@/lib/log-input";
import { monthBounds, type CalendarMonth } from "@/lib/calendar";
import type {
  Category,
  CategorySummary,
  Log,
  LogWithCategories,
  Pillar,
} from "@/lib/types";

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

export const RECENT_LOGS_LIMIT = 20;

/**
 * The upper bound on an existing archive the current machine can reasonably
 * carry in a single response. The archive is one honest life, but the insights
 * page sums the whole of it; this bound keeps that read proportional while
 * still covering years of daily entries.
 */
export const INSIGHTS_LOG_LIMIT = 20_000;

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

/**
 * How many of the caller's logs carry each category, keyed by category id.
 *
 * Read from the join table rather than counted per category: one query with
 * one column instead of a round trip per row. It is safe to do so because
 * `log_categories` has no user_id of its own — its select policy requires
 * *both* parents to belong to the caller, so a row that reached this query
 * already proves the log and the category are the caller's. A foreign tag
 * cannot contribute a count, let alone be revealed by one.
 */
export const getCategoryUsage = cache(
  async (): Promise<Map<string, number>> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("log_categories")
      .select("category_id");

    if (error) {
      throw new Error("Your categories could not be read.");
    }

    const usage = new Map<string, number>();
    for (const link of (data ?? []) as { category_id: string }[]) {
      usage.set(link.category_id, (usage.get(link.category_id) ?? 0) + 1);
    }

    return usage;
  },
);

/**
 * The caller's categories with their log counts — the one read the category
 * management page needs, so the page itself holds no query.
 */
export const getCategorySummaries = cache(
  async (): Promise<CategorySummary[]> => {
    const [categories, usage] = await Promise.all([
      getCategories(),
      getCategoryUsage(),
    ]);

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      logCount: usage.get(category.id) ?? 0,
    }));
  },
);

/**
 * The user's archive, newest day first, with the newest entry of a day on top.
 *
 * When `pillar` is given, only logs tagged with that pillar are returned. The
 * caller is responsible for validating the pillar against the known keys —
 * this function trusts its inputs, the same way `getLogsByDate` trusts a
 * validated date.
 */
export const getRecentLogs = cache(
  async (
    limit: number = RECENT_LOGS_LIMIT,
    pillar?: string,
  ): Promise<LogWithCategories[]> => {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("logs")
      .select(LOG_COLUMNS)
      .order("logged_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (pillar) {
      query = query.eq("pillar", pillar);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error("Your logs could not be read.");
    }

    return attachCategories(supabase, (data ?? []) as Log[]);
  },
);

/**
 * The text search configuration the archive is indexed with.
 *
 * It is 'simple' rather than the default 'english' because the column is
 * generated with it: `to_tsvector('simple', ...)` at
 * 20260927000100_core_domain.sql:86. The query has to be parsed with the same
 * configuration the column was built with, and stemming an honest personal
 * archive is surprising anyway — "praying" collapsing into "pray" hides
 * entries from someone looking for the word they wrote.
 */
const TEXT_SEARCH_CONFIG = "simple";

/** How many matches one search will show before it stops. */
const SEARCH_RESULT_LIMIT = 50;

export interface SearchResults {
  logs: LogWithCategories[];
  /**
   * Whether more entries matched than were returned. Detected by asking for
   * one row more than the limit and discarding it, so "there are more" costs
   * nothing beyond a single extra row over the wire.
   */
  truncated: boolean;
}

/**
 * Full-text search over the caller's own archive, newest day first.
 *
 * Rides the stored `search_vector` column and its GIN index, both of which
 * have been in the schema since the core domain migration: this is the reader
 * they were built for. `websearch` is the right parser for a public box
 * because it never raises a syntax error on user input, and because it hands
 * the reader useful syntax for free — `-word` to exclude, `or` to widen, and
 * quotes for an exact phrase.
 *
 * The `search_vector` column itself is never selected. It is a machine field
 * whose size scales with the body, and no caller has anything to do with it.
 */
export const searchLogs = cache(
  async (query: string): Promise<SearchResults> => {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("logs")
      .select(LOG_COLUMNS)
      .textSearch("search_vector", query, {
        type: "websearch",
        config: TEXT_SEARCH_CONFIG,
      })
      .order("logged_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(SEARCH_RESULT_LIMIT + 1);

    if (error) {
      throw new Error("The archive could not be searched.");
    }

    const rows = (data ?? []) as Log[];
    const truncated = rows.length > SEARCH_RESULT_LIMIT;

    return {
      logs: await attachCategories(
        supabase,
        truncated ? rows.slice(0, SEARCH_RESULT_LIMIT) : rows,
      ),
      truncated,
    };
  },
);

/**
 * The days of one month that hold at least one log.
 *
 * Only the date column and only the month's range: the calendar marks days,
 * it does not need the entries behind them, and the range predicate rides
 * the (user_id, logged_on desc, created_at desc) index rather than scanning
 * the archive. A month with no logs costs one empty result.
 */
export const getLogDatesByMonth = cache(
  async (month: CalendarMonth): Promise<string[]> => {
    const { start, endExclusive } = monthBounds(month);
    return getLogDatesBetween(start, endExclusive);
  },
);

/**
 * Every day in a half-open range that holds at least one log, with a log that
 * holds two listing the day twice so the caller can count without a second
 * query. The upper bound is exclusive, so a range never has to name the last
 * millisecond of a month and never rolls into the next one.
 */
export const getLogDatesBetween = cache(
  async (start: string, endExclusive: string): Promise<string[]> => {
    if (!isDateOnly(start) || !isDateOnly(endExclusive) || start >= endExclusive) {
      return [];
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("logs")
      .select("logged_on")
      .gte("logged_on", start)
      .lt("logged_on", endExclusive)
      .order("logged_on", { ascending: true });

    if (error) {
      throw new Error("Your history could not be read.");
    }

    return ((data ?? []) as { logged_on: string }[]).map(
      (row) => row.logged_on,
    );
  },
);

/**
 * The whole archive for the insights page, with each log's category ids
 * attached. Bounded by INSIGHTS_LOG_LIMIT to keep the read proportional to a
 * personal archive rather than to a data warehouse; RLS still decides which
 * rows exist. Categories are resolved the same two-query way as everywhere
 * else, so this reuses attachCategories rather than inventing a new shape.
 */
export const getArchiveForInsights = cache(
  async (): Promise<LogWithCategories[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("logs")
      .select(LOG_COLUMNS)
      .order("logged_on", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(INSIGHTS_LOG_LIMIT);

    if (error) {
      throw new Error("The archive could not be read.");
    }

    return attachCategories(supabase, (data ?? []) as Log[]);
  },
);

/**
 * One day, oldest entry first: within a day the order things were written is
 * the order they happened. RLS still decides which days exist — a date with
 * nothing in it comes back empty, not forbidden.
 */
export const getLogsByDate = cache(
  async (date: string): Promise<LogWithCategories[]> => {
    if (!isDateOnly(date)) {
      return [];
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("logs")
      .select(LOG_COLUMNS)
      .eq("logged_on", date)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error("This day could not be read.");
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
