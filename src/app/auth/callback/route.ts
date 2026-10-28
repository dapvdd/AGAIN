import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { safeNextPath } from "@/lib/redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // The same local-path rule the login form applies to its `next` parameter:
  // only same-origin paths pass, so an open-redirect cannot ship a user off
  // this host after a successful code exchange.
  const next = safeNextPath(searchParams.get("next"));

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
