import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6 sm:px-8">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Again
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400">
            {user.email}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {children}
    </div>
  );
}