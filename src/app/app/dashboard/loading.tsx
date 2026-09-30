/**
 * Loading state for the consistency dashboard (/app/dashboard).
 *
 * Matches the layout of DashboardPage:
 * - "Consistency" section label and "Keep showing up." title
 * - 4-stat cards grid (Current streak, Longest run, Days logged, This month)
 * - 26-week heatmap placeholder section with legend
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            Consistency
          </p>
          <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
            Keep showing up.
          </h1>
        </div>

        <div
          aria-hidden="true"
          className="h-9 w-24 rounded-md bg-zinc-100 dark:bg-zinc-900"
        />
      </header>

      <section
        role="status"
        aria-label="Loading consistency data"
        className="grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 animate-pulse sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800"
      >
        {[
          { label: "Current streak", unit: "days" },
          { label: "Longest run", unit: "days" },
          { label: "Days logged", unit: "of 182" },
          { label: "This month", unit: "entries" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white px-4 py-5 dark:bg-zinc-950">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">
              {stat.label}
            </p>
            <div className="mt-3 h-8 w-12 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
            <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-300 dark:text-zinc-700">
              {stat.unit}
            </p>
          </div>
        ))}
        <span className="sr-only">Loading consistency data…</span>
      </section>

      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            Last 26 weeks
          </h2>
          <div className="h-3 w-28 rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>

        <div
          aria-hidden="true"
          className="mt-6 h-28 rounded-md border border-zinc-100 bg-zinc-50/60 p-4 animate-pulse dark:border-zinc-900 dark:bg-zinc-950/60"
        />

        <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
          <span>Fewer</span>
          <div className="flex gap-1">
            <span className="h-3 w-3 rounded-[2px] bg-zinc-200 dark:bg-zinc-800" />
            <span className="h-3 w-3 rounded-[2px] bg-zinc-300 dark:bg-zinc-700" />
            <span className="h-3 w-3 rounded-[2px] bg-zinc-400 dark:bg-zinc-600" />
            <span className="h-3 w-3 rounded-[2px] bg-zinc-500 dark:bg-zinc-500" />
            <span className="h-3 w-3 rounded-[2px] bg-zinc-700 dark:bg-zinc-300" />
          </div>
          <span>More</span>
        </div>
      </section>
    </main>
  );
}
