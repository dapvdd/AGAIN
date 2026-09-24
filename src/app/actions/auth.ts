"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function signOut(): Promise<void> {
  if (getSupabaseEnv()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Still fall through to redirect even if Supabase is unreachable.
    }
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
