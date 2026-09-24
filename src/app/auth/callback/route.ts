import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    try {
      if (getSupabaseEnv()) {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          return NextResponse.redirect(`${origin}${next}`);
        }
      }
    } catch {
      // Fall through to login.
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}