import { AuthError, isAuthApiError } from "@supabase/supabase-js";

import type { AuthFailure } from "@/app/lib/auth/types";

/**
 * Maps a Supabase auth error (or an unknown thrown value) onto a normalized
 * {@link AuthFailure}. Messages are safe to show and avoid leaking whether an
 * account exists.
 */
export function toAuthFailure(error: unknown): AuthFailure {
  if (isAuthApiError(error)) {
    const status = error.status;
    const code = error.code ?? "";

    if (
      status === 429 ||
      code === "over_request_rate_limit" ||
      code === "over_email_send_rate_limit"
    ) {
      return {
        ok: false,
        kind: "rate_limited",
        message: "Too many attempts. Please wait a minute before trying again.",
      };
    }
    if (code === "invalid_credentials" || status === 400) {
      return {
        ok: false,
        kind: "invalid_credentials",
        message: "That email and password combination is not correct.",
      };
    }
    if (code === "weak_password") {
      return {
        ok: false,
        kind: "weak_password",
        message: "Choose a stronger password with at least 8 characters.",
        fieldErrors: { password: "Choose a stronger password." },
      };
    }
    if (code === "otp_expired" || code === "flow_state_expired") {
      return {
        ok: false,
        kind: "expired_link",
        message: "That link has expired. Request a new one to continue.",
      };
    }
  }

  if (error instanceof AuthError) {
    return { ok: false, kind: "unknown", message: error.message };
  }

  if (error instanceof TypeError) {
    // fetch throws TypeError when the network is unreachable.
    return {
      ok: false,
      kind: "offline",
      message: "You appear to be offline. Check your connection and try again.",
    };
  }

  return {
    ok: false,
    kind: "unknown",
    message: "Something went wrong. Please try again.",
  };
}
