import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { searchLogs } from "@/lib/logs";
import { formatLoggedOn } from "@/lib/format";
import {
  SEARCH_QUERY_MAX_LENGTH,
  normalizeSearchQuery,
} from "@/lib/search";

/**
 * The archive by words rather than by day.
 *
 * Like History, the whole view is server-rendered and driven by one query
 * parameter — ?q= — rather than by client state, so a search can be shared,
 * bookmarked, and reached with the back button, and the page needs no
 * JavaScript to work. The box is a plain GET form: submitting it is a
 * navigation, not a request, which keeps the query in the URL where the rest
 * of the app already keeps its state.
 */
export default async function SearchPage(props: PageProps<"/app/search">) {
  await requireUser();

  const params = await props.searchParams;
  const query = normalizeSearchQuery(
    typeof params.q === "string" ? params.q : undefined,
  );

  const results = query === null ? null : await searchLogs(query);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="pb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Search
        </p>
        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Find it again.
        </h1>
      </header>

      <form
        action="/app/search"
        method="get"
        role="search"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <label htmlFor="q" className="sr-only">
          Search the archive
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query ?? ""}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          autoFocus
          placeholder="A word, a phrase, a feeling"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-400"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Search
        </button>
      </form>

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        {results === null ? (
          <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-400">
            Search your own words.
            <br />
            Titles and notes, from every day you have kept.
          </p>
        ) : results.logs.length === 0 ? (
          <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-400">
            Nothing matched{" "}
            <span className="text-zinc-900 dark:text-zinc-50">{query}</span>.
            <br />
            Try fewer words.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                {results.logs.length}{" "}
                {results.logs.length === 1 ? "match" : "matches"}
              </h2>
              {results.truncated ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Showing the most recent {results.logs.length}. Narrow the
                  search to see the rest.
                </p>
              ) : null}
            </div>

            <ul className="mt-4 flex flex-col">
              {results.logs.map((log) => {
                const labels = [
                  log.pillar,
                  ...log.categories.map((category) => category.name),
                ].filter((label): label is string => Boolean(label));

                return (
                  <li
                    key={log.id}
                    className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800"
                  >
                    <Link
                      href={`/app/logs/${log.id}`}
                      className="group flex flex-col gap-2 py-6 sm:flex-row sm:gap-6"
                    >
                      <p className="text-xs uppercase tracking-widest text-zinc-500 sm:w-40 sm:shrink-0 dark:text-zinc-400">
                        {formatLoggedOn(log.logged_on)}
                      </p>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 group-hover:underline dark:text-zinc-50">
                          {log.title ?? firstLine(log.body)}
                        </p>
                        {log.title ? (
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                            {log.body}
                          </p>
                        ) : null}
                        {labels.length > 0 ? (
                          <p className="mt-2 text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                            {labels.join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

/** An entry with no title is still worth a heading in the list. */
function firstLine(body: string): string {
  const line = body.split("\n").find((candidate) => candidate.trim() !== "");
  return (line ?? body).trim();
}
