"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { FormStatus } from "@/app/components/forms/form-status";
import { PasswordField } from "@/app/components/forms/password-field";
import { SubmitButton } from "@/app/components/forms/submit-button";
import { supabaseAuthActions } from "@/app/lib/auth/client-actions";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { AuthActions, AuthFailure } from "@/app/lib/auth/types";
import {
  MIN_PASSWORD_LENGTH,
  validatePassword,
  validatePasswordConfirmation,
} from "@/app/lib/auth/validate";
import { useOnlineStatus } from "@/app/lib/hooks/use-online-status";

type SessionState = "checking" | "ready" | "no-session";

type ResetPasswordFormProps = {
  actions?: Pick<AuthActions, "updatePassword">;
  /** Resolves whether a recovery session is present; injectable for tests. */
  checkSession?: () => Promise<boolean>;
  /** Skips the async session probe when set (test convenience). */
  initialState?: SessionState;
};

async function defaultCheckSession(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return Boolean(session);
}

export function ResetPasswordForm({
  actions = supabaseAuthActions,
  checkSession = defaultCheckSession,
  initialState,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [sessionState, setSessionState] = useState<SessionState>(
    initialState ?? "checking",
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (initialState) return;
    let active = true;
    checkSession()
      .then((ok) => {
        if (active) setSessionState(ok ? "ready" : "no-session");
      })
      .catch(() => {
        if (active) setSessionState("no-session");
      });
    return () => {
      active = false;
    };
  }, [checkSession, initialState]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const nextErrors: Record<string, string> = {};
    const passwordError = validatePassword(password);
    const confirmError = validatePasswordConfirmation(password, confirmation);
    if (passwordError) nextErrors.password = passwordError;
    if (confirmError) nextErrors.confirmation = confirmError;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setFailure(null);
    setPending(true);
    try {
      const result = await actions.updatePassword({ password });
      if (result.ok) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setFailure(result);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    } finally {
      setPending(false);
    }
  };

  if (sessionState === "checking") {
    return (
      <div className="auth-card__head">
        <h1>Reset your password</h1>
        <p aria-live="polite">Checking your reset link…</p>
      </div>
    );
  }

  if (sessionState === "no-session") {
    return (
      <>
        <div className="auth-card__head">
          <h1>Link expired</h1>
          <p>
            This password reset link is invalid or has expired. Request a fresh
            one to continue.
          </p>
        </div>
        <p className="auth-card__foot">
          <Link href="/forgot-password">Request a new link</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="auth-card__head">
        <h1>Choose a new password</h1>
        <p>Set a new password to finish signing in.</p>
      </div>

      {!online ? (
        <FormStatus tone="offline">
          You&rsquo;re offline. Reconnect to update your password.
        </FormStatus>
      ) : null}
      {failure ? <FormStatus tone="error">{failure.message}</FormStatus> : null}

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <PasswordField
          label="New password"
          name="new-password"
          autoComplete="new-password"
          help={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password}
          onValueChange={setPassword}
          error={fieldErrors.password}
          required
        />
        <PasswordField
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirmation}
          onValueChange={setConfirmation}
          error={fieldErrors.confirmation}
          required
        />
        <SubmitButton pending={pending} pendingLabel="Updating…">
          Update password
        </SubmitButton>
      </form>
    </>
  );
}
