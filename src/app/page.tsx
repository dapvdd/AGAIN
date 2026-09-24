import { PillarList } from "@/components/pillar-list";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-between px-6 py-16 sm:px-8 sm:py-24">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
          Again
        </p>
      </header>

      <section className="py-16 sm:py-24">
        <h1 className="max-w-2xl text-3xl font-medium leading-tight tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          If today fails, start AGAIN.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
          A personal life tracker and a searchable archive of one honest life.
          Nothing to perform for. Nothing to prove.
        </p>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Core pillars
        </h2>
        <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <PillarList />
        </div>
      </section>

      <footer className="mt-16 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Again. Repeat. Discipline.
        </p>
      </footer>
    </main>
  );
}
