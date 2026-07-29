"use client";

import { useId, type ReactNode } from "react";

export type RadioOption<T extends string> = {
  value: T;
  label: string;
  /** Optional supporting line rendered under the option label. */
  description?: string;
};

type RadioGroupFieldProps<T extends string> = {
  legend: ReactNode;
  help?: ReactNode;
  error?: string;
  name?: string;
  value: T | undefined;
  onValueChange: (value: T) => void;
  options: readonly RadioOption<T>[];
};

/**
 * An accessible single-choice group built on `fieldset`/`legend` and native
 * radios, so arrow-key navigation and screen-reader grouping work for free.
 */
export function RadioGroupField<T extends string>({
  legend,
  help,
  error,
  name,
  value,
  onValueChange,
  options,
}: RadioGroupFieldProps<T>) {
  const reactId = useId();
  const groupName = name ?? reactId;
  const helpId = help ? `${reactId}-help` : undefined;
  const errorId = error ? `${reactId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

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
                name={groupName}
                value={option.value}
                checked={value === option.value}
                onChange={() => onValueChange(option.value)}
              />
              <span className="radio-option__body">
                <span className="radio-option__label">{option.label}</span>
                {option.description ? (
                  <span className="radio-option__description">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
