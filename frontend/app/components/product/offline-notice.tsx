"use client";

import { WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/app/lib/hooks/use-online-status";

export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <p className="offline-notice" role="status" aria-live="polite">
      <WifiOff aria-hidden="true" /> You&rsquo;re offline. Existing information
      remains visible; reconnect before retrying changes.
    </p>
  );
}
