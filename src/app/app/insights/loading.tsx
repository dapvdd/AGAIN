export default function InsightsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="pb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 animate-pulse dark:text-zinc-400">
          Insights
        </p>
        <div className="mt-4 h-8 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </header>
      <div className="grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse bg-white dark:bg-zinc-950" />
        ))}
      </div>
      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </main>
  );
}
