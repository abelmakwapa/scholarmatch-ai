import { render } from "@testing-library/react";
import axe from "axe-core";
import { expect, test, vi } from "vitest";

import { ApplicationWorkspace } from "@/app/components/applications/application-workspace";
import { DocumentManager } from "@/app/components/documents/document-manager";
import type { DocumentResponse } from "@/app/lib/api/client";
import { applicationFixture } from "@/test/fixtures";

const noViolations = async (container: HTMLElement) => {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
};

test("application board and controls have no automated accessibility violations", async () => {
  const { container } = render(
    <main>
      <h1>Applications</h1>
      <ApplicationWorkspace
        initialPage={{
          data: [applicationFixture],
          pagination: { has_more: false, next_cursor: null, limit: 100 },
        }}
        deadlines={{
          data: [],
          pagination: { has_more: false, next_cursor: null, limit: 100 },
        }}
        api={{
          updateApplication: vi.fn(async () => applicationFixture),
          updateApplicationChecklistItem: vi.fn(async () => applicationFixture),
          setApplicationReminder: vi.fn(async () => applicationFixture),
          deleteApplicationReminder: vi.fn(async () => applicationFixture),
        }}
      />
    </main>,
  );
  await noViolations(container);
});

test("private document controls and readiness have no automated accessibility violations", async () => {
  const document: DocumentResponse = {
    id: "067f6b12-09e6-435f-b338-0f627876fbd1",
    document_type: "transcript",
    display_name: "Transcript",
    original_filename: "transcript.pdf",
    mime_type: "application/pdf",
    size_bytes: 10_000,
    status: "ready",
    scan_status: "clean",
    replaced_at: null,
    created_at: "2026-07-20T08:00:00Z",
    updated_at: "2026-07-20T08:03:00Z",
  };
  const { container } = render(
    <main>
      <h1>Documents</h1>
      <DocumentManager
        initialPage={{
          data: [document],
          pagination: { has_more: false, next_cursor: null, limit: 100 },
        }}
        policy={{
          max_size_bytes: 2_000_000,
          allowed_mime_types: ["application/pdf"],
          allowed_document_types: ["transcript"],
          accepted_extensions: [".pdf"],
        }}
        readiness={{ applications: [], updated_at: "2026-07-29T08:00:00Z" }}
        api={{
          renameDocument: vi.fn(async () => document),
          createDocumentDownloadUrl: vi.fn(async () => ({
            url: "https://storage.example.test/signed",
            expires_at: "2099-01-01T00:00:00Z",
          })),
          deleteDocument: vi.fn(async () => null),
        }}
      />
    </main>,
  );
  await noViolations(container);
});
