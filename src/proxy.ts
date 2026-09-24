import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseProxyClient } from "@/lib/supabase/proxy";
import { getSupabaseEnv } from "@/lib/supabase/env";

const PROTECTED_PREFIX = "/app";
const AUTH_ONLY_PATHS = new Set(["/login", "/signup"]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = pathname.startsWith(PROTECTED_PREFIX);
  const isAuthOnly = AUTH_ONLY_PATHS.has(pathname);

  // If Supabase environment is not configured, redirect protected routes to login
  if (!getSupabaseEnv()) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request: { headers: request.headers } });
  }

  const response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createSupabaseProxyClient(request, response);

  // getUser() verifies the token with Supabase Auth (optimistic but verified).
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (isProtected && (!user || error)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (isAuthOnly && user && !error) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

