"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { FormStatus } from "@/app/components/forms/form-status";
import { SubmitButton } from "@/app/components/forms/submit-button";
import { TextField } from "@/app/components/forms/text-field";
import { supabaseAuthActions } from "@/app/lib/auth/client-actions";
import type { AuthActions, AuthFailure } from "@/app/lib/auth/types";
import { validateEmail } from "@/app/lib/auth/validate";
import { useOnlineStatus } from "@/app/lib/hooks/use-online-status";

type ForgotPasswordFormProps = {
  actions?: Pick<AuthActions, "requestPasswordReset">;
};

export function ForgotPasswordForm({
  actions = supabaseAuthActions,
}: ForgotPasswordFormProps) {
  const online = useOnlineStatus();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const emailError = validateEmail(email);
    setFieldError(emailError);
    if (emailError) return;

    setFailure(null);
    setPending(true);
    try {
      const result = await actions.requestPasswordReset({
        email: email.trim(),
      });
      if (result.ok) {
        // Neutral confirmation regardless of whether the address is registered.
        setSent(true);
        return;
      }
      setFailure(result);
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <>
        <div className="auth-card__head">
          <h1>Check your email</h1>
          <p>
            If an account exists for <strong>{email.trim()}</strong>,
            we&rsquo;ve sent a link to reset your password. The link expires
            soon for your security.
          </p>
        </div>
        <p className="auth-card__foot">
          <Link href="/sign-in">Back to sign in</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="auth-card__head">
        <h1>Reset your password</h1>
        <p>Enter your email and we&rsquo;ll send you a reset link.</p>
      </div>

      {!online ? (
        <FormStatus tone="offline">
          You&rsquo;re offline. Reconnect to request a reset link.
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
          error={fieldError}
          required
        />
        <SubmitButton pending={pending} pendingLabel="Sending link…">
          Send reset link
        </SubmitButton>
      </form>

      <p className="auth-card__foot">
        Remembered it? <Link href="/sign-in">Back to sign in</Link>
      </p>
    </>
  );
}
