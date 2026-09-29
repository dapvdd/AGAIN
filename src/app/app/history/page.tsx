import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLogDatesByMonth, getLogsByDate } from "@/lib/logs";
import { isDateOnly, todayIso } from "@/lib/log-input";
import { formatLoggedOn } from "@/lib/format";
import {
  WEEKDAY_LABELS,
  addMonths,
  calendarWeeks,
  formatMonth,
  isSameMonth,
  monthLabel,
  monthOfDate,
  parseMonth,
  toDateString,
  type CalendarMonth,
} from "@/lib/calendar";

/**
 * The archive as a month.
 *
 * The whole view is server-rendered and driven by two query parameters —
 * ?month=YYYY-MM and ?day=YYYY-MM-DD — rather than by client state. A day is
 * a URL, so it can be shared, bookmarked, and reached with the back button,
 * and the page needs no JavaScript to work. Both are validated before use: an
 * unparseable value falls back to the current month, and a day that is not in
 * the month being shown is not allowed to select anything.
 */
export default async function HistoryPage(props: PageProps<"/app/history">) {
  await requireUser();

  const params = await props.searchParams;
  const today = todayIso();
  const currentMonth = monthOfDate(today) ?? { year: 1970, month: 1 };

  const month = parseMonth(single(params.month)) ?? currentMonth;
  const day = resolveDay(single(params.day), month, today);

  const [loggedDays, dayLogs] = await Promise.all([
    getLogDatesByMonth(month),
    getLogsByDate(day),
  ]);

  const counts = new Map<string, number>();
  for (const date of loggedDays) {
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  const weeks = calendarWeeks(month);
  const previousMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            History
          </p>
          <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
            {monthLabel(month)}
          </h1>
        </div>

        <nav
          aria-label="Months"
          className="flex items-center gap-2 text-xs uppercase tracking-widest"
        >
          <MonthLink
            href={monthHref(previousMonth)}
            label="Previous month"
            ariaLabel="Previous month"
          >
            &#8249;
          </MonthLink>
          {isSameMonth(month, currentMonth) ? (
            <span className="px-2 text-zinc-400 dark:text-zinc-600">Today</span>
          ) : (
            <MonthLink
              href={monthHref(currentMonth)}
              label="This month"
              ariaLabel="This month"
            >
              Today
            </MonthLink>
          )}
          <MonthLink
            href={monthHref(nextMonth)}
            label="Next month"
            ariaLabel="Next month"
          >
            &#8250;
          </MonthLink>
        </nav>
      </header>

      <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
        <div className="grid grid-cols-7 gap-px bg-zinc-200 text-center dark:bg-zinc-800">
          {WEEKDAY_LABELS.map((label) => (
            <p
              key={label}
              className="bg-white py-2 text-[10px] uppercase tracking-widest text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400"
            >
              {label}
            </p>
          ))}
        </div>

        {weeks.map((week) => (
          <div
            key={week[0].date}
            className="grid grid-cols-7 gap-px border-t border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800"
          >
            {week.map((cell) => {
              const count = counts.get(cell.date) ?? 0;
              const isSelected = cell.date === day;
              const isToday = cell.date === today;

              const tone = isSelected
                ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : cell.inMonth
                  ? "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
                  : "bg-zinc-50 text-zinc-400 dark:bg-zinc-950/60 dark:text-zinc-700";

              const body = (
                <>
                  <span className="text-xs">{cell.day}</span>
                  {count > 0 ? (
                    <span className="flex items-center gap-1">
                      <span
                        className={
                          isSelected
                            ? "h-1 w-1 rounded-full bg-zinc-50 dark:bg-zinc-900"
                            : "h-1 w-1 rounded-full bg-zinc-900 dark:bg-zinc-100"
                        }
                      />
                      {count > 1 ? (
                        <span className="text-[10px] leading-none opacity-70">
                          {count}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </>
              );

              const className = [
                "flex min-h-14 flex-col items-center justify-between gap-1 p-2 sm:min-h-20",
                tone,
                isToday && !isSelected
                  ? "ring-1 ring-inset ring-zinc-400 dark:ring-zinc-600"
                  : "",
              ]
                .filter(Boolean)
                .join(" ");

              // Neighbouring months are shown for shape, not to be clicked.
              if (!cell.inMonth) {
                return (
                  <p key={cell.date} className={className} aria-hidden="true">
                    {body}
                  </p>
                );
              }

              return (
                <Link
                  key={cell.date}
                  href={`/app/history?month=${formatMonth(month)}&day=${cell.date}`}
                  prefetch={false}
                  scroll={false}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={
                    count > 0
                      ? `${cell.day} ${monthLabel(month)}, ${count} ${count === 1 ? "log" : "logs"}`
                      : `${cell.day} ${monthLabel(month)}, no logs`
                  }
                  className={className}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            {formatLoggedOn(day)}
          </h2>
          <Link
            href={`/app/logs/new?date=${day}`}
            className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            Log this day
          </Link>
        </div>

        {dayLogs.length === 0 ? (
          <p className="mt-4 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
            No logs.
            <br />
            That&apos;s okay.
            <br />
            AGAIN.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col">
            {dayLogs.map((log) => {
              const labels = [
                log.pillar,
                ...log.categories.map((category) => category.name),
              ].filter((label): label is string => Boolean(label));

              return (
                <li
                  key={log.id}
                  className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800"
                >
                  <Link
                    href={`/app/logs/${log.id}`}
                    className="group flex flex-col gap-1 py-4"
                  >
                    <p className="text-sm font-medium text-zinc-900 group-hover:underline dark:text-zinc-50">
                      {log.title ?? firstLine(log.body)}
                    </p>
                    {log.title ? (
                      <p className="line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                        {log.body}
                      </p>
                    ) : null}
                    {labels.length > 0 ? (
                      <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        {labels.join(" · ")}
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function MonthLink({
  href,
  label,
  ariaLabel,
  children,
}: {
  href: string;
  label: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      title={label}
      aria-label={ariaLabel}
      className="rounded-full border border-zinc-300 px-3 py-1.5 text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
    >
      {children}
    </Link>
  );
}

function monthHref(month: CalendarMonth): string {
  return `/app/history?month=${formatMonth(month)}`;
}

/**
 * searchParams values are `string | string[] | undefined`; a repeated or
 * malformed one is treated as absent rather than guessed at.
 */
function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * The day on show. A day must belong to the month on show — otherwise the
 * grid and the detail would disagree — so a stale or hand-edited day falls
 * back to today when today is in the month, and to the first of the month
 * otherwise. Never throws, never produces a date outside the month.
 */
function resolveDay(
  requested: string | undefined,
  month: CalendarMonth,
  today: string,
): string {
  if (requested !== undefined && isDateOnly(requested)) {
    const requestedMonth = monthOfDate(requested);
    if (requestedMonth && isSameMonth(requestedMonth, month)) {
      return requested;
    }
  }

  const todayMonth = monthOfDate(today);
  if (todayMonth && isSameMonth(todayMonth, month)) {
    return today;
  }

  return toDateString(month.year, month.month, 1);
}

/** An entry with no title still needs a heading in the list. */
function firstLine(body: string): string {
  const line = body.split("\n").find((candidate) => candidate.trim() !== "");
  return (line ?? body).trim();
}
