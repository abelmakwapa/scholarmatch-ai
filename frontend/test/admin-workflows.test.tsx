import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { DuplicateWorkspace } from "@/app/components/admin/duplicate-workspace";
import { IngestionWorkspace } from "@/app/components/admin/ingestion-workspace";
import { ScholarshipAdminWorkspace } from "@/app/components/admin/scholarship-admin-workspace";
import { VerificationWorkspace } from "@/app/components/admin/verification-workspace";
import type {
  AdminDuplicatePage,
  AdminDuplicateMergeRequest,
  AdminLifecycleTransition,
  AdminScholarshipResponse,
  AdminVerificationPage,
  AdminVerificationWrite,
  IngestionRunPage,
  IngestionRunResponse,
} from "@/app/lib/api/client";

const scholarship: AdminScholarshipResponse = {
  id: "a44c529b-2302-402e-bd72-9402229d0890",
  title: "Fixture research grant",
  provider: "Fixture foundation",
  description: "A reviewed plain-text description.",
  funding_type: "research",
  funding_summary: "Tuition support",
  deadline: "2026-11-30",
  source_url: "https://example.com/grant",
  reviewer_notes: null,
  status: "in_review",
  allowed_transitions: ["publish", "archive"],
  requirements: [
    {
      id: "530bb9ae-3ab0-454d-b078-364cd50bf94b",
      constraint: "hard",
      field: "study_level",
      operator: "equals",
      value: "postgraduate",
      source_evidence: {
        label: "Eligibility page",
        source_url: "https://example.com/grant/eligibility",
        summary: "Applicants must be postgraduate students.",
      },
      reviewer_notes: null,
    },
  ],
  source_history: [
    {
      id: "6bc2d4dc-568e-4796-820f-93fc695c3f69",
      source: "Fixture catalogue",
      source_url: "https://example.com/grant",
      first_seen_at: "2026-07-01T08:00:00Z",
      last_seen_at: "2026-07-29T08:00:00Z",
      active: true,
    },
  ],
  created_at: "2026-07-01T08:00:00Z",
  updated_at: "2026-07-29T08:00:00Z",
  published_at: null,
  verified_at: "2026-07-29T08:00:00Z",
};

function scholarshipApi() {
  return {
    createAdminScholarship: vi.fn(async () => scholarship),
    updateAdminScholarship: vi.fn(async () => scholarship),
    transitionAdminScholarship: vi.fn(
      async (id: string, body: AdminLifecycleTransition, key: string) => {
        void id;
        void key;
        return {
          ...scholarship,
          status:
            body.action === "publish"
              ? ("published" as const)
              : scholarship.status,
          allowed_transitions:
            body.action === "publish"
              ? ["unpublish" as const, "expire" as const, "archive" as const]
              : scholarship.allowed_transitions,
        };
      },
    ),
    replaceAdminScholarshipRequirements: vi.fn(async () => scholarship),
    previewAdminBulkAction: vi.fn(async () => ({
      preview_token: "safe-preview-token",
      expires_at: "2026-07-29T09:00:00Z",
      action: "publish" as const,
      affected: [scholarship],
      blocked: [],
    })),
    applyAdminBulkAction: vi.fn(async () => ({
      operation_id: "6c9b80df-82b9-4ae2-b9e1-61dfc91f2cf6",
      accepted_count: 1,
      recoverable_until: "2026-07-29T10:00:00Z",
      created_at: "2026-07-29T08:00:00Z",
    })),
    undoAdminBulkAction: vi.fn(
      async (operationId: string, idempotencyKey: string) => {
        void idempotencyKey;
        return {
          operation_id: operationId,
          reverted_count: 1,
          reverted_at: "2026-07-29T08:35:00Z",
        };
      },
    ),
  };
}

describe("scholarship administration", () => {
  test("publishes only after exact-name confirmation", async () => {
    const user = userEvent.setup();
    const api = scholarshipApi();
    render(
      <ScholarshipAdminWorkspace
        initialPage={{
          data: [scholarship],
          pagination: { has_more: false, next_cursor: null, limit: 100 },
        }}
        api={api}
      />,
    );
    await user.click(screen.getByText("Open review"));
    await user.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", {
      name: "Confirm publish",
    });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), scholarship.title);
    await user.click(confirm);
    await waitFor(() =>
      expect(api.transitionAdminScholarship).toHaveBeenCalledOnce(),
    );
    expect(api.transitionAdminScholarship.mock.calls[0]?.[1]).toEqual({
      action: "publish",
      reviewer_notes: null,
    });
    expect(api.transitionAdminScholarship.mock.calls[0]?.[2]).toBeTruthy();
  });

  test("shows only lifecycle transitions authorized by the API response", async () => {
    const user = userEvent.setup();
    render(
      <ScholarshipAdminWorkspace
        initialPage={{
          data: [{ ...scholarship, allowed_transitions: ["archive"] }],
          pagination: { has_more: false, next_cursor: null, limit: 100 },
        }}
        api={scholarshipApi()}
      />,
    );
    await user.click(screen.getByText("Open review"));
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish" }),
    ).not.toBeInTheDocument();
  });

  test("previews bounded bulk changes and offers server-backed recovery", async () => {
    const user = userEvent.setup();
    const api = scholarshipApi();
    render(
      <ScholarshipAdminWorkspace
        initialPage={{
          data: [scholarship],
          pagination: { has_more: false, next_cursor: null, limit: 100 },
        }}
        api={api}
      />,
    );

    await user.click(screen.getByLabelText(`Select ${scholarship.title}`));
    await user.click(screen.getByRole("button", { name: "Preview 1" }));
    expect(
      await screen.findByText("1 records can be published"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Continue to confirmation" }),
    );
    const dialog = screen.getByRole("alertdialog");
    await user.type(within(dialog).getByRole("textbox"), "1 scholarships");
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm publish" }),
    );
    expect(
      await screen.findByRole("button", { name: "Undo bulk action" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo bulk action" }));
    await waitFor(() => expect(api.undoAdminBulkAction).toHaveBeenCalledOnce());
    expect(api.undoAdminBulkAction.mock.calls[0]?.[0]).toBe(
      "6c9b80df-82b9-4ae2-b9e1-61dfc91f2cf6",
    );
    expect(api.undoAdminBulkAction.mock.calls[0]?.[1]).toBeTruthy();
  });

  test("rejects unsafe source links before creating a draft", async () => {
    const user = userEvent.setup();
    const api = scholarshipApi();
    render(
      <ScholarshipAdminWorkspace
        initialPage={{
          data: [],
          pagination: { has_more: false, next_cursor: null, limit: 100 },
        }}
        api={api}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Create scholarship/i }),
    );
    await user.type(screen.getByLabelText("Title"), "Unsafe source grant");
    await user.type(screen.getByLabelText("Provider"), "Fixture provider");
    await user.type(
      screen.getByLabelText("Source URL"),
      "http://example.com/grant",
    );
    await user.click(screen.getByRole("button", { name: "Create draft" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/valid HTTPS URLs/i);
    expect(api.createAdminScholarship).not.toHaveBeenCalled();
  });
});

const duplicatePage: AdminDuplicatePage = {
  data: [
    {
      id: "71e507c7-d20a-434f-8499-b143977b1b68",
      reason: "Matching provider and title",
      created_at: "2026-07-29T08:00:00Z",
      candidates: [
        {
          scholarship_id: scholarship.id,
          title: scholarship.title,
          provider: scholarship.provider,
          status: scholarship.status,
          source_history: scholarship.source_history,
        },
        {
          scholarship_id: "fc37539a-3f3f-4f82-8044-a4b8ebfd8581",
          title: "Fixture research award",
          provider: scholarship.provider,
          status: "draft",
          source_history: [
            {
              ...scholarship.source_history[0],
              id: "352ceac9-67d3-4e27-a9ea-72640313079f",
              source: "Second source",
            },
          ],
        },
      ],
    },
  ],
  pagination: { has_more: false, next_cursor: null, limit: 100 },
};

test("duplicate merge preserves the selected canonical record and source history contract", async () => {
  const user = userEvent.setup();
  const mergeAdminDuplicateGroup = vi.fn(
    async (id: string, body: AdminDuplicateMergeRequest, key: string) => {
      void id;
      void body;
      void key;
      return {
        canonical_scholarship_id: scholarship.id,
        merged_scholarship_ids: ["fc37539a-3f3f-4f82-8044-a4b8ebfd8581"],
        preserved_source_history_count: 2,
        audit_event_id: "d38c6354-d40d-4145-9bfc-9e0f9ba351fb",
        merged_at: "2026-07-29T08:30:00Z",
      };
    },
  );
  render(
    <DuplicateWorkspace
      initialPage={duplicatePage}
      api={{ mergeAdminDuplicateGroup }}
    />,
  );
  await user.type(
    screen.getByLabelText("Required reviewer notes"),
    "Same programme and provider; first record has the verified source.",
  );
  await user.click(screen.getByRole("button", { name: "Preview merge" }));
  const dialog = screen.getByRole("alertdialog");
  await user.type(within(dialog).getByRole("textbox"), scholarship.title);
  await user.click(
    within(dialog).getByRole("button", { name: "Confirm merge into" }),
  );
  await waitFor(() => expect(mergeAdminDuplicateGroup).toHaveBeenCalledOnce());
  expect(mergeAdminDuplicateGroup.mock.calls[0]?.[1]).toMatchObject({
    canonical_scholarship_id: scholarship.id,
    duplicate_scholarship_ids: ["fc37539a-3f3f-4f82-8044-a4b8ebfd8581"],
  });
  expect(await screen.findByText("No duplicate groups")).toBeInTheDocument();
});

const failedRun: IngestionRunResponse = {
  id: "5dc059cd-48c2-44fc-8ab9-5ec72fca4d5c",
  source: "Fixture catalogue",
  source_url: "https://example.com/catalogue",
  status: "failed",
  counters: {
    fetched: 30,
    created: 12,
    updated: 5,
    duplicates: 8,
    rejected: 5,
  },
  safe_errors: [
    {
      code: "INVALID_DEADLINE",
      summary: "Some records had invalid deadline values.",
      count: 5,
    },
  ],
  original_run_id: null,
  created_at: "2026-07-29T07:00:00Z",
  updated_at: "2026-07-29T07:05:00Z",
  completed_at: "2026-07-29T07:05:00Z",
};

const ingestionPage: IngestionRunPage = {
  data: [failedRun],
  pagination: { has_more: false, next_cursor: null, limit: 100 },
};

describe("ingestion retry", () => {
  test("requires the exact target and keeps retry linked to the original", async () => {
    const user = userEvent.setup();
    const retryIngestionRun = vi.fn(async () => ({
      ...failedRun,
      id: "05c62340-6541-469a-9158-f38db80784d7",
      status: "queued" as const,
      original_run_id: failedRun.id,
    }));
    render(
      <IngestionWorkspace
        initialPage={ingestionPage}
        api={{ createIngestionRun: vi.fn(), retryIngestionRun }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    const dialog = screen.getByRole("alertdialog");
    await user.type(
      within(dialog).getByRole("textbox"),
      `${failedRun.source} ingestion`,
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm retry" }),
    );
    await waitFor(() => expect(retryIngestionRun).toHaveBeenCalledOnce());
  });

  test("shows a safe recoverable error state", async () => {
    const user = userEvent.setup();
    const retryIngestionRun = vi.fn(async () => {
      throw new Error("Retry is rate limited. Try again later.");
    });
    render(
      <IngestionWorkspace
        initialPage={ingestionPage}
        api={{ createIngestionRun: vi.fn(), retryIngestionRun }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    const dialog = screen.getByRole("alertdialog");
    await user.type(
      within(dialog).getByRole("textbox"),
      `${failedRun.source} ingestion`,
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm retry" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("rate limited");
  });
});

const verificationPage: AdminVerificationPage = {
  data: [
    {
      scholarship_id: scholarship.id,
      title: scholarship.title,
      provider: scholarship.provider,
      freshness: "changed",
      last_verified_at: "2026-07-01T08:00:00Z",
      source_url: scholarship.source_url,
      changed_fields: [
        {
          field: "deadline",
          before_summary: "30 Nov 2026",
          after_summary: "15 Nov 2026",
          source_url: scholarship.source_url,
        },
      ],
    },
  ],
  pagination: { has_more: false, next_cursor: null, limit: 100 },
};

test("verification requires notes and sends the explicit source-change decision", async () => {
  const user = userEvent.setup();
  const verifyAdminScholarship = vi.fn(
    async (id: string, body: AdminVerificationWrite, key: string) => {
      void id;
      void body;
      void key;
      return verificationPage.data[0];
    },
  );
  render(
    <VerificationWorkspace
      initialPage={verificationPage}
      api={{ verifyAdminScholarship }}
    />,
  );
  const button = screen.getByRole("button", { name: "Record verification" });
  expect(button).toBeDisabled();
  await user.type(
    screen.getByLabelText("Reviewer notes"),
    "Confirmed the revised deadline at the source.",
  );
  await user.click(screen.getByLabelText("Accept the reviewed source changes"));
  await user.click(button);
  await waitFor(() => expect(verifyAdminScholarship).toHaveBeenCalledOnce());
  expect(verifyAdminScholarship.mock.calls[0]?.[1]).toEqual({
    reviewer_notes: "Confirmed the revised deadline at the source.",
    accept_source_changes: true,
  });
});
