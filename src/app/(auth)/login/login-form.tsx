"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const next = searchParams.get("next") ?? "/app";
  const redirectTo = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          throw signUpError;
        }
        if (data.session) {
          router.replace(redirectTo);
          router.refresh();
          return;
        }
        setInfo(
          "Account created. Check your email to confirm your address before signing in.",
        );
        setMode("signin");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        throw signInError;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  function toggleMode() {
    setMode((current) => (current === "signin" ? "signup" : "signin"));
    setError(null);
    setInfo(null);
  }

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-400";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={8}
          required
          className={inputClass}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {info && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{info}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending
          ? "Working…"
          : mode === "signin"
            ? "Sign in"
            : "Create account"}
      </button>

      <button
        type="button"
        onClick={toggleMode}
        className="text-xs tracking-wide text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        {mode === "signin"
          ? "No account? Sign up"
          : "Have an account? Sign in"}
      </button>
    </form>
  );
}