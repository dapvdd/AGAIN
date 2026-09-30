/**
 * Loading state for the history calendar view (/app/history).
 *
 * Matches the layout of HistoryPage:
 * - "History" section label with month header
 * - Month navigation placeholder
 * - 7-column calendar grid with Monday-Sunday weekday headers
 * - 5 weeks of placeholder day cells
 * - Day detail section placeholder
 */
export default function HistoryLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            History
          </p>
          <div className="mt-4 h-8 w-44 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
        </div>

        <div
          aria-hidden="true"
          className="flex items-center gap-2"
        >
          <span className="h-7 w-7 rounded-full border border-zinc-200 dark:border-zinc-800" />
          <span className="h-4 w-12 rounded bg-zinc-100 dark:bg-zinc-900" />
          <span className="h-7 w-7 rounded-full border border-zinc-200 dark:border-zinc-800" />
        </div>
      </header>

      <div
        role="status"
        aria-label="Loading history calendar"
        className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 animate-pulse dark:border-zinc-800 dark:bg-zinc-800"
      >
        <div className="grid grid-cols-7 gap-px bg-zinc-200 text-center dark:bg-zinc-800">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <p
              key={label}
              className="bg-white py-2 text-[10px] uppercase tracking-widest text-zinc-400 dark:bg-zinc-950 dark:text-zinc-600"
            >
              {label}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px border-t border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="min-h-14 bg-white p-2 sm:min-h-20 dark:bg-zinc-950"
            >
              <div className="h-3 w-4 rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading history calendar…</span>
      </div>

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="h-4 w-32 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
          <div className="h-3 w-24 rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
        <div className="mt-6 flex flex-col gap-4">
          <div className="h-4 w-3/5 rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-3 w-4/5 rounded bg-zinc-100/70 dark:bg-zinc-900/70" />
        </div>
      </section>
    </main>
  );
}
