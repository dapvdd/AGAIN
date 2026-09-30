/**
 * Loading state for category management (/app/categories).
 *
 * Matches the layout of CategoriesPage:
 * - "Categories" section label, title, and description paragraph
 * - Create category form placeholder
 * - Category row list placeholders
 */
export default function CategoriesLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="pb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Categories
        </p>
        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Your own words for it.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The labels you use to find things again. They belong to you alone, and
          removing one never removes a log.
        </p>
      </header>

      <div
        role="status"
        aria-label="Loading categories"
        className="flex flex-col animate-pulse"
      >
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="h-10 w-full rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
            <div className="h-10 w-16 shrink-0 rounded-md bg-zinc-900/10 dark:bg-zinc-50/10" />
          </div>
        </div>

        <ul className="mt-10 flex flex-col border-t border-zinc-200 dark:border-zinc-800">
          {[1, 2, 3].map((i) => (
            <li
              key={i}
              className="flex items-center justify-between border-b border-zinc-200 py-5 dark:border-zinc-800"
            >
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-28 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
                <div className="h-3 w-16 rounded bg-zinc-100 dark:bg-zinc-900" />
              </div>
              <div className="flex gap-4">
                <div className="h-3 w-12 rounded bg-zinc-100 dark:bg-zinc-900" />
                <div className="h-3 w-12 rounded bg-zinc-100 dark:bg-zinc-900" />
              </div>
            </li>
          ))}
        </ul>
        <span className="sr-only">Loading categories…</span>
      </div>
    </main>
  );
}
