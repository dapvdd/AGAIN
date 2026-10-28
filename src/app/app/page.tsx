import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPillars, getRecentLogs, RECENT_LOGS_LIMIT } from "@/lib/logs";
import { firstLine, formatLoggedOn, singleParam } from "@/lib/format";

export default async function AppPage(props: PageProps<"/app">) {
  await requireUser();

  const params = await props.searchParams;
  const pillarParam = singleParam(params.pillar);

  // The two reads do not depend on each other unless a filter has to be
  // checked. Validating ?pillar needs the compass, but nothing else does, and
  // an absent filter is already valid — so the plain /app request, which is
  // what every visit starts with, reads the compass and the archive at the
  // same time instead of one after the other. A filtered request keeps waiting
  // for the keys, because there the order is the answer: an unknown pillar has
  // to fall back to the whole archive rather than query for nothing.
  const compass = getPillars();
  const archive =
    pillarParam === undefined
      ? getRecentLogs(RECENT_LOGS_LIMIT)
      : compass.then((keys) =>
          getRecentLogs(
            RECENT_LOGS_LIMIT,
            keys.some((pillar) => pillar.key === pillarParam)
              ? pillarParam
              : undefined,
          ),
        );

  const [pillars, logs] = await Promise.all([compass, archive]);

  const pillarFilter =
    pillarParam && pillars.some((p) => p.key === pillarParam)
      ? pillarParam
      : null;

  const activePillar = pillarFilter
    ? pillars.find((p) => p.key === pillarFilter)
    : null;

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

      <nav
        aria-label="Filter by pillar"
        className="flex flex-wrap gap-2 pb-6"
      >
        <Link
          href="/app"
          className={pillClass(!pillarFilter)}
          aria-current={!pillarFilter ? "page" : undefined}
        >
          All
        </Link>
        {pillars.map((pillar) => (
          <Link
            key={pillar.key}
            href={`/app?pillar=${pillar.key}`}
            className={pillClass(pillarFilter === pillar.key)}
            aria-current={pillarFilter === pillar.key ? "page" : undefined}
          >
            {pillar.label}
          </Link>
        ))}
      </nav>

      {logs.length === 0 ? (
        <section className="border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {activePillar
              ? `No ${activePillar.label.toLowerCase()} logs yet.`
              : "Nothing logged yet."}
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

function pillClass(isActive: boolean): string {
  const base =
    "rounded-full border px-3 py-1.5 text-xs uppercase tracking-widest transition-colors";
  const active =
    "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900";
  const inactive =
    "border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100";
  return `${base} ${isActive ? active : inactive}`;
}
