import { FileCheck2 } from "lucide-react";

import { WorkspacePlaceholder } from "@/app/components/product/workspace-placeholder";
import { requireStudentSession } from "@/app/lib/auth/server-session";

export default async function ApplicationsPage() {
  await requireStudentSession("/applications");
  return (
    <WorkspacePlaceholder
      eyebrow="Applications"
      title="Application tracker"
      description="Keep saved, preparing, and submitted applications in one reliable timeline."
      icon={FileCheck2}
    />
  );
}
