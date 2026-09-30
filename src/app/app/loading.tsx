/**
 * Loading state for the main logs list view (/app).
 *
 * Matches the layout of AppPage:
 * - max-w-3xl centered container
 * - "Logs" header and "Add log" button placeholder
 * - Pillar filter pills placeholder
 * - Quiet list row skeletons with date gutter and body lines
 */
export default function LogsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-8">
        <h1 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Logs
        </h1>
        <div
          aria-hidden="true"
          className="h-9 w-20 rounded-md bg-zinc-100 dark:bg-zinc-900"
        />
      </header>

      <div
        aria-hidden="true"
        className="flex flex-wrap gap-2 pb-6"
      >
        {["All", "Health", "Work", "Rest"].map((label, index) => (
          <span
            key={label}
            className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-widest ${
              index === 0
                ? "border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-600"
                : "border-zinc-200 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <div
        role="status"
        aria-label="Loading logs"
        className="flex flex-col border-t border-zinc-200 animate-pulse dark:border-zinc-800"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-2 border-b border-zinc-200 py-6 sm:flex-row sm:gap-6 dark:border-zinc-800"
          >
            <div className="h-4 w-28 rounded bg-zinc-100 sm:w-40 sm:shrink-0 dark:bg-zinc-900" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-3/5 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
              <div className="h-3 w-4/5 rounded bg-zinc-100 dark:bg-zinc-900" />
              <div className="mt-1 h-3 w-1/4 rounded bg-zinc-100/70 dark:bg-zinc-900/70" />
            </div>
          </div>
        ))}
        <span className="sr-only">Loading logs…</span>
      </div>
    </main>
  );
}
