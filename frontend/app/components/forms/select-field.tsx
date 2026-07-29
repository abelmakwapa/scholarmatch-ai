"use client";

import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

import { FieldFrame } from "@/app/components/forms/field-frame";

export type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  hint?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "id">;

/** A labelled native select with an optional placeholder option. */
export function SelectField({
  label,
  help,
  error,
  hint,
  value,
  onValueChange,
  options,
  placeholder,
  ...selectProps
}: SelectFieldProps) {
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
        <select
          {...selectProps}
          className="field__input field__select"
          id={controlId}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldFrame>
  );
}
