import { DuplicateWorkspace } from "@/app/components/admin/duplicate-workspace";
import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireAdminSession } from "@/app/lib/auth/server-session";

export default async function AdminDuplicatesPage() {
  const { accessToken } = await requireAdminSession("/admin/duplicates");
  let page;
  try {
    page = await createServerApiClient(accessToken).listAdminDuplicateGroups({
      limit: 100,
    });
  } catch {
    page = null;
  }
  return (
    <div className="workspace-page admin-page">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Source-preserving resolution</p>
          <h1>Resolve duplicates without erasing provenance.</h1>
          <p>
            Choose a canonical record, document the decision, and retain every
            contributing source-history entry.
          </p>
        </div>
      </header>
      {page ? (
        <DuplicateWorkspace initialPage={page} />
      ) : (
        <DataState
          kind="error"
          title="Duplicate groups could not be loaded"
          description="No records were merged."
          action={<RetryButton />}
          compact
        />
      )}
    </div>
  );
}
