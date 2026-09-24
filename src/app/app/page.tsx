import { requireUser, getCurrentProfile } from "@/lib/auth";
import { PILLARS } from "@/lib/pillars";

export default async function AppPage() {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 sm:px-8">
      <section className="pb-12">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Private application
        </p>
        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome.
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-7 text-zinc-600 dark:text-zinc-400">
          You are authenticated as {user.email}. This is the protected area —
          your logs will live here in a later phase.
        </p>
      </section>

      <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Your pillar compass
        </h2>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
          {PILLARS.map((pillar) => (
            <li
              key={pillar}
              className="text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400"
            >
              {pillar}
            </li>
          ))}
        </ul>
      </section>

      {profile && (
        <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
            Account
          </h2>
          <dl className="mt-4 flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="flex justify-between gap-4">
              <dt>Email</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                {profile.email ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Member since</dt>
              <dd className="text-zinc-900 dark:text-zinc-50">
                {memberSince?.toISOString().slice(0, 10) ?? "—"}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </main>
  );
}