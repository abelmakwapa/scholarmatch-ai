"use client";

import { getPublicEnv } from "@/app/lib/env";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import { toAuthFailure } from "@/app/lib/auth/errors";
import type {
  AuthActions,
  AuthOutcome,
  SignUpOutcome,
} from "@/app/lib/auth/types";

function confirmUrl(next: string): string {
  const { siteUrl } = getPublicEnv();
  const params = new URLSearchParams({ next });
  return `${siteUrl}/auth/confirm?${params.toString()}`;
}

/** Supabase-backed auth actions used by the auth forms in production. */
export const supabaseAuthActions: AuthActions = {
  async signUp({ email, password }): Promise<SignUpOutcome> {
    const supabase = getSupabaseBrowserClient();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: confirmUrl("/onboarding") },
      });
      if (error) {
        return toAuthFailure(error);
      }
      // Supabase returns a user with no identities when the email is already
      // registered, to avoid disclosing account existence.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        return { ok: true, status: "possibly_existing" };
      }
      return { ok: true, status: "verification_sent" };
    } catch (cause) {
      return toAuthFailure(cause);
    }
  },

  async signIn({ email, password }): Promise<AuthOutcome> {
    const supabase = getSupabaseBrowserClient();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return error ? toAuthFailure(error) : { ok: true };
    } catch (cause) {
      return toAuthFailure(cause);
    }
  },

  async requestPasswordReset({ email }): Promise<AuthOutcome> {
    const supabase = getSupabaseBrowserClient();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: confirmUrl("/reset-password"),
      });
      return error ? toAuthFailure(error) : { ok: true };
    } catch (cause) {
      return toAuthFailure(cause);
    }
  },

  async updatePassword({ password }): Promise<AuthOutcome> {
    const supabase = getSupabaseBrowserClient();
    try {
      const { error } = await supabase.auth.updateUser({ password });
      return error ? toAuthFailure(error) : { ok: true };
    } catch (cause) {
      return toAuthFailure(cause);
    }
  },

  async resendVerification({ email }): Promise<AuthOutcome> {
    const supabase = getSupabaseBrowserClient();
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: confirmUrl("/onboarding") },
      });
      return error ? toAuthFailure(error) : { ok: true };
    } catch (cause) {
      return toAuthFailure(cause);
    }
  },
};
