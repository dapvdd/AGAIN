import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSupabaseEnv } from "./env";

/**
 * Builds the Supabase client used inside the Next.js proxy. Session cookies
 * are read from the incoming request and written back onto the response so
 * token refreshes survive the request cycle.
 */
export function createSupabaseProxyClient(
  request: NextRequest,
  response: NextResponse,
) {
  const { url, anonKey } = requireSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
