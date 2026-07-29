import { Settings } from "lucide-react";

import { WorkspacePlaceholder } from "@/app/components/product/workspace-placeholder";
import { requireStudentSession } from "@/app/lib/auth/server-session";

export default async function SettingsPage() {
  await requireStudentSession("/settings");
  return (
    <WorkspacePlaceholder
      eyebrow="Settings"
      title="Account settings"
      description="Manage account preferences without mixing them into matching profile facts."
      icon={Settings}
    />
  );
}
