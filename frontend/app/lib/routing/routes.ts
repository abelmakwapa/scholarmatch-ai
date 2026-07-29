/**
 * Central route classification shared by the Proxy and by client redirects so
 * that the two never disagree about which paths require a session.
 */

/** Paths that require an authenticated session. */
const PROTECTED_PREFIXES = ["/onboarding", "/dashboard"] as const;

/**
 * Auth entry pages an already-signed-in user should be bounced away from.
 * `/reset-password` is deliberately excluded: it needs an active recovery
 * session and must stay reachable while signed in.
 */
const AUTH_ENTRY_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/verify-email",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_PATHS.some((path) => pathname === path);
}
