import type { ReactNode } from "react";

export type FieldAria = {
  /** Value for the control's `aria-describedby`. */
  describedBy: string | undefined;
  /** Value for the control's `aria-invalid`. */
  invalid: boolean;
  /** Id to assign to the control, matching the label's `htmlFor`. */
  controlId: string;
};

type FieldFrameProps = {
  controlId: string;
  label: ReactNode;
  /** Plain-language help rendered under the label, before the control. */
  help?: ReactNode;
  error?: string;
  /** Rendered next to the label, e.g. "Optional". */
  hint?: string;
  children: (aria: FieldAria) => ReactNode;
};

/**
 * Wraps a form control with an accessible label, help text, and inline error.
 * It wires `aria-describedby`/`aria-invalid` for whichever of help/error exist
 * and exposes them to the control through a render prop.
 */
export function FieldFrame({
  controlId,
  label,
  help,
  error,
  hint,
  children,
}: FieldFrameProps) {
  const helpId = help ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field" data-invalid={error ? "true" : undefined}>
      <div className="field__labelrow">
        <label className="field__label" htmlFor={controlId}>
          {label}
        </label>
        {hint ? <span className="field__hint">{hint}</span> : null}
      </div>
      {help ? (
        <p className="field__help" id={helpId}>
          {help}
        </p>
      ) : null}
      {children({ describedBy, invalid: Boolean(error), controlId })}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
