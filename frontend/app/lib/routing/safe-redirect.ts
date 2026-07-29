/**
 * Utilities for preserving an intended destination across authentication
 * redirects without opening an open-redirect hole.
 *
 * A safe destination is an in-app, absolute path: it starts with a single `/`,
 * is not protocol-relative (`//host`), and carries no scheme or authority.
 */

const DEFAULT_DESTINATION = "/dashboard";

/**
 * Returns `candidate` when it is a same-origin absolute path, otherwise
 * `fallback`. Query strings and fragments are preserved; hosts and schemes are
 * rejected.
 */
export function sanitizeRedirectPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_DESTINATION,
): string {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return fallback;
  }

  // Must be an absolute path but not protocol-relative (`//evil.com`) and not a
  // backslash-obfuscated variant (`/\evil.com`).
  if (!candidate.startsWith("/")) {
    return fallback;
  }
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return fallback;
  }

  // Reject anything that smuggles a scheme or control characters.
  if (/[\x00-\x1f]/.test(candidate) || candidate.includes("://")) {
    return fallback;
  }

  return candidate;
}

/**
 * Builds a sign-in URL that remembers where the user was heading. Only the
 * path portion is stored, already sanitized, so the value is safe to echo back
 * into a redirect later.
 */
export function buildSignInUrl(
  intendedPath: string,
  options: { reason?: "session-expired" } = {},
): string {
  const params = new URLSearchParams();
  const next = sanitizeRedirectPath(intendedPath);
  if (next !== DEFAULT_DESTINATION) {
    params.set("next", next);
  }
  if (options.reason) {
    params.set("reason", options.reason);
  }
  const query = params.toString();
  return query ? `/sign-in?${query}` : "/sign-in";
}

export { DEFAULT_DESTINATION };
