"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export function ExactConfirmation({
  action,
  targetName,
  description,
  pending = false,
  onConfirm,
  onCancel,
}: {
  action: string;
  targetName: string;
  description: string;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="admin-confirmation-backdrop">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-confirmation"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="alertdialog"
      >
        <h3 id={titleId}>
          Confirm {action}: {targetName}
        </h3>
        <p id={descriptionId}>{description}</p>
        <label>
          <span>
            Type <strong>{targetName}</strong> to continue
          </span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <div>
          <button type="button" className="text-action" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="product-button product-button--ink"
            disabled={pending || value !== targetName}
            onClick={() => void onConfirm()}
          >
            Confirm {action}
          </button>
        </div>
      </div>
    </div>
  );
}
