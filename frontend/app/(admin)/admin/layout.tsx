import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminNavigation } from "@/app/components/admin/admin-navigation";
import { OfflineNotice } from "@/app/components/product/offline-notice";
import {
  requireAdminSession,
  sessionDisplayName,
} from "@/app/lib/auth/server-session";

export const metadata: Metadata = {
  title: {
    default: "Administration | ScholarMatch AI",
    template: "%s | ScholarMatch AI administration",
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requireAdminSession("/admin");
  return (
    <div className="workspace-shell admin-shell">
      <a className="skip-link" href="#admin-main">
        Skip to administration content
      </a>
      <AdminNavigation
        displayName={sessionDisplayName(user, "Administrator")}
        email={user.email ?? null}
      />
      <main className="workspace-main" id="admin-main">
        <OfflineNotice />
        {children}
      </main>
    </div>
  );
}
