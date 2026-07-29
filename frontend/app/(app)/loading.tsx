import { DataState } from "@/app/components/product/data-state";

export default function WorkspaceLoading() {
  return (
    <div className="workspace-page">
      <DataState
        kind="loading"
        title="Loading your workspace"
        description="Checking your latest profile, deadlines, and activity."
      />
    </div>
  );
}
