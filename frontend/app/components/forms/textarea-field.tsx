"use client";

import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";

import { FieldFrame } from "@/app/components/forms/field-frame";

type TextAreaFieldProps = {
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  hint?: string;
  value: string;
  onValueChange: (value: string) => void;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "id"
>;

/** A labelled multi-line text input with inline validation wiring. */
export function TextAreaField({
  label,
  help,
  error,
  hint,
  value,
  onValueChange,
  rows = 4,
  ...textareaProps
}: TextAreaFieldProps) {
  const controlId = useId();
  return (
    <FieldFrame
      controlId={controlId}
      label={label}
      help={help}
      error={error}
      hint={hint}
    >
      {({ describedBy, invalid }) => (
        <textarea
          {...textareaProps}
          className="field__input field__textarea"
          id={controlId}
          rows={rows}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </FieldFrame>
  );
}
