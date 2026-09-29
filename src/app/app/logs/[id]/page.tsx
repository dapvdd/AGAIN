import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteLog } from "@/components/delete-log";
import { requireUser } from "@/lib/auth";
import { getLog } from "@/lib/logs";
import { formatLoggedOn, formatMoment } from "@/lib/format";

export default async function LogPage(props: PageProps<"/app/logs/[id]">) {
  await requireUser();

  const { id } = await props.params;
  // Null here means "not yours or not there". The page cannot tell the
  // difference, so it cannot be used to discover that it exists.
  const log = await getLog(id);

  if (!log) {
    notFound();
  }

  const labels = [
    log.pillar,
    ...log.categories.map((category) => category.name),
  ].filter((label): label is string => Boolean(label));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <Link
        href="/app"
        className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        Back to logs
      </Link>

      <article className="pt-10">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          {[formatLoggedOn(log.logged_on), ...labels].join(" · ")}
        </p>

        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          {log.title ?? formatLoggedOn(log.logged_on)}
        </h1>

        <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-zinc-700 dark:text-zinc-300">
          {log.body}
        </p>

        <dl className="mt-10 flex flex-col gap-1 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <div className="flex gap-2">
            <dt>Written</dt>
            <dd>{formatMoment(log.created_at)}</dd>
          </div>
          {log.updated_at !== log.created_at ? (
            <div className="flex gap-2">
              <dt>Changed</dt>
              <dd>{formatMoment(log.updated_at)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <Link
            href={`/app/logs/${log.id}/edit`}
            className="text-xs uppercase tracking-widest text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
          >
            Edit
          </Link>
          <DeleteLog logId={log.id} />
        </div>
      </article>
    </main>
  );
}
