import { GraduationCap } from "lucide-react";

import { WorkspacePlaceholder } from "@/app/components/product/workspace-placeholder";
import { requireStudentSession } from "@/app/lib/auth/server-session";

export default async function ScholarshipsPage() {
  await requireStudentSession("/scholarships");
  return (
    <WorkspacePlaceholder
      eyebrow="Scholarships"
      title="Scholarship library"
      description="Explore published opportunities without losing sight of confirmed requirements."
      icon={GraduationCap}
    />
  );
}
