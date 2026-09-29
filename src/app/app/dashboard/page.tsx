import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLogDatesBetween } from "@/lib/logs";
import { todayIso } from "@/lib/log-input";
import {
  MONTH_ABBREVIATIONS,
  monthOfDate,
} from "@/lib/calendar";
import {
  CONSISTENCY_WEEKS,
  buildConsistency,
  consistencyWindow,
  type ConsistencyDay,
  type ConsistencyWeek,
} from "@/lib/consistency";
import { formatLoggedOn } from "@/lib/format";

/**
 * The archive measured, rather than read.
 *
 * The only page here with no query parameters: there is nothing to choose,
 * so there is nothing to put in a URL. It is server-rendered like every other
 * page in the app and needs no JavaScript — the whole grid is plain elements,
 * and the numbers beside it are the same numbers a screen reader reads.
 *
 * The tone is deliberately quiet. A day with nothing on it is an empty square,
 * not a red mark: a missed day is not a failure, and a page that treated it
 * like one would be measuring guilt rather than consistency.
 */
export default async function DashboardPage() {
  await requireUser();

  const today = todayIso();
  const window = consistencyWindow(today);
  const dates =
    window === null ? [] : await getLogDatesBetween(window.start, window.endExclusive);

  const counts = new Map<string, number>();
  for (const date of dates) {
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  const consistency = buildConsistency(counts, today);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            Consistency
          </p>
          <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
            Keep showing up.
          </h1>
        </div>

        <Link
          href={`/app/logs/new?date=${today}`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Log today
        </Link>
      </header>

      <section
        aria-label="Consistency"
        className="grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800"
      >
        <Stat label="Current streak" value={consistency.currentStreak} unit="days" />
        <Stat
          label="Longest run"
          value={consistency.longestStreak}
          unit="days"
        />
        <Stat
          label="Days logged"
          value={consistency.daysLogged}
          unit={`of ${consistency.windowDays}`}
        />
        <Stat
          label="This month"
          value={consistency.thisMonth}
          unit={
            consistency.lastMonth === 0
              ? "entries"
              : `entries · ${consistency.lastMonth} last month`
          }
        />
      </section>

      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            Last {CONSISTENCY_WEEKS} weeks
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {consistency.entriesLogged}{" "}
            {consistency.entriesLogged === 1 ? "entry" : "entries"} written
          </p>
        </div>

        {consistency.weeks.length === 0 ? (
          <p className="mt-6 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
            Nothing to measure yet.
          </p>
        ) : (
          <div className="mt-6 flex gap-2">
            <WeekdayGutter />

            <div className="min-w-0 flex-1 overflow-x-auto pb-1">
              <div
                role="img"
                aria-label={summary(consistency.daysLogged, consistency.entriesLogged, consistency.windowDays)}
              >
                <div className="flex min-w-max gap-1 pb-1">
                  {consistency.weeks.map((week, index) => (
                    <span
                      key={week.start}
                      className="w-3 shrink-0 text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600"
                    >
                      {monthTick(week, consistency.weeks[index - 1])}
                    </span>
                  ))}
                </div>

                <div className="flex min-w-max gap-1">
                  {consistency.weeks.map((week) => (
                    <div key={week.start} className="flex w-3 shrink-0 flex-col gap-1">
                      {week.days.map((day) => (
                        <span
                          key={day.date}
                          title={cellTitle(day)}
                          className={`h-3 w-3 rounded-[2px] ${tone(day)}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <Legend />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="bg-white px-4 py-5 dark:bg-zinc-950">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-3 text-2xl font-medium tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        {unit}
      </p>
    </div>
  );
}

/**
 * Monday, Wednesday, Friday: enough orientation to read the columns without
 * repeating the same word seven times.
 */
function WeekdayGutter() {
  return (
    <div
      aria-hidden="true"
      className="grid shrink-0 grid-rows-7 gap-1 pt-5 text-[10px] uppercase leading-3 text-zinc-400 dark:text-zinc-600"
    >
      {["Mon", "", "Wed", "", "Fri", "", ""].map((label, index) => (
        <span key={index}>{label}</span>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
      <span>Fewer</span>
      {["bg-zinc-200 dark:bg-zinc-800", "bg-zinc-300 dark:bg-zinc-700", "bg-zinc-400 dark:bg-zinc-600", "bg-zinc-500 dark:bg-zinc-500", "bg-zinc-700 dark:bg-zinc-300"].map(
        (tone) => (
          <span key={tone} className={`h-3 w-3 rounded-[2px] ${tone}`} />
        ),
      )}
      <span>More</span>
    </div>
  );
}

/**
 * The step of grey a square gets. Four is the ceiling: past that the archive
 * is not more consistent, just more talkative, and the darkest tone is
 * already the strongest thing on the page.
 */
function tone(day: ConsistencyDay): string {
  if (day.future) {
    return "bg-zinc-100 dark:bg-zinc-900";
  }
  if (day.isToday) {
    return "ring-1 ring-inset ring-zinc-400 dark:ring-zinc-600 " + fill(day.count);
  }
  return fill(day.count);
}

function fill(count: number): string {
  switch (count) {
    case 0:
      return "bg-zinc-200 dark:bg-zinc-800";
    case 1:
      return "bg-zinc-300 dark:bg-zinc-700";
    case 2:
      return "bg-zinc-400 dark:bg-zinc-600";
    case 3:
      return "bg-zinc-500 dark:bg-zinc-500";
    default:
      return "bg-zinc-700 dark:bg-zinc-300";
  }
}

function cellTitle(day: ConsistencyDay): string {
  if (day.future) {
    return formatLoggedOn(day.date);
  }
  return `${formatLoggedOn(day.date)} — ${day.count} ${day.count === 1 ? "log" : "logs"}`;
}

/** The month a column belongs to, labelled once where the month turns over. */
function monthTick(week: ConsistencyWeek, previous: ConsistencyWeek | undefined): string {
  const month = monthOfDate(week.start);
  if (month === null) {
    return "";
  }
  if (previous !== undefined) {
    const before = monthOfDate(previous.start);
    if (before !== null && before.month === month.month) {
      return "";
    }
  }
  return MONTH_ABBREVIATIONS[month.month - 1];
}

function summary(daysLogged: number, entriesLogged: number, windowDays: number): string {
  return `Consistency over the last ${windowDays} days: ${daysLogged} days written, ${entriesLogged} entries.`;
}
