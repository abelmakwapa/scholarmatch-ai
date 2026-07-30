import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DocumentManager } from "@/app/components/documents/document-manager";
import type {
  DocumentPage,
  DocumentReadinessResponse,
  DocumentResponse,
  DocumentUploadPolicy,
} from "@/app/lib/api/client";
import {
  isSignedUrlExpired,
  validateDocumentFile,
} from "@/app/lib/documents/upload";

const document: DocumentResponse = {
  id: "067f6b12-09e6-435f-b338-0f627876fbd1",
  document_type: "transcript",
  display_name: "Academic transcript",
  original_filename: "transcript.pdf",
  mime_type: "application/pdf",
  size_bytes: 150_000,
  status: "ready",
  scan_status: "clean",
  replaced_at: null,
  created_at: "2026-07-20T08:00:00Z",
  updated_at: "2026-07-20T08:03:00Z",
};

const page: DocumentPage = {
  data: [document],
  pagination: { has_more: false, next_cursor: null, limit: 100 },
};

const policy: DocumentUploadPolicy = {
  max_size_bytes: 2_000_000,
  allowed_mime_types: ["application/pdf"],
  allowed_document_types: ["transcript", "cv"],
  accepted_extensions: [".pdf"],
};

const readiness: DocumentReadinessResponse = {
  applications: [
    {
      application_id: "5b4929f4-9bff-4258-9aad-5b2c1835c69e",
      scholarship_title: "Example scholarship",
      items: [
        {
          required_document: "Academic transcript",
          ready: true,
          matched_document_ids: [document.id],
          shared_externally: false,
        },
      ],
    },
  ],
  updated_at: "2026-07-29T08:00:00Z",
};

function api() {
  return {
    renameDocument: vi.fn(async () => document),
    createDocumentDownloadUrl: vi.fn(async () => ({
      url: "https://storage.example.test/signed",
      expires_at: "2099-01-01T00:00:00Z",
    })),
    deleteDocument: vi.fn(async () => null),
  };
}

describe("private document manager", () => {
  it("uses the server policy for fast client validation", () => {
    expect(
      validateDocumentFile(
        new File(["x"], "note.txt", { type: "text/plain" }),
        policy,
      ),
    ).toMatch(/approved file type/i);
    const tooLarge = new File(
      [new Uint8Array(policy.max_size_bytes + 1)],
      "large.pdf",
      { type: "application/pdf" },
    );
    expect(validateDocumentFile(tooLarge, policy)).toMatch(/smaller than/i);
  });

  it("shows upload failures and permits an explicit retry", async () => {
    const user = userEvent.setup();
    const uploader = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("The upload was rejected by the server."),
      )
      .mockResolvedValueOnce({
        ...document,
        id: "9f0cd169-b746-402b-b5c1-951951423797",
        status: "scanning",
      });
    render(
      <DocumentManager
        initialPage={page}
        policy={policy}
        readiness={readiness}
        api={api()}
        uploader={uploader}
      />,
    );
    const input = screen.getByLabelText("File");
    await user.upload(
      input,
      new File(["pdf"], "new.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "Upload privately" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "rejected by the server",
    );
    await user.click(screen.getByRole("button", { name: "Upload privately" }));
    expect(uploader).toHaveBeenCalledTimes(2);
    expect(uploader.mock.calls[0]?.[0].idempotencyKey).toBe(
      uploader.mock.calls[1]?.[0].idempotencyKey,
    );
    expect(await screen.findByText("Security scan")).toBeInTheDocument();
  });

  it("blocks duplicate upload clicks while a request is pending", async () => {
    const user = userEvent.setup();
    const uploader = vi.fn(
      () => new Promise<DocumentResponse>(() => undefined),
    );
    render(
      <DocumentManager
        initialPage={page}
        policy={policy}
        readiness={readiness}
        api={api()}
        uploader={uploader}
      />,
    );
    await user.upload(
      screen.getByLabelText("File"),
      new File(["pdf"], "new.pdf", { type: "application/pdf" }),
    );
    const button = screen.getByRole("button", { name: "Upload privately" });
    await user.click(button);
    await user.click(button);
    expect(button).toBeDisabled();
    expect(uploader).toHaveBeenCalledOnce();
  });

  it("requires destructive confirmation and explains readiness effects", async () => {
    const user = userEvent.setup();
    const mockApi = api();
    render(
      <DocumentManager
        initialPage={page}
        policy={policy}
        readiness={readiness}
        api={mockApi}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: `Delete ${document.display_name}` }),
    );
    expect(
      screen.getByRole("group", { name: /delete academic transcript/i }),
    ).toHaveTextContent(/readiness matches.*incomplete/i);
    expect(mockApi.deleteDocument).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );
    expect(mockApi.deleteDocument).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: `Delete ${document.display_name}` }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("treats invalid and near-expiry signed URLs as expired", () => {
    expect(isSignedUrlExpired("invalid")).toBe(true);
    expect(
      isSignedUrlExpired(
        "2026-07-29T08:00:04Z",
        Date.parse("2026-07-29T08:00:00Z"),
      ),
    ).toBe(true);
    expect(
      isSignedUrlExpired(
        "2026-07-29T08:01:00Z",
        Date.parse("2026-07-29T08:00:00Z"),
      ),
    ).toBe(false);
  });

  it("does not open a signed URL that is already expired", async () => {
    const user = userEvent.setup();
    const mockApi = api();
    mockApi.createDocumentDownloadUrl.mockResolvedValue({
      url: "https://storage.example.test/expired",
      expires_at: "2020-01-01T00:00:00Z",
    });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <DocumentManager
        initialPage={page}
        policy={policy}
        readiness={readiness}
        api={mockApi}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: `Download ${document.display_name}`,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /expired before it could be used/i,
    );
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("labels private readiness without implying external sharing", () => {
    render(
      <DocumentManager
        initialPage={page}
        policy={policy}
        readiness={readiness}
        api={api()}
      />,
    );
    expect(screen.getAllByText("Ready")).toHaveLength(2);
    expect(
      screen.getByText(/Private—nothing is shared externally/i),
    ).toBeInTheDocument();
  });
});
