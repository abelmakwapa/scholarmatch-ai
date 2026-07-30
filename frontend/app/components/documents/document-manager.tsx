"use client";

import {
  CheckCircle2,
  Download,
  FileUp,
  LockKeyhole,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";

import { DataState } from "@/app/components/product/data-state";
import type {
  DocumentPage,
  DocumentReadinessResponse,
  DocumentResponse,
  DocumentUploadPolicy,
  SignedDocumentUrlResponse,
} from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import {
  isSignedUrlExpired,
  uploadPrivateDocument,
  validateDocumentFile,
  type UploadInput,
} from "@/app/lib/documents/upload";

type DocumentApi = {
  renameDocument: (
    id: string,
    body: { display_name: string },
    key: string,
  ) => Promise<DocumentResponse>;
  createDocumentDownloadUrl: (
    id: string,
    key: string,
  ) => Promise<SignedDocumentUrlResponse>;
  deleteDocument: (id: string, key: string) => Promise<null>;
};

export function DocumentManager({
  initialPage,
  policy,
  readiness,
  api = createBrowserApiClient(),
  uploader = uploadPrivateDocument,
}: {
  initialPage: DocumentPage;
  policy: DocumentUploadPolicy;
  readiness: DocumentReadinessResponse;
  api?: DocumentApi;
  uploader?: (input: UploadInput) => Promise<DocumentResponse>;
}) {
  const [documents, setDocuments] = useState(initialPage.data);
  const [documentType, setDocumentType] = useState<
    DocumentResponse["document_type"]
  >(policy.allowed_document_types[0]);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<
    Record<string, SignedDocumentUrlResponse>
  >({});
  const retryKeys = useRef(new Map<string, string>());

  function replaceDocument(next: DocumentResponse) {
    setDocuments((current) => {
      const exists = current.some((document) => document.id === next.id);
      return exists
        ? current.map((document) => (document.id === next.id ? next : document))
        : [next, ...current];
    });
  }

  async function run(
    operationId: string,
    label: string,
    action: (key: string) => Promise<void>,
  ) {
    if (pending) return;
    setPending(label);
    setError(null);
    const key = retryKeys.current.get(operationId) ?? idempotencyKey();
    retryKeys.current.set(operationId, key);
    try {
      await action(key);
      retryKeys.current.delete(operationId);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(null);
    }
  }

  function validate(fileToValidate: File) {
    const message = validateDocumentFile(fileToValidate, policy);
    setError(message);
    return !message;
  }

  async function upload() {
    if (!file || !validate(file)) return;
    await run(
      fileOperationId("upload", file, documentType),
      "upload",
      async (key) => {
        setProgress(0);
        const next = await uploader({
          file,
          documentType,
          idempotencyKey: key,
          onProgress: setProgress,
        });
        replaceDocument(next);
        setFile(null);
        setProgress(null);
      },
    );
  }

  async function replace(document: DocumentResponse, nextFile: File) {
    if (!validate(nextFile)) return;
    await run(
      fileOperationId(`replace-${document.id}`, nextFile),
      `replace-${document.id}`,
      async (key) => {
        setProgress(0);
        replaceDocument(
          await uploader({
            file: nextFile,
            documentId: document.id,
            idempotencyKey: key,
            onProgress: setProgress,
          }),
        );
        setProgress(null);
      },
    );
  }

  async function download(document: DocumentResponse) {
    await run(
      `download-${document.id}`,
      `download-${document.id}`,
      async (key) => {
        let signed = signedUrls[document.id];
        if (!signed || isSignedUrlExpired(signed.expires_at)) {
          signed = await api.createDocumentDownloadUrl(document.id, key);
          if (isSignedUrlExpired(signed.expires_at)) {
            retryKeys.current.delete(`download-${document.id}`);
            throw new Error(
              "The download link expired before it could be used. Try again.",
            );
          }
          setSignedUrls((current) => ({ ...current, [document.id]: signed }));
        }
        window.open(signed.url, "_blank", "noopener,noreferrer");
      },
    );
  }

  return (
    <div className="document-manager">
      <section className="document-upload" aria-labelledby="upload-heading">
        <div>
          <p className="product-eyebrow">Private by default</p>
          <h2 id="upload-heading">Add a document</h2>
          <p>
            Files are scanned and processed before they count as ready.
            Uploading never shares a file with a scholarship provider.
          </p>
        </div>
        <div className="document-upload__controls">
          <label>
            <span>Document type</span>
            <select
              value={documentType}
              onChange={(event) =>
                setDocumentType(
                  event.target.value as DocumentResponse["document_type"],
                )
              }
              disabled={pending !== null}
            >
              {policy.allowed_document_types.map((type) => (
                <option key={type} value={type}>
                  {documentTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="document-file-control">
            <span>File</span>
            <input
              type="file"
              accept={policy.accepted_extensions.join(",")}
              disabled={pending !== null}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                if (selected) validate(selected);
              }}
            />
          </label>
          <button
            type="button"
            className="product-button product-button--accent"
            disabled={!file || pending !== null}
            onClick={() => void upload()}
          >
            <FileUp aria-hidden="true" /> Upload privately
          </button>
        </div>
        <p className="document-policy">
          {policy.accepted_extensions.join(", ")} · up to{" "}
          {formatBytes(policy.max_size_bytes)}
        </p>
        {progress !== null ? (
          <div className="upload-progress" role="status" aria-live="polite">
            <progress max="100" value={progress}>
              {progress}%
            </progress>
            <span>{progress}% uploaded</span>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="inline-error document-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="document-library" aria-labelledby="library-heading">
        <div className="product-section__head">
          <div>
            <p className="product-eyebrow">Your library</p>
            <h2 id="library-heading">Private documents</h2>
          </div>
          <span>{documents.length} files</span>
        </div>
        {documents.length ? (
          <ul>
            {documents.map((document) => (
              <li key={document.id} className="document-row">
                <div className="document-row__identity">
                  <DocumentStatusIcon document={document} />
                  <div>
                    <strong>{document.display_name}</strong>
                    <span>
                      {documentTypeLabel(document.document_type)} ·{" "}
                      {formatBytes(document.size_bytes)}
                    </span>
                  </div>
                </div>
                <DocumentStatus document={document} />
                <div className="document-row__actions">
                  <RenameControl
                    document={document}
                    disabled={pending !== null}
                    onRename={(displayName) =>
                      run(
                        `rename-${document.id}-${displayName}`,
                        `rename-${document.id}`,
                        async (key) => {
                          replaceDocument(
                            await api.renameDocument(
                              document.id,
                              { display_name: displayName },
                              key,
                            ),
                          );
                        },
                      )
                    }
                  />
                  <label className="icon-action">
                    <span className="sr-only">
                      Replace {document.display_name}
                    </span>
                    <RefreshCw aria-hidden="true" />
                    <input
                      className="sr-only"
                      type="file"
                      accept={policy.accepted_extensions.join(",")}
                      disabled={pending !== null}
                      onChange={(event) => {
                        const selected = event.target.files?.[0];
                        if (selected) void replace(document, selected);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-action"
                    disabled={pending !== null || document.status !== "ready"}
                    onClick={() => void download(document)}
                  >
                    <Download aria-hidden="true" />
                    <span className="sr-only">
                      Download {document.display_name}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-action icon-action--danger"
                    disabled={pending !== null}
                    aria-expanded={confirmingDelete === document.id}
                    onClick={() => setConfirmingDelete(document.id)}
                  >
                    <Trash2 aria-hidden="true" />
                    <span className="sr-only">
                      Delete {document.display_name}
                    </span>
                  </button>
                </div>
                {confirmingDelete === document.id ? (
                  <div
                    className="delete-confirmation"
                    role="group"
                    aria-labelledby={`delete-${document.id}`}
                  >
                    <p id={`delete-${document.id}`}>
                      Delete <strong>{document.display_name}</strong>? This is
                      permanent. Any readiness matches using it will become
                      incomplete, but no application status will change.
                    </p>
                    <div>
                      <button
                        type="button"
                        className="text-action"
                        onClick={() => setConfirmingDelete(null)}
                      >
                        Keep file
                      </button>
                      <button
                        type="button"
                        className="product-button product-button--ink"
                        disabled={pending !== null}
                        onClick={() =>
                          void run(
                            `delete-${document.id}`,
                            `delete-${document.id}`,
                            async (key) => {
                              await api.deleteDocument(document.id, key);
                              setDocuments((current) =>
                                current.filter(
                                  (item) => item.id !== document.id,
                                ),
                              );
                              setConfirmingDelete(null);
                            },
                          )
                        }
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <DataState
            kind="empty"
            title="Your private library is empty"
            description="Upload a document above. It will appear here while scanning and processing."
            compact
          />
        )}
      </section>

      <ReadinessPanel readiness={readiness} documents={documents} />
    </div>
  );
}

function ReadinessPanel({
  readiness,
  documents,
}: {
  readiness: DocumentReadinessResponse;
  documents: DocumentResponse[];
}) {
  return (
    <section className="document-readiness" aria-labelledby="readiness-heading">
      <div className="product-section__head">
        <div>
          <p className="product-eyebrow">No automatic sharing</p>
          <h2 id="readiness-heading">Application readiness</h2>
        </div>
        <LockKeyhole aria-hidden="true" />
      </div>
      {readiness.applications.length ? (
        <div className="readiness-grid">
          {readiness.applications.map((application) => (
            <article key={application.application_id}>
              <h3>{application.scholarship_title}</h3>
              <ul>
                {application.items.map((item) => {
                  const available = item.matched_document_ids.some((id) =>
                    documents.some(
                      (document) =>
                        document.id === id && document.status === "ready",
                    ),
                  );
                  return (
                    <li key={item.required_document}>
                      {item.ready && available ? (
                        <CheckCircle2 aria-hidden="true" />
                      ) : (
                        <XCircle aria-hidden="true" />
                      )}
                      <span>{item.required_document}</span>
                      <strong>
                        {item.ready && available ? "Ready" : "Missing"}
                      </strong>
                    </li>
                  );
                })}
              </ul>
              <p>
                <ShieldCheck aria-hidden="true" /> Private—nothing is shared
                externally.
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p>
          Track an application to compare its required documents with your
          private library.
        </p>
      )}
    </section>
  );
}

function RenameControl({
  document,
  disabled,
  onRename,
}: {
  document: DocumentResponse;
  disabled: boolean;
  onRename: (name: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(document.display_name);
  if (!editing) {
    return (
      <button
        type="button"
        className="icon-action"
        disabled={disabled}
        onClick={() => setEditing(true)}
      >
        <Pencil aria-hidden="true" />
        <span className="sr-only">Rename {document.display_name}</span>
      </button>
    );
  }
  return (
    <form
      className="rename-control"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (trimmed && trimmed !== document.display_name)
          void onRename(trimmed);
        setEditing(false);
      }}
    >
      <label>
        <span className="sr-only">New name</span>
        <input
          value={name}
          maxLength={200}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="submit" className="text-action">
        Save
      </button>
      <button
        type="button"
        className="text-action"
        onClick={() => setEditing(false)}
      >
        Cancel
      </button>
    </form>
  );
}

function DocumentStatus({ document }: { document: DocumentResponse }) {
  const copy: Record<DocumentResponse["status"], string> = {
    pending: "Waiting to scan",
    scanning: "Security scan",
    processing: "Processing",
    ready: "Ready",
    rejected: "Rejected",
    failed: "Processing failed",
  };
  return (
    <span className="document-status" data-status={document.status}>
      {copy[document.status]}
    </span>
  );
}

function DocumentStatusIcon({ document }: { document: DocumentResponse }) {
  if (document.status === "ready") return <CheckCircle2 aria-hidden="true" />;
  if (document.status === "failed" || document.status === "rejected")
    return <XCircle aria-hidden="true" />;
  return <ShieldCheck aria-hidden="true" />;
}

function documentTypeLabel(value: DocumentResponse["document_type"]) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function fileOperationId(
  prefix: string,
  file: File,
  documentType?: DocumentResponse["document_type"],
) {
  return [
    prefix,
    documentType,
    file.name,
    file.type,
    file.size,
    file.lastModified,
  ]
    .filter((value) => value !== undefined)
    .join(":");
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "That document action failed. Try again.";
}
