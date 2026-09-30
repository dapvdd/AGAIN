import { CategoryManager } from "@/components/category-manager";
import { requireUser } from "@/lib/auth";
import { getCategorySummaries } from "@/lib/logs";

/**
 * The user's own vocabulary for the archive.
 *
 * Categories were always creatable from the log form, but only there, and
 * never renameable or removable. This is the surface where a label is a thing
 * the user maintains rather than something they happen to type into a form:
 * the log form still creates one inline, and this page owns the long view of
 * them.
 *
 * Server-rendered, no query parameters — there is nothing to choose and nothing
 * to put in a URL. Every write is a Server Action, so the session and RLS are
 * checked where the mutation happens, not here.
 */
export default async function CategoriesPage() {
  await requireUser();
  const categories = await getCategorySummaries();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <header className="pb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Categories
        </p>
        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Your own words for it.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The labels you use to find things again. They belong to you alone, and
          removing one never removes a log.
        </p>
      </header>

      <CategoryManager categories={categories} />
    </main>
  );
}
