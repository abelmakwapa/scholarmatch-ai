"use client";

import { useId, type ReactNode } from "react";

import {
  PREFER_NOT_TO_SAY,
  UNKNOWN,
  provided,
  type Disclosure,
  type DisclosureStatus,
} from "@/app/lib/onboarding/types";

type DisclosureFieldProps<T> = {
  legend: ReactNode;
  help?: ReactNode;
  error?: string;
  value: Disclosure<T> | undefined;
  onChange: (next: Disclosure<T>) => void;
  /** Label for the "I'll share it" choice. */
  provideLabel: string;
  unknownLabel?: string;
  preferNotLabel?: string;
  /**
   * Renders the value control shown when the student chooses to share. Receives
   * the current concrete value (if any) and a setter that wraps it back into a
   * `provided` disclosure.
   */
  children: (args: {
    value: T | undefined;
    setValue: (value: T) => void;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
};

/**
 * A sensitive/optional question that preserves the distinction between a shared
 * value, "unknown", and "prefer not to say". None of these collapse into an
 * empty or negative answer.
 */
export function DisclosureField<T>({
  legend,
  help,
  error,
  value,
  onChange,
  provideLabel,
  unknownLabel = "I don't know yet",
  preferNotLabel = "Prefer not to say",
  children,
}: DisclosureFieldProps<T>) {
  const reactId = useId();
  const helpId = help ? `${reactId}-help` : undefined;
  const errorId = error ? `${reactId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

  const status: DisclosureStatus | undefined = value?.status;

  const choose = (nextStatus: DisclosureStatus) => {
    if (nextStatus === "provided") {
      // Preserve any concrete value the student already typed.
      onChange(
        value?.status === "provided" ? value : provided<T>(undefined as T),
      );
    } else if (nextStatus === "unknown") {
      onChange(UNKNOWN);
    } else {
      onChange(PREFER_NOT_TO_SAY);
    }
  };

  const options: { value: DisclosureStatus; label: string }[] = [
    { value: "provided", label: provideLabel },
    { value: "unknown", label: unknownLabel },
    { value: "prefer_not_to_say", label: preferNotLabel },
  ];

  return (
    <fieldset
      className="field field--group"
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
    >
      <legend className="field__label">{legend}</legend>
      {help ? (
        <p className="field__help" id={helpId}>
          {help}
        </p>
      ) : null}
      <div className="radio-group">
        {options.map((option) => {
          const optionId = `${reactId}-${option.value}`;
          return (
            <label
              className="radio-option"
              htmlFor={optionId}
              key={option.value}
            >
              <input
                type="radio"
                id={optionId}
                name={reactId}
                checked={status === option.value}
                onChange={() => choose(option.value)}
              />
              <span className="radio-option__body">
                <span className="radio-option__label">{option.label}</span>
              </span>
            </label>
          );
        })}
      </div>
      {status === "provided" ? (
        <div className="disclosure-field__value">
          {children({
            value: value?.status === "provided" ? value.value : undefined,
            setValue: (next) => onChange(provided(next)),
            describedBy,
            invalid: Boolean(error),
          })}
        </div>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
