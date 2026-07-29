import { AlertCircle, CheckCircle2, Info, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

export type FormStatusTone = "error" | "success" | "info" | "offline";

const ICONS: Record<FormStatusTone, typeof Info> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
  offline: WifiOff,
};

type FormStatusProps = {
  tone: FormStatusTone;
  children: ReactNode;
};

/**
 * A form-level status banner. Errors use `role="alert"` for immediate
 * announcement; other tones use a polite live region.
 */
export function FormStatus({ tone, children }: FormStatusProps) {
  const Icon = ICONS[tone];
  return (
    <div
      className={`form-status form-status--${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <Icon aria-hidden="true" size={18} />
      <span>{children}</span>
    </div>
  );
}
