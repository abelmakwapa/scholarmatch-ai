"use client";

import { useId, type ReactNode } from "react";

type CheckboxFieldProps = {
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** A single labelled checkbox with inline help and error. */
export function CheckboxField({
  label,
  help,
  error,
  checked,
  onCheckedChange,
}: CheckboxFieldProps) {
  const controlId = useId();
  const helpId = help ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div
      className="field field--checkbox"
      data-invalid={error ? "true" : undefined}
    >
      <div className="checkbox-row">
        <input
          type="checkbox"
          id={controlId}
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
        />
        <label htmlFor={controlId}>{label}</label>
      </div>
      {help ? (
        <p className="field__help" id={helpId}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
