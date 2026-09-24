import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/app");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-10">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Again
        </Link>
        <h1 className="mt-4 text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Sign in to continue.
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          A private space. Your data stays yours.
        </p>
      </div>

      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}