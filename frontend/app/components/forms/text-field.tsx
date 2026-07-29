"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { FieldFrame } from "@/app/components/forms/field-frame";

type TextFieldProps = {
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  hint?: string;
  value: string;
  onValueChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">;

/** A labelled single-line text input with inline validation wiring. */
export function TextField({
  label,
  help,
  error,
  hint,
  value,
  onValueChange,
  type = "text",
  ...inputProps
}: TextFieldProps) {
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
        <input
          {...inputProps}
          className="field__input"
          id={controlId}
          type={type}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </FieldFrame>
  );
}
