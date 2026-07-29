"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { FormStatus } from "@/app/components/forms/form-status";
import { supabaseAuthActions } from "@/app/lib/auth/client-actions";
import type { AuthActions } from "@/app/lib/auth/types";
import { useOnlineStatus } from "@/app/lib/hooks/use-online-status";

type VerifyEmailViewProps = {
  actions?: Pick<AuthActions, "resendVerification">;
};

export function VerifyEmailView({
  actions = supabaseAuthActions,
}: VerifyEmailViewProps) {
  const searchParams = useSearchParams();
  const online = useOnlineStatus();
  const email = searchParams.get("email") ?? "";

  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const handleResend = async () => {
    if (pending || email.length === 0) return;
    setNotice(null);
    setPending(true);
    try {
      const result = await actions.resendVerification({ email });
      setNotice(
        result.ok
          ? { tone: "success", message: "We've sent another link." }
          : { tone: "error", message: result.message },
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="auth-card__head">
        <span className="auth-card__icon" aria-hidden="true">
          <MailCheck size={22} />
        </span>
        <h1>Confirm your email</h1>
        <p>
          {email.length > 0 ? (
            <>
              We&rsquo;ve sent a confirmation link to <strong>{email}</strong>.
              Open it to activate your account and start onboarding.
            </>
          ) : (
            <>
              We&rsquo;ve sent you a confirmation link. Open it to activate your
              account and start onboarding.
            </>
          )}
        </p>
      </div>

      {!online ? (
        <FormStatus tone="offline">
          You&rsquo;re offline. Reconnect to resend the link.
        </FormStatus>
      ) : null}
      {notice ? (
        <FormStatus tone={notice.tone}>{notice.message}</FormStatus>
      ) : null}

      <div className="auth-form">
        <button
          type="button"
          className="form-submit form-submit--ink"
          onClick={handleResend}
          disabled={pending || email.length === 0}
          aria-busy={pending || undefined}
        >
          {pending ? "Resending…" : "Resend confirmation link"}
        </button>
      </div>

      <p className="auth-card__foot">
        Already confirmed? <Link href="/sign-in">Sign in</Link>
      </p>
    </>
  );
}
