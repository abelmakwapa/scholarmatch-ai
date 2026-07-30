import { ScholarshipAdminWorkspace } from "@/app/components/admin/scholarship-admin-workspace";
import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireAdminSession } from "@/app/lib/auth/server-session";

export default async function AdminScholarshipsPage() {
  const { accessToken } = await requireAdminSession("/admin/scholarships");
  let page;
  try {
    page = await createServerApiClient(accessToken).listAdminScholarships({
      limit: 100,
    });
  } catch {
    page = null;
  }
  return (
    <div className="workspace-page admin-page">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Editorial lifecycle</p>
          <h1>Scholarship data quality.</h1>
          <p>
            Create and review records, maintain evidence-backed requirements,
            and change publication state through audited API transitions.
          </p>
        </div>
      </header>
      {page ? (
        <ScholarshipAdminWorkspace initialPage={page} />
      ) : (
        <DataState
          kind="error"
          title="Scholarship administration could not be loaded"
          description="No catalogue data was changed. Retry after checking the API service."
          action={<RetryButton />}
          compact
        />
      )}
    </div>
  );
}
