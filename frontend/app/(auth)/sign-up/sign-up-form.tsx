"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormStatus } from "@/app/components/forms/form-status";
import { PasswordField } from "@/app/components/forms/password-field";
import { SubmitButton } from "@/app/components/forms/submit-button";
import { TextField } from "@/app/components/forms/text-field";
import { supabaseAuthActions } from "@/app/lib/auth/client-actions";
import type { AuthActions, AuthFailure } from "@/app/lib/auth/types";
import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from "@/app/lib/auth/validate";
import { useOnlineStatus } from "@/app/lib/hooks/use-online-status";

type SignUpFormProps = {
  actions?: Pick<AuthActions, "signUp">;
};

export function SignUpForm({ actions = supabaseAuthActions }: SignUpFormProps) {
  const router = useRouter();
  const online = useOnlineStatus();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const nextErrors: Record<string, string> = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmError = validatePasswordConfirmation(password, confirmation);
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;
    if (confirmError) nextErrors.confirmation = confirmError;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setFailure(null);
    setDuplicateNotice(false);
    setPending(true);
    try {
      const result = await actions.signUp({ email: email.trim(), password });
      if (result.ok) {
        if (result.status === "possibly_existing") {
          // Never confirm or deny that an account exists; offer a neutral path.
          setDuplicateNotice(true);
          return;
        }
        router.replace(
          `/verify-email?email=${encodeURIComponent(email.trim())}`,
        );
        return;
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
        <h1>Create your account</h1>
        <p>One profile, explainable matches. It takes a couple of minutes.</p>
      </div>

      {!online ? (
        <FormStatus tone="offline">
          You&rsquo;re offline. Reconnect to create your account.
        </FormStatus>
      ) : null}
      {duplicateNotice ? (
        <FormStatus tone="info">
          If an account already exists for this email, we&rsquo;ve sent a
          confirmation link. You can also{" "}
          <Link className="auth-link" href="/sign-in">
            sign in
          </Link>{" "}
          or{" "}
          <Link className="auth-link" href="/forgot-password">
            reset your password
          </Link>
          .
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
          name="new-password"
          autoComplete="new-password"
          help={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password}
          onValueChange={setPassword}
          error={fieldErrors.password}
          required
        />
        <PasswordField
          label="Confirm password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirmation}
          onValueChange={setConfirmation}
          error={fieldErrors.confirmation}
          required
        />
        <SubmitButton pending={pending} pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>

      <p className="auth-card__foot">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </>
  );
}
