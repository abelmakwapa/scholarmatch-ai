import { IngestionWorkspace } from "@/app/components/admin/ingestion-workspace";
import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireAdminSession } from "@/app/lib/auth/server-session";

export default async function AdminIngestionPage() {
  const { accessToken } = await requireAdminSession("/admin/ingestion");
  let page;
  try {
    page = await createServerApiClient(accessToken).listIngestionRuns({
      limit: 100,
    });
  } catch {
    page = null;
  }
  return (
    <div className="workspace-page admin-page">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Source operations</p>
          <h1>Ingestion runs you can inspect.</h1>
          <p>
            Track created, updated, duplicate, and rejected records with safe
            summaries and linked retry history.
          </p>
        </div>
      </header>
      {page ? (
        <IngestionWorkspace initialPage={page} />
      ) : (
        <DataState
          kind="error"
          title="Ingestion runs could not be loaded"
          description="No run was started or retried."
          action={<RetryButton />}
          compact
        />
      )}
    </div>
  );
}
