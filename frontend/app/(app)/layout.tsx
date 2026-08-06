import type { ReactNode } from "react";

import { AppNavigation } from "@/app/components/product/app-navigation";
import { OfflineNotice } from "@/app/components/product/offline-notice";
import {
  requireStudentSession,
  sessionDisplayName,
} from "@/app/lib/auth/server-session";

export const dynamic = "force-dynamic";

/**
 * Request-time private shell. Proxy avoids obvious flashes, while this secure
 * server lookup remains the actual UI gate for every route in the group.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireStudentSession("/dashboard");

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to main content
      </a>
      <AppNavigation
        displayName={sessionDisplayName(user)}
        email={user.email ?? null}
      />
      <main className="workspace-main" id="workspace-main">
        <OfflineNotice />
        {children}
      </main>
    </div>
  );
}
