"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type SubmitButtonProps = {
  children: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
  tone?: "accent" | "ink";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

/**
 * A submit button that shows a pending state and disables itself while a
 * request is in flight, preventing double submission. The pending label is
 * announced via an adjacent live region.
 */
export function SubmitButton({
  children,
  pending = false,
  pendingLabel = "Working…",
  tone = "accent",
  disabled,
  ...buttonProps
}: SubmitButtonProps) {
  return (
    <button
      {...buttonProps}
      type="submit"
      className={`form-submit form-submit--${tone}`}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <Loader2
            aria-hidden="true"
            className="form-submit__spinner"
            size={18}
          />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
