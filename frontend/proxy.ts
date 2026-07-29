import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  buildSignInUrl,
  sanitizeRedirectPath,
} from "@/app/lib/routing/safe-redirect";
import { isAuthEntryPath, isProtectedPath } from "@/app/lib/routing/routes";
import { refreshSession } from "@/app/lib/supabase/proxy-session";

/**
 * Runs before matched requests to (1) keep the Supabase session cookie fresh
 * and (2) apply optimistic redirects. Authorization is still enforced by the
 * backend; this only improves UX by avoiding flashes of protected UI.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await refreshSession(request);
  const { pathname, search } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const target = buildSignInUrl(`${pathname}${search}`);
    return redirectPreservingCookies(request, target, response);
  }

  if (user && isAuthEntryPath(pathname)) {
    const next = sanitizeRedirectPath(request.nextUrl.searchParams.get("next"));
    return redirectPreservingCookies(request, next, response);
  }

  return response;
}

/**
 * Issues a redirect while carrying over any auth cookies the session refresh
 * rotated onto `source`, so a token refresh is never lost to a redirect.
 */
function redirectPreservingCookies(
  request: NextRequest,
  path: string,
  source: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of source.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  /*
   * Match all request paths except static assets and image optimization files.
   * Auth Route Handlers under /auth manage their own cookies and are excluded.
   */
  matcher: [
    "/((?!_next/static|_next/image|auth/|favicon.ico|icon|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
