"use client";

import { ExternalLink, GitMerge } from "lucide-react";
import { useRef, useState } from "react";

import { ExactConfirmation } from "@/app/components/admin/exact-confirmation";
import { DataState } from "@/app/components/product/data-state";
import type {
  AdminDuplicateMergeRequest,
  AdminDuplicateMergeResponse,
  AdminDuplicatePage,
} from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import { safeExternalSource } from "@/app/lib/admin/safe-source";

type DuplicateApi = {
  mergeAdminDuplicateGroup: (
    id: string,
    body: AdminDuplicateMergeRequest,
    key: string,
  ) => Promise<AdminDuplicateMergeResponse>;
};

export function DuplicateWorkspace({
  initialPage,
  api = createBrowserApiClient(),
}: {
  initialPage: AdminDuplicatePage;
  api?: DuplicateApi;
}) {
  const [groups, setGroups] = useState(initialPage.data);
  const [canonical, setCanonical] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryKeys = useRef(new Map<string, string>());
  const group = groups.find((item) => item.id === confirming);
  const canonicalId = group
    ? (canonical[group.id] ?? group.candidates[0]?.scholarship_id)
    : undefined;
  const canonicalName = group?.candidates.find(
    (item) => item.scholarship_id === canonicalId,
  )?.title;

  async function merge() {
    if (!group || !canonicalId || !notes[group.id]?.trim()) return;
    const operation = `merge-${group.id}-${canonicalId}`;
    const key = retryKeys.current.get(operation) ?? idempotencyKey();
    retryKeys.current.set(operation, key);
    setPending(true);
    setError(null);
    try {
      await api.mergeAdminDuplicateGroup(
        group.id,
        {
          canonical_scholarship_id: canonicalId,
          duplicate_scholarship_ids: group.candidates
            .filter((item) => item.scholarship_id !== canonicalId)
            .map((item) => item.scholarship_id),
          reviewer_notes: notes[group.id].trim(),
        },
        key,
      );
      retryKeys.current.delete(operation);
      setGroups((current) => current.filter((item) => item.id !== group.id));
      setConfirming(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The duplicate group could not be merged.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!groups.length)
    return (
      <DataState
        kind="empty"
        title="No duplicate groups"
        description="Source comparisons have no unresolved candidate groups."
        compact
      />
    );
  return (
    <div className="duplicate-grid">
      {groups.map((item) => (
        <article key={item.id} className="duplicate-group">
          <header>
            <div>
              <p className="product-eyebrow">Potential duplicate</p>
              <h2>{item.reason}</h2>
            </div>
            <span>{item.candidates.length} records</span>
          </header>
          <fieldset>
            <legend>Select the canonical record</legend>
            {item.candidates.map((candidate) => (
              <label
                key={candidate.scholarship_id}
                className="duplicate-candidate"
              >
                <input
                  type="radio"
                  name={`canonical-${item.id}`}
                  checked={
                    (canonical[item.id] ??
                      item.candidates[0]?.scholarship_id) ===
                    candidate.scholarship_id
                  }
                  onChange={() =>
                    setCanonical((current) => ({
                      ...current,
                      [item.id]: candidate.scholarship_id,
                    }))
                  }
                />
                <span>
                  <strong>{candidate.title}</strong>
                  <small>
                    {candidate.provider} · {candidate.status}
                  </small>
                  {candidate.source_history.map((source) => {
                    const safe = safeExternalSource(source.source_url);
                    return safe ? (
                      <a
                        href={safe}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={source.id}
                      >
                        {source.source} <ExternalLink aria-hidden="true" />
                      </a>
                    ) : null;
                  })}
                </span>
              </label>
            ))}
          </fieldset>
          <label>
            <span>Required reviewer notes</span>
            <textarea
              value={notes[item.id] ?? ""}
              maxLength={3000}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [item.id]: event.target.value,
                }))
              }
            />
          </label>
          <button
            type="button"
            className="product-button product-button--quiet"
            disabled={!notes[item.id]?.trim()}
            onClick={() => setConfirming(item.id)}
          >
            <GitMerge aria-hidden="true" /> Preview merge
          </button>
          <p>
            All source-history entries remain attached to the canonical
            scholarship.
          </p>
        </article>
      ))}
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {group && canonicalName ? (
        <ExactConfirmation
          action="merge into"
          targetName={canonicalName}
          description={`Merges ${group.candidates.length - 1} duplicate record(s) while preserving every source-history entry and appending an audit event.`}
          pending={pending}
          onCancel={() => setConfirming(null)}
          onConfirm={merge}
        />
      ) : null}
    </div>
  );
}

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
