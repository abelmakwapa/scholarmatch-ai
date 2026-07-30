"use client";

import { CheckCircle2, ExternalLink } from "lucide-react";
import { useRef, useState } from "react";

import { DataState } from "@/app/components/product/data-state";
import type {
  AdminVerificationItem,
  AdminVerificationPage,
  AdminVerificationWrite,
} from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import { safeExternalSource } from "@/app/lib/admin/safe-source";

type VerificationApi = {
  verifyAdminScholarship: (
    id: string,
    body: AdminVerificationWrite,
    key: string,
  ) => Promise<AdminVerificationItem>;
};

export function VerificationWorkspace({
  initialPage,
  api = createBrowserApiClient(),
}: {
  initialPage: AdminVerificationPage;
  api?: VerificationApi;
}) {
  const [items, setItems] = useState(initialPage.data);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [accept, setAccept] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retryKeys = useRef(new Map<string, string>());

  async function verify(item: AdminVerificationItem) {
    const reviewerNotes = notes[item.scholarship_id]?.trim();
    if (!reviewerNotes || pending) return;
    const operation = `verify-${item.scholarship_id}-${String(Boolean(accept[item.scholarship_id]))}-${reviewerNotes}`;
    const key = retryKeys.current.get(operation) ?? idempotencyKey();
    retryKeys.current.set(operation, key);
    setPending(item.scholarship_id);
    setError(null);
    try {
      await api.verifyAdminScholarship(
        item.scholarship_id,
        {
          reviewer_notes: reviewerNotes,
          accept_source_changes: Boolean(accept[item.scholarship_id]),
        },
        key,
      );
      retryKeys.current.delete(operation);
      setItems((current) =>
        current.filter((entry) => entry.scholarship_id !== item.scholarship_id),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Verification could not be recorded.",
      );
    } finally {
      setPending(null);
    }
  }

  if (!items.length)
    return (
      <DataState
        kind="empty"
        title="Verification queue is clear"
        description="No records are stale or awaiting changed-source review."
        compact
      />
    );
  return (
    <div className="verification-list">
      {items.map((item) => {
        const source = safeExternalSource(item.source_url);
        return (
          <article key={item.scholarship_id}>
            <header>
              <div>
                <p className="product-eyebrow">{label(item.freshness)}</p>
                <h2>{item.title}</h2>
                <span>{item.provider}</span>
              </div>
              <div>
                {item.last_verified_at ? (
                  <>
                    <small>Last verified</small>
                    <time dateTime={item.last_verified_at}>
                      {format(item.last_verified_at)}
                    </time>
                  </>
                ) : (
                  <strong>Never verified</strong>
                )}
                {source ? (
                  <a href={source} target="_blank" rel="noopener noreferrer">
                    Source <ExternalLink aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </header>
            {item.changed_fields.length ? (
              <div className="change-table-wrap">
                <table className="change-table">
                  <caption>Changed source fields for {item.title}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Before</th>
                      <th scope="col">Current source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.changed_fields.map((change) => (
                      <tr key={change.field}>
                        <th scope="row">{label(change.field)}</th>
                        <td>
                          {change.before_summary ?? "Not previously recorded"}
                        </td>
                        <td>{change.after_summary ?? "Removed at source"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No field changes detected; this review is freshness-based.</p>
            )}
            <label>
              <span>Reviewer notes</span>
              <textarea
                maxLength={3000}
                value={notes[item.scholarship_id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [item.scholarship_id]: event.target.value,
                  }))
                }
              />
            </label>
            {item.changed_fields.length ? (
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={Boolean(accept[item.scholarship_id])}
                  onChange={(event) =>
                    setAccept((current) => ({
                      ...current,
                      [item.scholarship_id]: event.target.checked,
                    }))
                  }
                />
                <span>Accept the reviewed source changes</span>
              </label>
            ) : null}
            <button
              type="button"
              className="product-button product-button--accent"
              disabled={!notes[item.scholarship_id]?.trim() || pending !== null}
              onClick={() => void verify(item)}
            >
              <CheckCircle2 aria-hidden="true" /> Record verification
            </button>
          </article>
        );
      })}
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function format(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
function label(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (item) => item.toUpperCase());
}
function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
