"use client";

import Link from "next/link";

/**
 * What a failed read looks like.
 *
 * Every reader in the DAL throws a plain, deliberately unspecific message, and
 * this page deliberately does not render `error.message` at all: in production
 * Next replaces a server component's message with a generic one anyway, and
 * printing whatever arrived would mean the browser and the server log
 * disagreed about what was on screen. The `digest` is the documented handle
 * for matching the two, so it is the one thing worth showing.
 *
 * `retry` rather than `reset` because the failures this catches are the
 * transient kind — Supabase unreachable, a request timed out — and re-fetching
 * is the honest response to those. The archive is untouched by a read that
 * failed, so retrying is always safe.
 */
export default function ArchiveError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="pb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Something broke
        </p>
        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          The archive would not load.
        </h1>
      </header>

      <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-400">
          Nothing was changed or lost — a page that fails to read is not a page
          that writes.
          <br />
          This is usually the connection, not the data.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950"
          >
            Try again
          </button>
          <Link
            href="/app"
            className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            Back to logs
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-8 text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
            Reference {error.digest}
          </p>
        ) : null}
      </section>
    </main>
  );
}
