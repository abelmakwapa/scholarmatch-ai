import { AlertTriangle, CircleHelp, CircleX, ShieldCheck } from "lucide-react";

import type { EligibilityStatus } from "@/app/lib/api/client";

const CONTENT = {
  eligible: { label: "Eligible", Icon: ShieldCheck },
  potentially_eligible: {
    label: "Potentially eligible",
    Icon: AlertTriangle,
  },
  ineligible: { label: "Ineligible", Icon: CircleX },
  unknown: { label: "Unknown — profile data missing", Icon: CircleHelp },
} as const;

export function EligibilitySignal({
  status,
  compact = false,
}: {
  status: EligibilityStatus;
  compact?: boolean;
}) {
  const { label, Icon } = CONTENT[status];
  return (
    <span
      className="eligibility-signal"
      data-status={status}
      data-compact={compact || undefined}
    >
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}
