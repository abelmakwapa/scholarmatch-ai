import type { Metadata } from "next";

import { ApplicationWorkspace } from "@/app/components/applications/application-workspace";
import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireStudentSession } from "@/app/lib/auth/server-session";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};

export default async function ApplicationsPage() {
  const { accessToken } = await requireStudentSession("/applications");
  const api = createServerApiClient(accessToken);
  const [applications, deadlines] = await Promise.allSettled([
    api.listApplications({ limit: 100 }),
    api.listApplicationDeadlines({ limit: 100 }),
  ]);

  return (
    <div className="workspace-page application-page">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Private progress tracking</p>
          <h1>Every application, one clear next step.</h1>
          <p>
            Plan tasks, reminders, and status changes here. ScholarMatch does
            not submit applications or share documents with providers.
          </p>
        </div>
      </header>
      {applications.status === "fulfilled" &&
      deadlines.status === "fulfilled" ? (
        <ApplicationWorkspace
          initialPage={applications.value}
          deadlines={deadlines.value}
        />
      ) : (
        <DataState
          kind="error"
          title="Your application workspace could not be loaded"
          description="No tracking data was changed. Check your connection and try again."
          action={<RetryButton />}
          compact
        />
      )}
    </div>
  );
}
