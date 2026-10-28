import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getArchiveForInsights, getCategories, getPillars } from "@/lib/logs";
import { todayIso } from "@/lib/log-input";
import { buildInsights } from "@/lib/insights";
import { formatLoggedOn } from "@/lib/format";
import type { InsightLog, PillarInsight, WeekdayInsight, MonthSummary } from "@/lib/insights";
import { formatMoment } from "@/lib/format";

export const metadata = { title: "Insights · AGAIN" };

const INSIGHT_WEEKS = 12;

/**
 * The archive measured for meaning — personal, explainable insights from the
 * user's own data. No psychologising, no guilt, every number traceable to a
 * record. Server-rendered, no query parameters, no client JavaScript beyond
 * what Next.js already ships.
 */
export default async function InsightsPage() {
  await requireUser();

  const [pillars, categories, logs] = await Promise.all([
    getPillars(),
    getCategories(),
    getArchiveForInsights(),
  ]);

  // Adapt the DAL rows to the pure module's minimal shape.
  const insightLogs: InsightLog[] = logs.map((log) => ({
    id: log.id,
    logged_on: log.logged_on,
    pillar: log.pillar,
    title: log.title,
    body: log.body,
    created_at: log.created_at,
    categoryIds: log.categories.map((category) => category.id),
  }));

  const today = todayIso();
  const report = buildInsights(insightLogs, today, pillars, categories, INSIGHT_WEEKS);

  if (report === null) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Nothing to measure yet. Write something first.
        </p>
        <Link href="/app/logs/new" className="mt-6 text-xs uppercase tracking-widest text-zinc-900 underline underline-offset-4 dark:text-zinc-50">
          Write the first log
        </Link>
      </main>
    );
  }

  const { totals, pillars: pillarData, categories: categoryData, weekdays, milestones, months } = report;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="pb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Insights
        </p>
        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          The archive measured.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          What your own words say, counted honestly. Every number below comes
          from your logs and nothing else.
        </p>
      </header>

      {/* Totals */}
      <TotalsBlock totals={totals} />

      {/* Pillars */}
      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800" aria-label="Pillars">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            Pillars — last {INSIGHT_WEEKS} weeks
          </h2>
          <WindowLabel start={totals.window.start} end={totals.window.end} />
        </div>
        <PillarGrid pillars={pillarData} />
      </section>

      {/* Weekdays */}
      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800" aria-label="Weekdays">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            When you write
          </h2>
          <WindowLabel start={totals.window.start} end={totals.window.end} />
        </div>
        <WeekdayInsight row={weekdays} />
      </section>

      {/* Categories */}
      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800" aria-label="Categories">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            What you keep naming
          </h2>
          <WindowLabel start={totals.window.start} end={totals.window.end} />
        </div>
        {categoryData.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No categories yet. Name the things you come back to on the log form.
          </p>
        ) : (
          <CategoryBars categories={categoryData} />
        )}
      </section>

      {/* Monthly view */}
      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800" aria-label="Months">
        <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Month by month
        </h2>
        <MonthList months={months} />
      </section>

      {/* Milestones */}
      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800" aria-label="Milestones">
        <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Milestones
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Landmarks from your own archive — first entries, every hundredth,
          full weeks.
        </p>
        <MilestoneList milestones={milestones} />
      </section>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Small presentational pieces. Everything lives here or in pure lib modules;
// the page holds no query, no state, no client interaction.
// ----------------------------------------------------------------------------

function WindowLabel({ start, end }: { start: string; end: string }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
      {formatLoggedOn(start)} — {formatLoggedOn(end)}
    </p>
  );
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-white px-4 py-5 dark:bg-zinc-950">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-3 text-2xl font-medium tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      {unit ? (
        <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          {unit}
        </p>
      ) : null}
    </div>
  );
}

function TotalsBlock({ totals }: { totals: { daysLogged: number; entries: number; entriesPerDay: number; spanDays: number } }) {
  return (
    <section
      aria-label="Overall"
      className="grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800"
    >
      <Stat label="Days logged" value={totals.daysLogged} unit="in window" />
      <Stat label="Entries" value={totals.entries} unit="in window" />
      <Stat label="Entries per day" value={totals.entriesPerDay} unit="when you write" />
      <Stat label="Archive span" value={totals.spanDays} unit="days" />
    </section>
  );
}

function PillarGrid({ pillars }: { pillars: PillarInsight[] }) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {pillars.map((pillar) => (
        <li
          key={pillar.key}
          className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-50">
              {pillar.label}
            </p>
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {pillar.daysLogged}d
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
              style={{ width: `${Math.round(pillar.consistency * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {pillar.entries} {pillar.entries === 1 ? "entry" : "entries"}
          </p>
        </li>
      ))}
    </ul>
  );
}

function WeekdayInsight({ row }: { row: WeekdayInsight[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-1.5">
      {row.map((day) => (
        <li key={day.label} className="flex items-center gap-3">
          <span className="w-8 text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {day.label}
          </span>
          <div className="flex h-4 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
            {Array.from({ length: Math.min(day.entries, 10) }).map((_, i) => (
              <span
                key={i}
                className="w-1 shrink-0 bg-zinc-400 dark:bg-zinc-600"
              />
            ))}
          </div>
          <span className="w-16 text-right text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {day.entries} · {day.daysLogged}d
          </span>
        </li>
      ))}
    </ul>
  );
}

function CategoryBars({ categories }: { categories: { id: string; name: string; entries: number }[] }) {
  const max = Math.max(1, ...categories.map((c) => c.entries));
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {categories.slice(0, 12).map((category) => (
        <li key={category.id} className="flex items-center gap-3">
          <span className="w-32 truncate text-xs text-zinc-900 dark:text-zinc-50">
            {category.name}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-500 dark:bg-zinc-400"
              style={{ width: `${(category.entries / max) * 100}%` }}
            />
          </div>
          <span className="w-12 text-right text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {category.entries}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MonthList({ months }: { months: MonthSummary[] }) {
  if (months.length === 0) {
    return <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No months yet.</p>;
  }
  return (
    <ul className="mt-4 flex flex-col">
      {months.slice(-12).reverse().map((month) => (
        <li
          key={month.key}
          className="flex items-center justify-between gap-4 border-b border-zinc-200 py-2.5 last:border-b-0 dark:border-zinc-800"
        >
          <Link
            href={`/app/history?month=${month.key}`}
            className="text-xs uppercase tracking-widest text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            {month.label}
          </Link>
          <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {month.entries} entries · {month.daysLogged}d
            {month.deltaEntries !== 0 ? (
              <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                {month.deltaEntries > 0 ? "+" : ""}
                {month.deltaEntries}
              </span>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

function MilestoneList({ milestones }: { milestones: { kind: string; label: string; log: InsightLog; message: string }[] }) {
  if (milestones.length === 0) {
    return <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">None yet.</p>;
  }
  return (
    <ul className="mt-4 flex flex-col">
      {milestones.reverse().map((milestone) => (
        <li
          key={`${milestone.kind}-${milestone.log.id}`}
          className="flex items-center justify-between gap-4 border-b border-zinc-200 py-3 last:border-b-0 dark:border-zinc-800"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {milestone.label}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {milestone.message}
            </p>
          </div>
          <Link
            href={`/app/logs/${milestone.log.id}`}
            className="shrink-0 text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            {formatMoment(milestone.log.created_at)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
