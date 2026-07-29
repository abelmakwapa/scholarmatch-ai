"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { FormStatus } from "@/app/components/forms/form-status";
import { PasswordField } from "@/app/components/forms/password-field";
import { SubmitButton } from "@/app/components/forms/submit-button";
import { TextField } from "@/app/components/forms/text-field";
import { supabaseAuthActions } from "@/app/lib/auth/client-actions";
import type { AuthActions, AuthFailure } from "@/app/lib/auth/types";
import { validateEmail } from "@/app/lib/auth/validate";
import { useOnlineStatus } from "@/app/lib/hooks/use-online-status";
import { sanitizeRedirectPath } from "@/app/lib/routing/safe-redirect";

const REASON_MESSAGES: Record<string, string> = {
  "session-expired": "Your session expired. Please sign in again to continue.",
  "link-invalid": "That link is invalid or has expired. Please sign in.",
};

type SignInFormProps = {
  /** Injectable for tests; defaults to the Supabase-backed actions. */
  actions?: Pick<AuthActions, "signIn">;
};

export function SignInForm({ actions = supabaseAuthActions }: SignInFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const online = useOnlineStatus();

  const next = useMemo(
    () => sanitizeRedirectPath(searchParams.get("next")),
    [searchParams],
  );
  const reason = searchParams.get("reason");
  const reasonMessage = reason ? REASON_MESSAGES[reason] : undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return; // guard against double submission

    const nextErrors: Record<string, string> = {};
    const emailError = validateEmail(email);
    const passwordError =
      password.length === 0 ? "Enter your password." : undefined;
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setFailure(null);
    setPending(true);
    try {
      const result = await actions.signIn({ email: email.trim(), password });
      if (result.ok) {
        router.replace(next);
        router.refresh();
        return; // keep the button disabled through navigation
      }
      setFailure(result);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="auth-card__head">
        <h1>Welcome back</h1>
        <p>Sign in to pick up your scholarship matches.</p>
      </div>

      {reasonMessage ? (
        <FormStatus tone="info">{reasonMessage}</FormStatus>
      ) : null}
      {!online ? (
        <FormStatus tone="offline">
          You&rsquo;re offline. Reconnect to sign in.
        </FormStatus>
      ) : null}
      {failure ? <FormStatus tone="error">{failure.message}</FormStatus> : null}

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onValueChange={setEmail}
          error={fieldErrors.email}
          required
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onValueChange={setPassword}
          error={fieldErrors.password}
          required
        />
        <div className="auth-form__row">
          <Link className="auth-link" href="/forgot-password">
            Forgot your password?
          </Link>
        </div>
        <SubmitButton pending={pending} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <p className="auth-card__foot">
        New to ScholarMatch? <Link href="/sign-up">Create an account</Link>
      </p>
    </>
  );
}
