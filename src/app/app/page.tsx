import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getRecentLogs } from "@/lib/logs";
import { formatLoggedOn } from "@/lib/format";

export default async function AppPage() {
  await requireUser();
  const logs = await getRecentLogs();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 pb-8">
        <h1 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Logs
        </h1>
        <Link
          href="/app/logs/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add log
        </Link>
      </header>

      {logs.length === 0 ? (
        <section className="border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Nothing logged yet.
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            The archive starts with one honest entry. Whatever today looks
            like, it is worth writing down.
          </p>
          <Link
            href="/app/logs/new"
            className="mt-6 inline-block text-xs uppercase tracking-widest text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
          >
            Write the first log
          </Link>
        </section>
      ) : (
        <ul className="flex flex-col border-t border-zinc-200 dark:border-zinc-800">
          {logs.map((log) => {
            const labels = [
              log.pillar,
              ...log.categories.map((category) => category.name),
            ].filter((label): label is string => Boolean(label));

            return (
              <li
                key={log.id}
                className="border-b border-zinc-200 dark:border-zinc-800"
              >
                <Link
                  href={`/app/logs/${log.id}`}
                  className="group flex flex-col gap-2 py-6 sm:flex-row sm:gap-6"
                >
                  <p className="text-xs uppercase tracking-widest text-zinc-500 sm:w-40 sm:shrink-0 dark:text-zinc-400">
                    {formatLoggedOn(log.logged_on)}
                  </p>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 group-hover:underline dark:text-zinc-50">
                      {log.title ?? firstLine(log.body)}
                    </p>
                    {log.title ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                        {log.body}
                      </p>
                    ) : null}
                    {labels.length > 0 ? (
                      <p className="mt-2 text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        {labels.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

/** An entry with no title is still worth a heading in the list. */
function firstLine(body: string): string {
  const line = body.split("\n").find((candidate) => candidate.trim() !== "");
  return (line ?? body).trim();
}
