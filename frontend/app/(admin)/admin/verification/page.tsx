import { VerificationWorkspace } from "@/app/components/admin/verification-workspace";
import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireAdminSession } from "@/app/lib/auth/server-session";

export default async function AdminVerificationPage() {
  const { accessToken } = await requireAdminSession("/admin/verification");
  let page;
  try {
    page = await createServerApiClient(accessToken).listAdminVerificationQueue({
      limit: 100,
    });
  } catch {
    page = null;
  }
  return (
    <div className="workspace-page admin-page">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Freshness and change review</p>
          <h1>Verify what changed at the source.</h1>
          <p>
            Compare safe field summaries, inspect the constrained source, and
            record a review decision.
          </p>
        </div>
      </header>
      {page ? (
        <VerificationWorkspace initialPage={page} />
      ) : (
        <DataState
          kind="error"
          title="Verification queue could not be loaded"
          description="No verification decision was recorded."
          action={<RetryButton />}
          compact
        />
      )}
    </div>
  );
}
