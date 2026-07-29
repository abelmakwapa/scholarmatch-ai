import type { Metadata } from "next";

import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <DashboardClient />
    </div>
  );
}
