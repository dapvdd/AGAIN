import { createLog } from "@/app/actions/logs";
import { LogForm } from "@/components/log-form";
import { requireUser } from "@/lib/auth";
import { isDateOnly } from "@/lib/log-input";
import { getCategories, getPillars } from "@/lib/logs";

/**
 * ?date=YYYY-MM-DD lets the calendar offer a day directly. The value is
 * checked with the same calendar rule the form and the actions use, so a
 * hand-edited URL cannot prefill an impossible day; without it the form
 * falls back to the user's own today.
 */
export default async function NewLogPage(props: PageProps<"/app/logs/new">) {
  await requireUser();

  const params = await props.searchParams;
  const requested =
    typeof params.date === "string" ? params.date : undefined;
  const presetDate = requested !== undefined && isDateOnly(requested)
    ? requested
    : null;

  const [pillars, categories] = await Promise.all([
    getPillars(),
    getCategories(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="pb-10">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          New entry
        </p>
        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Write it down.
        </h1>
      </header>

      <LogForm
        action={createLog}
        pillars={pillars}
        categories={categories}
        defaults={
          presetDate
            ? {
                loggedOn: presetDate,
                pillar: "",
                categoryIds: [],
                title: "",
                body: "",
              }
            : undefined
        }
        submitLabel="Save log"
        cancelHref="/app"
        cancelLabel="Back to logs"
      />
    </main>
  );
}
