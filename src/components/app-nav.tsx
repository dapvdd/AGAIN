"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/app", label: "Logs" },
  { href: "/app/history", label: "History" },
  { href: "/app/search", label: "Search" },
] as const;

const idleClass =
  "text-xs uppercase tracking-widest text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100";

const activeClass =
  "text-xs uppercase tracking-widest text-zinc-900 underline underline-offset-4 dark:text-zinc-50";

/**
 * The ways into the archive: by time, by calendar, and by words. Nothing here
 * fetches: the only reason this is a client component is to mark where you
 * already are.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="flex items-center gap-4">
      {ITEMS.map((item) => {
        // /app is the list, so it must not light up for /app/history.
        const active =
          item.href === "/app"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={active ? activeClass : idleClass}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
