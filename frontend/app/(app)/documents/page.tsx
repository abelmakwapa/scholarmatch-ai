import type { Metadata } from "next";

import { DocumentManager } from "@/app/components/documents/document-manager";
import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireStudentSession } from "@/app/lib/auth/server-session";

export const metadata: Metadata = {
  title: "Documents",
  robots: { index: false, follow: false },
};

export default async function DocumentsPage() {
  const { accessToken } = await requireStudentSession("/documents");
  const api = createServerApiClient(accessToken);
  const [documents, policy, readiness] = await Promise.allSettled([
    api.listDocuments({ limit: 100 }),
    api.getDocumentUploadPolicy(),
    api.getDocumentReadiness(),
  ]);

  return (
    <div className="workspace-page documents-page">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Private document manager</p>
          <h1>Ready when the deadline arrives.</h1>
          <p>
            Keep application materials current, see scan and processing state,
            and compare your library with scholarship requirements.
          </p>
        </div>
      </header>
      {documents.status === "fulfilled" &&
      policy.status === "fulfilled" &&
      readiness.status === "fulfilled" ? (
        <DocumentManager
          initialPage={documents.value}
          policy={policy.value}
          readiness={readiness.value}
        />
      ) : (
        <DataState
          kind="error"
          title="Your private documents could not be loaded"
          description="Nothing was uploaded or changed. Check your connection and try again."
          action={<RetryButton />}
          compact
        />
      )}
    </div>
  );
}
