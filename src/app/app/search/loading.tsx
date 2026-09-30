/**
 * Loading state for the search view (/app/search).
 *
 * Matches the layout of SearchPage:
 * - "Search" section label and "Find it again." title
 * - Search input and button placeholder
 * - Quiet results section placeholder
 */
export default function SearchLoading() {
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

      <div
        aria-hidden="true"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900" />
        <div className="h-10 w-20 shrink-0 rounded-md bg-zinc-900/10 dark:bg-zinc-50/10" />
      </div>

      <section
        role="status"
        aria-label="Loading search"
        className="mt-10 border-t border-zinc-200 pt-8 animate-pulse dark:border-zinc-800"
      >
        <div className="flex flex-col gap-3">
          <div className="h-4 w-44 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
          <div className="h-3 w-64 rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
        <span className="sr-only">Loading search…</span>
      </section>
    </main>
  );
}
