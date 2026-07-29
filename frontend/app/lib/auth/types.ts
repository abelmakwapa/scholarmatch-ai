/** Normalized outcomes for auth operations so UI never touches raw SDK errors. */

export type AuthErrorKind =
  | "invalid_credentials"
  | "rate_limited"
  | "offline"
  | "weak_password"
  | "expired_link"
  | "validation"
  | "unknown";

export type AuthFailure = {
  ok: false;
  kind: AuthErrorKind;
  message: string;
  /** Field-level messages keyed by form field name for inline display. */
  fieldErrors?: Record<string, string>;
  /** Seconds to wait, when the failure is a rate limit. */
  retryAfterSeconds?: number;
};

export type AuthSuccess = { ok: true };

export type AuthOutcome = AuthSuccess | AuthFailure;

/** Sign-up needs richer outcomes than a plain success. */
export type SignUpOutcome =
  | { ok: true; status: "verification_sent" }
  // Supabase hides whether an email already exists to prevent enumeration; we
  // surface a neutral message that works whether or not the account is new.
  | { ok: true; status: "possibly_existing" }
  | AuthFailure;

/** The operations an auth form depends on; injectable for testing. */
export type AuthActions = {
  signUp: (input: {
    email: string;
    password: string;
  }) => Promise<SignUpOutcome>;
  signIn: (input: { email: string; password: string }) => Promise<AuthOutcome>;
  requestPasswordReset: (input: { email: string }) => Promise<AuthOutcome>;
  updatePassword: (input: { password: string }) => Promise<AuthOutcome>;
  resendVerification: (input: { email: string }) => Promise<AuthOutcome>;
};
