import { FolderOpen } from "lucide-react";

import { WorkspacePlaceholder } from "@/app/components/product/workspace-placeholder";
import { requireStudentSession } from "@/app/lib/auth/server-session";

export default async function DocumentsPage() {
  await requireStudentSession("/documents");
  return (
    <WorkspacePlaceholder
      eyebrow="Documents"
      title="Document readiness"
      description="Track the private documents required for scholarship applications."
      icon={FolderOpen}
    />
  );
}
