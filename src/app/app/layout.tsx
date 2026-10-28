import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { QuickLog } from "@/components/quick-log";
import { requireUser } from "@/lib/auth";
import { getPillars } from "@/lib/logs";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const pillars = await getPillars();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Five things on one line does not fit a phone. The header wraps, and
          below `sm` the section links and the sign-out take a row of their
          own rather than squeezing the wordmark off the edge. */}
      <header className="relative mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-4 px-6 py-6 sm:gap-x-4 sm:px-8">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Again
        </Link>
        <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end sm:gap-3">
          <QuickLog pillars={pillars} />
          <AppNav />
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400">
              {user.email}
            </span>
            <a
              href="/api/export"
              className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
            >
              Export
            </a>
            <form action={signOut}>
              <button
                type="submit"
                className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}