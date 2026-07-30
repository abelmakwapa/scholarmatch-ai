"use client";

import { ExternalLink, Plus, Save, ShieldAlert, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { ExactConfirmation } from "@/app/components/admin/exact-confirmation";
import { DataState } from "@/app/components/product/data-state";
import type {
  AdminBulkActionPreviewRequest,
  AdminBulkActionPreviewResponse,
  AdminBulkActionResponse,
  AdminBulkUndoResponse,
  AdminLifecycleTransition,
  AdminRequirementSetWrite,
  AdminScholarshipPage,
  AdminScholarshipPatch,
  AdminScholarshipResponse,
  AdminScholarshipWrite,
} from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import { safeExternalSource } from "@/app/lib/admin/safe-source";

type AdminScholarshipApi = {
  createAdminScholarship: (
    body: AdminScholarshipWrite,
    key: string,
  ) => Promise<AdminScholarshipResponse>;
  updateAdminScholarship: (
    id: string,
    body: AdminScholarshipPatch,
    key: string,
  ) => Promise<AdminScholarshipResponse>;
  transitionAdminScholarship: (
    id: string,
    body: AdminLifecycleTransition,
    key: string,
  ) => Promise<AdminScholarshipResponse>;
  replaceAdminScholarshipRequirements: (
    id: string,
    body: AdminRequirementSetWrite,
    key: string,
  ) => Promise<AdminScholarshipResponse>;
  previewAdminBulkAction: (
    body: AdminBulkActionPreviewRequest,
  ) => Promise<AdminBulkActionPreviewResponse>;
  applyAdminBulkAction: (
    token: string,
    key: string,
  ) => Promise<AdminBulkActionResponse>;
  undoAdminBulkAction: (
    operationId: string,
    key: string,
  ) => Promise<AdminBulkUndoResponse>;
};

type Confirmation = {
  action: string;
  targetName: string;
  description: string;
  execute: () => Promise<void>;
};

export function ScholarshipAdminWorkspace({
  initialPage,
  api = createBrowserApiClient(),
}: {
  initialPage: AdminScholarshipPage;
  api?: AdminScholarshipApi;
}) {
  const [records, setRecords] = useState(initialPage.data);
  const [selected, setSelected] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [bulkAction, setBulkAction] = useState<
    "publish" | "unpublish" | "expire" | "archive"
  >("publish");
  const [bulkPreview, setBulkPreview] =
    useState<AdminBulkActionPreviewResponse | null>(null);
  const [bulkResult, setBulkResult] = useState<AdminBulkActionResponse | null>(
    null,
  );
  const retryKeys = useRef(new Map<string, string>());

  function replace(next: AdminScholarshipResponse) {
    setRecords((current) => {
      const exists = current.some((item) => item.id === next.id);
      return exists
        ? current.map((item) => (item.id === next.id ? next : item))
        : [next, ...current];
    });
  }

  async function mutate(
    operation: string,
    label: string,
    action: (key: string) => Promise<void>,
  ) {
    if (pending) return;
    setPending(label);
    setError(null);
    const key = retryKeys.current.get(operation) ?? idempotencyKey();
    retryKeys.current.set(operation, key);
    try {
      await action(key);
      retryKeys.current.delete(operation);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setPending(null);
    }
  }

  function requestLifecycle(
    record: AdminScholarshipResponse,
    action: AdminLifecycleTransition["action"],
  ) {
    const exact = action.replaceAll("_", " ");
    setConfirmation({
      action: exact,
      targetName: record.title,
      description: lifecycleDescription(action),
      execute: async () => {
        await mutate(`lifecycle-${record.id}-${action}`, exact, async (key) => {
          replace(
            await api.transitionAdminScholarship(
              record.id,
              { action, reviewer_notes: null },
              key,
            ),
          );
          setConfirmation(null);
        });
      },
    });
  }

  async function previewBulk() {
    if (!selected.length || selected.length > 50) return;
    setPending("bulk preview");
    setError(null);
    try {
      setBulkPreview(
        await api.previewAdminBulkAction({
          scholarship_ids: selected,
          action: bulkAction,
        }),
      );
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setPending(null);
    }
  }

  function requestBulkApply() {
    if (!bulkPreview) return;
    const targetName = `${bulkPreview.affected.length} scholarships`;
    setConfirmation({
      action: bulkPreview.action,
      targetName,
      description: `${bulkPreview.blocked.length} blocked records will be skipped. This applies only the reviewed preview.`,
      execute: async () => {
        await mutate(
          `bulk-${bulkPreview.preview_token}`,
          "bulk action",
          async (key) => {
            setBulkResult(
              await api.applyAdminBulkAction(bulkPreview.preview_token, key),
            );
            setSelected([]);
            setBulkPreview(null);
            setConfirmation(null);
          },
        );
      },
    });
  }

  return (
    <div className="admin-workspace">
      <section className="admin-toolbar" aria-label="Scholarship operations">
        <div>
          <h2>Catalogue records</h2>
          <p>
            {records.length} loaded · select at most 50 for a bounded bulk
            preview
          </p>
        </div>
        <button
          type="button"
          className="product-button product-button--accent"
          onClick={() => setCreateOpen((value) => !value)}
        >
          <Plus aria-hidden="true" /> Create scholarship
        </button>
      </section>

      {createOpen ? (
        <ScholarshipForm
          title="New draft scholarship"
          submitLabel="Create draft"
          disabled={pending !== null}
          onSubmit={(body) =>
            mutate(
              `create-${body.title}-${body.provider}`,
              "draft",
              async (key) => {
                replace(
                  await api.createAdminScholarship(
                    body as AdminScholarshipWrite,
                    key,
                  ),
                );
                setCreateOpen(false);
              },
            )
          }
          onCancel={() => setCreateOpen(false)}
        />
      ) : null}

      <section className="admin-bulk" aria-labelledby="bulk-heading">
        <div>
          <h2 id="bulk-heading">Bounded bulk action</h2>
          <p>
            Preview the exact records and blocked reasons before applying.
            Maximum 50 explicit records.
          </p>
        </div>
        <label>
          <span>Action</span>
          <select
            value={bulkAction}
            onChange={(event) =>
              setBulkAction(event.target.value as typeof bulkAction)
            }
          >
            <option value="publish">Publish</option>
            <option value="unpublish">Unpublish</option>
            <option value="expire">Expire</option>
            <option value="archive">Archive</option>
          </select>
        </label>
        <button
          type="button"
          className="product-button product-button--quiet"
          disabled={
            !selected.length || selected.length > 50 || pending !== null
          }
          onClick={() => void previewBulk()}
        >
          Preview {selected.length || "selected"}
        </button>
      </section>

      {bulkPreview ? (
        <section className="admin-bulk-preview" aria-live="polite">
          <h3>
            {bulkPreview.affected.length} records can be {bulkPreview.action}ed
          </h3>
          <ul>
            {bulkPreview.affected.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
          {bulkPreview.blocked.length ? (
            <details>
              <summary>{bulkPreview.blocked.length} blocked</summary>
              <ul>
                {bulkPreview.blocked.map((item) => (
                  <li key={item.scholarship_id}>
                    <strong>{item.title}</strong> — {item.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <p>
            Preview expires{" "}
            <time dateTime={bulkPreview.expires_at}>
              {formatTimestamp(bulkPreview.expires_at)}
            </time>
            .
          </p>
          <button
            type="button"
            className="product-button product-button--ink"
            onClick={requestBulkApply}
          >
            Continue to confirmation
          </button>
        </section>
      ) : null}

      {bulkResult ? (
        <section className="admin-bulk-preview" aria-live="polite">
          <h3>{bulkResult.accepted_count} record changes accepted</h3>
          <p>
            Operation <code>{bulkResult.operation_id}</code> was accepted at{" "}
            <time dateTime={bulkResult.created_at}>
              {formatTimestamp(bulkResult.created_at)}
            </time>
            .
          </p>
          {bulkResult.recoverable_until ? (
            <>
              <p>
                This operation can be undone until{" "}
                <time dateTime={bulkResult.recoverable_until}>
                  {formatTimestamp(bulkResult.recoverable_until)}
                </time>
                .
              </p>
              <button
                type="button"
                className="product-button product-button--quiet"
                disabled={pending !== null}
                onClick={() =>
                  void mutate(
                    `undo-bulk-${bulkResult.operation_id}`,
                    "bulk recovery",
                    async (key) => {
                      await api.undoAdminBulkAction(
                        bulkResult.operation_id,
                        key,
                      );
                      setBulkResult(null);
                    },
                  )
                }
              >
                Undo bulk action
              </button>
            </>
          ) : (
            <p>This operation has no recovery window.</p>
          )}
        </section>
      ) : null}

      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {pending ? (
        <p className="admin-status" role="status">
          Working on {pending}…
        </p>
      ) : null}

      {records.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption>
              Administrative scholarship records and review controls
            </caption>
            <thead>
              <tr>
                <th scope="col">Select</th>
                <th scope="col">Scholarship</th>
                <th scope="col">Status</th>
                <th scope="col">Freshness</th>
                <th scope="col">Review</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${record.title}`}
                      checked={selected.includes(record.id)}
                      disabled={
                        !selected.includes(record.id) && selected.length >= 50
                      }
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(record.id)
                            ? current.filter((id) => id !== record.id)
                            : [...current, record.id],
                        )
                      }
                    />
                  </td>
                  <th scope="row">
                    <strong>{record.title}</strong>
                    <span>{record.provider}</span>
                    <SafeSourceLink value={record.source_url} />
                  </th>
                  <td>
                    <span className="admin-pill" data-status={record.status}>
                      {label(record.status)}
                    </span>
                  </td>
                  <td>
                    <time dateTime={record.verified_at ?? record.updated_at}>
                      {formatTimestamp(record.verified_at ?? record.updated_at)}
                    </time>
                  </td>
                  <td>
                    <details className="admin-record-detail">
                      <summary>Open review</summary>
                      <ScholarshipReview
                        record={record}
                        disabled={pending !== null}
                        onSave={(body) =>
                          mutate(
                            `edit-${record.id}-${JSON.stringify(body)}`,
                            "edit",
                            async (key) =>
                              replace(
                                await api.updateAdminScholarship(
                                  record.id,
                                  body,
                                  key,
                                ),
                              ),
                          )
                        }
                        onRequirements={(body) =>
                          mutate(
                            `requirements-${record.id}-${JSON.stringify(body)}`,
                            "requirements",
                            async (key) =>
                              replace(
                                await api.replaceAdminScholarshipRequirements(
                                  record.id,
                                  body,
                                  key,
                                ),
                              ),
                          )
                        }
                        onLifecycle={(action) =>
                          requestLifecycle(record, action)
                        }
                      />
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DataState
          kind="empty"
          title="No scholarship records"
          description="Create a draft or run an approved ingestion source."
          compact
        />
      )}

      {confirmation ? (
        <ExactConfirmation
          {...confirmation}
          pending={pending !== null}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmation.execute}
        />
      ) : null}
    </div>
  );
}

function ScholarshipReview({
  record,
  disabled,
  onSave,
  onRequirements,
  onLifecycle,
}: {
  record: AdminScholarshipResponse;
  disabled: boolean;
  onSave: (body: AdminScholarshipPatch) => void | Promise<void>;
  onRequirements: (body: AdminRequirementSetWrite) => void | Promise<void>;
  onLifecycle: (action: AdminLifecycleTransition["action"]) => void;
}) {
  return (
    <div className="admin-review-panel">
      <ScholarshipForm
        title="Editorial fields"
        record={record}
        submitLabel="Save edits"
        disabled={disabled}
        onSubmit={onSave}
      />
      <RequirementEditor
        record={record}
        disabled={disabled}
        onSave={onRequirements}
      />
      <section
        className="admin-lifecycle"
        aria-label={`Lifecycle actions for ${record.title}`}
      >
        <h3>Lifecycle</h3>
        <p>Only transitions currently allowed by the API are shown.</p>
        <div>
          {record.allowed_transitions.map((action) => (
            <button
              type="button"
              className="product-button product-button--quiet"
              key={action}
              disabled={disabled}
              onClick={() => onLifecycle(action)}
            >
              {label(action)}
            </button>
          ))}
        </div>
      </section>
      <details>
        <summary>Source history ({record.source_history.length})</summary>
        <ul className="source-history">
          {record.source_history.map((source) => (
            <li key={source.id}>
              <strong>{source.source}</strong>
              <SafeSourceLink value={source.source_url} />
              <span>{source.active ? "Active" : "Historical"}</span>
              <time dateTime={source.last_seen_at}>
                {formatTimestamp(source.last_seen_at)}
              </time>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ScholarshipForm({
  title,
  record,
  submitLabel,
  disabled,
  onSubmit,
  onCancel,
}: {
  title: string;
  record?: AdminScholarshipResponse;
  submitLabel: string;
  disabled: boolean;
  onSubmit: (
    body: AdminScholarshipWrite | AdminScholarshipPatch,
  ) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [validation, setValidation] = useState<string | null>(null);
  return (
    <form
      className="admin-editor"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const sourceUrl = String(form.get("source_url") ?? "").trim();
        if (!safeExternalSource(sourceUrl)) {
          setValidation(
            "Source links must be valid HTTPS URLs without embedded credentials.",
          );
          return;
        }
        const body = {
          title: String(form.get("title") ?? "").trim(),
          provider: String(form.get("provider") ?? "").trim(),
          funding_type: String(
            form.get("funding_type"),
          ) as AdminScholarshipWrite["funding_type"],
          description: nullable(form.get("description")),
          funding_summary: nullable(form.get("funding_summary")),
          deadline: nullable(form.get("deadline")),
          source_url: sourceUrl,
          reviewer_notes: nullable(form.get("reviewer_notes")),
        };
        if (!body.title || !body.provider) {
          setValidation("Title and provider are required.");
          return;
        }
        setValidation(null);
        void onSubmit(body);
      }}
    >
      <h3>{title}</h3>
      <div className="admin-form-grid">
        <label>
          <span>Title</span>
          <input
            name="title"
            required
            maxLength={300}
            defaultValue={record?.title}
          />
        </label>
        <label>
          <span>Provider</span>
          <input
            name="provider"
            required
            maxLength={300}
            defaultValue={record?.provider}
          />
        </label>
        <label>
          <span>Funding type</span>
          <select
            name="funding_type"
            defaultValue={record?.funding_type ?? "other"}
          >
            <option value="full">Full</option>
            <option value="partial">Partial</option>
            <option value="tuition">Tuition</option>
            <option value="stipend">Stipend</option>
            <option value="research">Research</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span>Deadline</span>
          <input
            name="deadline"
            type="date"
            defaultValue={record?.deadline ?? ""}
          />
        </label>
        <label className="admin-form-wide">
          <span>Source URL</span>
          <input
            name="source_url"
            type="url"
            required
            maxLength={2048}
            defaultValue={record?.source_url}
          />
        </label>
        <label className="admin-form-wide">
          <span>Description (plain text)</span>
          <textarea
            name="description"
            maxLength={20000}
            defaultValue={record?.description ?? ""}
          />
        </label>
        <label className="admin-form-wide">
          <span>Funding summary</span>
          <textarea
            name="funding_summary"
            maxLength={2000}
            defaultValue={record?.funding_summary ?? ""}
          />
        </label>
        <label className="admin-form-wide">
          <span>Reviewer notes</span>
          <textarea
            name="reviewer_notes"
            maxLength={5000}
            defaultValue={record?.reviewer_notes ?? ""}
          />
        </label>
      </div>
      {validation ? (
        <p className="admin-error" role="alert">
          {validation}
        </p>
      ) : null}
      <div className="admin-form-actions">
        {onCancel ? (
          <button type="button" className="text-action" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          className="product-button product-button--accent"
          disabled={disabled}
        >
          <Save aria-hidden="true" /> {submitLabel}
        </button>
      </div>
    </form>
  );
}

type RequirementDraft = AdminRequirementSetWrite["requirements"][number];

function RequirementEditor({
  record,
  disabled,
  onSave,
}: {
  record: AdminScholarshipResponse;
  disabled: boolean;
  onSave: (body: AdminRequirementSetWrite) => void | Promise<void>;
}) {
  const [items, setItems] = useState<RequirementDraft[]>(
    record.requirements.map((item) => ({
      constraint: item.constraint,
      field: item.field,
      operator: item.operator,
      value: item.value,
      source_evidence: item.source_evidence,
      reviewer_notes: item.reviewer_notes,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="requirement-editor">
      <div>
        <h3>Structured requirements</h3>
        <button
          type="button"
          className="text-action"
          disabled={disabled || items.length >= 100}
          onClick={() =>
            setItems((current) => [
              ...current,
              emptyRequirement(record.source_url),
            ])
          }
        >
          <Plus aria-hidden="true" /> Add requirement
        </button>
      </div>
      {items.map((item, index) => (
        <fieldset key={index} disabled={disabled}>
          <legend>Requirement {index + 1}</legend>
          <label>
            <span>Constraint</span>
            <select
              value={item.constraint}
              onChange={(event) =>
                updateRequirement(setItems, index, {
                  constraint: event.target
                    .value as RequirementDraft["constraint"],
                })
              }
            >
              <option value="hard">Hard</option>
              <option value="soft">Soft</option>
            </select>
          </label>
          <label>
            <span>Field</span>
            <select
              value={item.field}
              onChange={(event) =>
                updateRequirement(setItems, index, {
                  field: event.target.value as RequirementDraft["field"],
                })
              }
            >
              {[
                "study_level",
                "field_of_study",
                "destination",
                "nationality",
                "residency",
                "gpa",
                "experience",
                "document",
                "other",
              ].map((value) => (
                <option value={value} key={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Operator</span>
            <select
              value={item.operator}
              onChange={(event) =>
                updateRequirement(setItems, index, {
                  operator: event.target.value as RequirementDraft["operator"],
                })
              }
            >
              {[
                "equals",
                "not_equals",
                "in",
                "not_in",
                "gte",
                "lte",
                "contains",
                "exists",
              ].map((value) => (
                <option value={value} key={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Value</span>
            <input
              value={String(item.value)}
              maxLength={1000}
              onChange={(event) =>
                updateRequirement(setItems, index, {
                  value: event.target.value,
                })
              }
            />
          </label>
          <label>
            <span>Evidence label</span>
            <input
              value={item.source_evidence.label}
              maxLength={300}
              onChange={(event) =>
                updateRequirement(setItems, index, {
                  source_evidence: {
                    ...item.source_evidence,
                    label: event.target.value,
                  },
                })
              }
            />
          </label>
          <label>
            <span>Evidence URL</span>
            <input
              type="url"
              value={item.source_evidence.source_url}
              maxLength={2048}
              onChange={(event) =>
                updateRequirement(setItems, index, {
                  source_evidence: {
                    ...item.source_evidence,
                    source_url: event.target.value,
                  },
                })
              }
            />
          </label>
          <label className="admin-form-wide">
            <span>Evidence summary (plain text)</span>
            <textarea
              value={item.source_evidence.summary}
              maxLength={2000}
              onChange={(event) =>
                updateRequirement(setItems, index, {
                  source_evidence: {
                    ...item.source_evidence,
                    summary: event.target.value,
                  },
                })
              }
            />
          </label>
          <label className="admin-form-wide">
            <span>Reviewer notes</span>
            <textarea
              value={item.reviewer_notes ?? ""}
              maxLength={3000}
              onChange={(event) =>
                updateRequirement(setItems, index, {
                  reviewer_notes: event.target.value || null,
                })
              }
            />
          </label>
          <button
            type="button"
            className="icon-action icon-action--danger"
            aria-label={`Remove requirement ${index + 1}`}
            onClick={() =>
              setItems((current) =>
                current.filter((_, itemIndex) => itemIndex !== index),
              )
            }
          >
            <Trash2 aria-hidden="true" />
          </button>
        </fieldset>
      ))}
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="product-button product-button--quiet"
        disabled={disabled}
        onClick={() => {
          const invalid = items.find(
            (item) =>
              !item.source_evidence.label.trim() ||
              !item.source_evidence.summary.trim() ||
              !safeExternalSource(item.source_evidence.source_url),
          );
          if (invalid) {
            setError(
              "Each requirement needs an evidence label, plain-text summary, and valid HTTPS source URL.",
            );
            return;
          }
          setError(null);
          void onSave({ requirements: items });
        }}
      >
        <Save aria-hidden="true" /> Save requirements
      </button>
    </section>
  );
}

function SafeSourceLink({ value }: { value: string }) {
  const safe = safeExternalSource(value);
  return safe ? (
    <a href={safe} target="_blank" rel="noopener noreferrer">
      Source <ExternalLink aria-hidden="true" />
    </a>
  ) : (
    <span className="unsafe-source">
      <ShieldAlert aria-hidden="true" /> Invalid source hidden
    </span>
  );
}

function updateRequirement(
  setItems: React.Dispatch<React.SetStateAction<RequirementDraft[]>>,
  index: number,
  patch: Partial<RequirementDraft>,
) {
  setItems((current) =>
    current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ),
  );
}

function emptyRequirement(sourceUrl: string): RequirementDraft {
  return {
    constraint: "hard",
    field: "study_level",
    operator: "equals",
    value: "",
    source_evidence: { label: "", source_url: sourceUrl, summary: "" },
    reviewer_notes: null,
  };
}

function lifecycleDescription(action: AdminLifecycleTransition["action"]) {
  const descriptions = {
    submit_for_review: "Moves this draft into the review queue.",
    publish:
      "Makes this scholarship visible to students after server validation.",
    unpublish:
      "Removes this scholarship from student discovery without deleting its history.",
    expire: "Marks the opportunity expired and non-actionable.",
    archive:
      "Removes this record from active operations while retaining source and audit history.",
  };
  return descriptions[action];
}

function nullable(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}
function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
function messageFrom(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The administrative action could not be completed.";
}
