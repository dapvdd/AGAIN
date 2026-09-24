import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Profile } from "@/lib/types";

/**
 * Authoritative session check. Returns the authenticated Supabase user, or
 * null when unauthenticated. Reads the HttpOnly session cookies and verifies
 * them with Supabase Auth (never trusts the cookie payload alone).
 *
 * Returns null when Supabase env vars are not configured so the app degrades
 * to "unauthenticated" instead of crashing.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!getSupabaseEnv()) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
});

/**
 * Like getCurrentUser, but redirects unauthenticated visitors to /login.
 * Use this at the entry of any protected Server Component, Server Action, or
 * Route Handler.
 */
export const requireUser = cache(async (): Promise<User> => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
});

/**
 * Fetches the current user's own profile row. RLS guarantees only the owner's
 * row is visible, so this can never return another user's data.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return null;
    }

    return (data as Profile | null) ?? null;
  } catch {
    return null;
  }
});
