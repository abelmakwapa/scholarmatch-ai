import Link from "next/link";

import { IngestionRunDetailWorkspace } from "@/app/components/admin/ingestion-workspace";
import { DataState } from "@/app/components/product/data-state";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireAdminSession } from "@/app/lib/auth/server-session";

export default async function AdminIngestionDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const { accessToken } = await requireAdminSession(
    `/admin/ingestion/${runId}`,
  );
  let run;
  try {
    run = await createServerApiClient(accessToken).getIngestionRun(runId);
  } catch {
    run = null;
  }
  return (
    <div className="workspace-page admin-page">
      <Link className="admin-back-link" href="/admin/ingestion">
        ← All ingestion runs
      </Link>
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Ingestion detail</p>
          <h1>Run evidence and counters.</h1>
        </div>
      </header>
      {run ? (
        <IngestionRunDetailWorkspace initialRun={run} />
      ) : (
        <DataState
          kind="error"
          title="This ingestion run could not be loaded"
          description="The run may not exist or the API rejected access."
          compact
        />
      )}
    </div>
  );
}
