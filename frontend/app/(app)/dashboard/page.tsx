import type { Metadata } from "next";

import { DashboardView } from "@/app/(app)/dashboard/dashboard-view";
import { loadDashboard } from "@/app/lib/dashboard/server";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  return <DashboardView state={await loadDashboard()} />;
}
