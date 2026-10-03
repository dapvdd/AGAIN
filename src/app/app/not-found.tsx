import Link from "next/link";

/**
 * App-scoped 404.
 * Rendered inside the authenticated /app layout so navigation, visual language,
 * and user context are preserved.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="pb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Not found
        </p>
        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Nothing here.
        </h1>
      </header>

      <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-400">
          This entry is not in your archive. It may have been deleted, or the
          link may be old.
          <br />
          The rest of it is still where you left it.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-6">
          <Link
            href="/app"
            className="text-xs uppercase tracking-widest text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
          >
            Back to logs
          </Link>
          <Link
            href="/app/search"
            className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            Search the archive
          </Link>
        </div>
      </section>
    </main>
  );
}
