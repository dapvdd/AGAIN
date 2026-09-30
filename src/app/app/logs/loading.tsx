import Link from "next/link";

/**
 * Loading state for log viewing and editing routes (/app/logs/*).
 *
 * Matches the layout of LogPage and log forms:
 * - "Back to logs" breadcrumb navigation
 * - Article skeleton with date/pillar tag line, title bar, and note body lines
 * - Footer actions placeholder
 */
export default function LogLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <Link
        href="/app"
        className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        Back to logs
      </Link>

      <article
        role="status"
        aria-label="Loading log"
        className="pt-10 animate-pulse"
      >
        <div className="h-3 w-40 rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="mt-4 h-8 w-3/5 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />

        <div className="mt-6 flex flex-col gap-2.5">
          <div className="h-4 w-full rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-4 w-11/12 rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-4 w-4/5 rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-4 w-2/3 rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>

        <div className="mt-10 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="h-3 w-28 rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>

        <span className="sr-only">Loading log…</span>
      </article>
    </main>
  );
}
