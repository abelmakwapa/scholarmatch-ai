import { AuditList } from "@/app/components/admin/audit-list";
import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireAdminSession } from "@/app/lib/auth/server-session";

export default async function AdminAuditPage() {
  const { accessToken } = await requireAdminSession("/admin/audit");
  let page;
  try {
    page = await createServerApiClient(accessToken).listAdminAuditEvents({
      limit: 100,
    });
  } catch {
    page = null;
  }
  return (
    <div className="workspace-page admin-page">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Append-only accountability</p>
          <h1>Administrative audit history.</h1>
          <p>
            Safe summaries identify the actor, target, action, and timestamp
            without exposing tokens or raw imported content.
          </p>
        </div>
      </header>
      {page ? (
        <AuditList page={page} />
      ) : (
        <DataState
          kind="error"
          title="Audit history could not be loaded"
          description="The existing audit log is unaffected."
          action={<RetryButton />}
          compact
        />
      )}
    </div>
  );
}
