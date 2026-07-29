"use client";

import { Eye, EyeOff } from "lucide-react";
import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { FieldFrame } from "@/app/components/forms/field-frame";

type PasswordFieldProps = {
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  value: string;
  onValueChange: (value: string) => void;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "id" | "type"
>;

/** A password input with an accessible show/hide toggle. */
export function PasswordField({
  label,
  help,
  error,
  value,
  onValueChange,
  ...inputProps
}: PasswordFieldProps) {
  const controlId = useId();
  const [revealed, setRevealed] = useState(false);

  return (
    <FieldFrame controlId={controlId} label={label} help={help} error={error}>
      {({ describedBy, invalid }) => (
        <div className="field__password">
          <input
            {...inputProps}
            className="field__input"
            id={controlId}
            type={revealed ? "text" : "password"}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          />
          <button
            className="field__reveal"
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-pressed={revealed}
            aria-label={revealed ? "Hide password" : "Show password"}
          >
            {revealed ? (
              <EyeOff aria-hidden="true" size={18} />
            ) : (
              <Eye aria-hidden="true" size={18} />
            )}
          </button>
        </div>
      )}
    </FieldFrame>
  );
}
