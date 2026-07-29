import { Sparkles } from "lucide-react";

import { WorkspacePlaceholder } from "@/app/components/product/workspace-placeholder";
import { requireStudentSession } from "@/app/lib/auth/server-session";

export default async function MatchesPage() {
  await requireStudentSession("/matches");
  return (
    <WorkspacePlaceholder
      eyebrow="Matches"
      title="Explainable matches"
      description="Review ranked opportunities and the profile facts behind each result."
      icon={Sparkles}
    />
  );
}
