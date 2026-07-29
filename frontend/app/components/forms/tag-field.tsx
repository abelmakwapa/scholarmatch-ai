"use client";

import { X } from "lucide-react";
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

import { FieldFrame } from "@/app/components/forms/field-frame";

type TagFieldProps = {
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  hint?: string;
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  maxItems?: number;
};

/**
 * A keyboard-friendly tag entry for lists like interests. Enter or comma adds a
 * tag; Backspace on an empty input removes the last one; each tag has its own
 * remove button.
 */
export function TagField({
  label,
  help,
  error,
  hint,
  values,
  onValuesChange,
  placeholder,
  maxItems = 50,
}: TagFieldProps) {
  const controlId = useId();
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag.length === 0) return;
    if (values.length >= maxItems) return;
    if (values.some((value) => value.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onValuesChange([...values, tag]);
    setDraft("");
  };

  const removeTag = (index: number) => {
    onValuesChange(values.filter((_, current) => current !== index));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
    } else if (
      event.key === "Backspace" &&
      draft.length === 0 &&
      values.length > 0
    ) {
      removeTag(values.length - 1);
    }
  };

  return (
    <FieldFrame
      controlId={controlId}
      label={label}
      help={help}
      error={error}
      hint={hint}
    >
      {({ describedBy, invalid }) => (
        <div className="tag-field">
          {values.length > 0 ? (
            <ul className="tag-field__list">
              {values.map((value, index) => (
                <li className="tag-field__tag" key={`${value}-${index}`}>
                  <span>{value}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(index)}
                    aria-label={`Remove ${value}`}
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            className="field__input"
            id={controlId}
            type="text"
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => addTag(draft)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            enterKeyHint="enter"
          />
          <span className="tag-field__status" aria-live="polite">
            {values.length > 0
              ? `${values.length} added`
              : "Type an interest and press Enter"}
          </span>
        </div>
      )}
    </FieldFrame>
  );
}
