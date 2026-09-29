import { notFound } from "next/navigation";
import { updateLog } from "@/app/actions/logs";
import { LogForm } from "@/components/log-form";
import { requireUser } from "@/lib/auth";
import { getCategories, getLog, getPillars } from "@/lib/logs";

export default async function EditLogPage(props: PageProps<"/app/logs/[id]/edit">) {
  await requireUser();

  const { id } = await props.params;
  const log = await getLog(id);

  if (!log) {
    notFound();
  }

  const [pillars, categories] = await Promise.all([
    getPillars(),
    getCategories(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="pb-10">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Edit entry
        </p>
        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Correct the record.
        </h1>
      </header>

      <LogForm
        action={updateLog}
        logId={log.id}
        pillars={pillars}
        categories={categories}
        defaults={{
          loggedOn: log.logged_on,
          pillar: log.pillar ?? "",
          categoryIds: log.categories.map((category) => category.id),
          title: log.title ?? "",
          body: log.body,
        }}
        submitLabel="Save changes"
        cancelHref={`/app/logs/${log.id}`}
        cancelLabel="Back to log"
      />
    </main>
  );
}
