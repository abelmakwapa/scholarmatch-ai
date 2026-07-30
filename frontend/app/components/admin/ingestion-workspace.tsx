"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { ExactConfirmation } from "@/app/components/admin/exact-confirmation";
import { DataState } from "@/app/components/product/data-state";
import type {
  IngestionRunCreate,
  IngestionRunPage,
  IngestionRunResponse,
} from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import { safeExternalSource } from "@/app/lib/admin/safe-source";

type IngestionApi = {
  createIngestionRun: (
    body: IngestionRunCreate,
    key: string,
  ) => Promise<IngestionRunResponse>;
  retryIngestionRun: (id: string, key: string) => Promise<IngestionRunResponse>;
};

export function IngestionWorkspace({
  initialPage,
  api = createBrowserApiClient(),
}: {
  initialPage: IngestionRunPage;
  api?: IngestionApi;
}) {
  const [runs, setRuns] = useState(initialPage.data);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryRun, setRetryRun] = useState<IngestionRunResponse | null>(null);
  const retryKeys = useRef(new Map<string, string>());

  async function mutate(
    operation: string,
    action: (key: string) => Promise<IngestionRunResponse>,
  ) {
    if (pending) return;
    setPending(true);
    setError(null);
    const key = retryKeys.current.get(operation) ?? idempotencyKey();
    retryKeys.current.set(operation, key);
    try {
      const next = await action(key);
      retryKeys.current.delete(operation);
      setRuns((current) => [
        next,
        ...current.filter((run) => run.id !== next.id),
      ]);
      setRetryRun(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The ingestion operation failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-workspace">
      <form
        className="admin-ingestion-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const source = String(form.get("source") ?? "").trim();
          const sourceUrl = String(form.get("source_url") ?? "").trim();
          if (!source || (sourceUrl && !safeExternalSource(sourceUrl))) {
            setError(
              "Provide a source name and, when present, a valid HTTPS source URL.",
            );
            return;
          }
          void mutate(
            `create-${source}-${sourceUrl}-${String(form.get("dry_run") === "on")}`,
            (key) =>
              api.createIngestionRun(
                {
                  source,
                  source_url: sourceUrl || null,
                  dry_run: form.get("dry_run") === "on",
                },
                key,
              ),
          );
        }}
      >
        <div>
          <p className="product-eyebrow">Controlled source operation</p>
          <h2>Start ingestion run</h2>
          <p>Raw payloads and tokens are never displayed in this workspace.</p>
        </div>
        <label>
          <span>Source name</span>
          <input name="source" required maxLength={100} />
        </label>
        <label>
          <span>Source URL</span>
          <input
            name="source_url"
            type="url"
            maxLength={2048}
            placeholder="https://"
          />
        </label>
        <label className="admin-check">
          <input name="dry_run" type="checkbox" />
          <span>Dry run</span>
        </label>
        <button
          className="product-button product-button--accent"
          type="submit"
          disabled={pending}
        >
          Queue run
        </button>
      </form>
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {pending ? (
        <p className="admin-status" role="status">
          Submitting operation…
        </p>
      ) : null}
      {runs.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption>Ingestion runs</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Updated</th>
                <th scope="col">Duplicates</th>
                <th scope="col">Rejected</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <th scope="row">
                    <strong>{run.source}</strong>
                    {run.source_url && safeExternalSource(run.source_url) ? (
                      <a
                        href={safeExternalSource(run.source_url) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Source <ExternalLink aria-hidden="true" />
                      </a>
                    ) : null}
                  </th>
                  <td>
                    <span className="admin-pill" data-status={run.status}>
                      {label(run.status)}
                    </span>
                  </td>
                  <td>
                    <time dateTime={run.created_at}>
                      {format(run.created_at)}
                    </time>
                  </td>
                  <td>
                    <time dateTime={run.updated_at}>
                      {format(run.updated_at)}
                    </time>
                  </td>
                  <td>{run.counters.duplicates}</td>
                  <td>{run.counters.rejected}</td>
                  <td>
                    <div className="admin-row-actions">
                      <Link href={`/admin/ingestion/${run.id}`}>Details</Link>
                      {run.status === "failed" || run.status === "cancelled" ? (
                        <button
                          type="button"
                          className="text-action"
                          onClick={() => setRetryRun(run)}
                        >
                          <RefreshCw aria-hidden="true" /> Retry
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DataState
          kind="empty"
          title="No ingestion runs"
          description="Queue a dry run to validate an approved source safely."
          compact
        />
      )}
      {retryRun ? (
        <ExactConfirmation
          action="retry"
          targetName={`${retryRun.source} ingestion`}
          description="Queues a linked retry; the original run and its safe error history remain unchanged."
          pending={pending}
          onCancel={() => setRetryRun(null)}
          onConfirm={() =>
            mutate(`retry-${retryRun.id}`, (key) =>
              api.retryIngestionRun(retryRun.id, key),
            )
          }
        />
      ) : null}
    </div>
  );
}

export function IngestionRunDetail({
  run,
  onRetry,
}: {
  run: IngestionRunResponse;
  onRetry?: (run: IngestionRunResponse) => void;
}) {
  return (
    <div className="ingestion-detail">
      <section className="admin-detail-summary">
        <div>
          <p className="product-eyebrow">Run source</p>
          <h2>{run.source}</h2>
          {run.source_url && safeExternalSource(run.source_url) ? (
            <a
              href={safeExternalSource(run.source_url) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open constrained source <ExternalLink aria-hidden="true" />
            </a>
          ) : null}
        </div>
        <span className="admin-pill" data-status={run.status}>
          {label(run.status)}
        </span>
      </section>
      <dl className="admin-metrics">
        <div>
          <dt>Created</dt>
          <dd>{run.counters.created}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{run.counters.updated}</dd>
        </div>
        <div>
          <dt>Duplicates</dt>
          <dd>{run.counters.duplicates}</dd>
        </div>
        <div>
          <dt>Rejected</dt>
          <dd>{run.counters.rejected}</dd>
        </div>
      </dl>
      <section className="admin-detail-grid">
        <div>
          <h2>Timestamps</h2>
          <dl>
            <div>
              <dt>Created</dt>
              <dd>
                <time dateTime={run.created_at}>{format(run.created_at)}</time>
              </dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>
                <time dateTime={run.updated_at}>{format(run.updated_at)}</time>
              </dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>
                {run.completed_at ? (
                  <time dateTime={run.completed_at}>
                    {format(run.completed_at)}
                  </time>
                ) : (
                  "Not completed"
                )}
              </dd>
            </div>
          </dl>
        </div>
        <div>
          <h2>Safe error summaries</h2>
          {run.safe_errors.length ? (
            <ul>
              {run.safe_errors.map((error) => (
                <li key={error.code}>
                  <strong>{error.code}</strong>
                  <span>{error.summary}</span>
                  <small>{error.count} records</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No safe error summaries recorded.</p>
          )}
        </div>
      </section>
      {onRetry && (run.status === "failed" || run.status === "cancelled") ? (
        <button
          type="button"
          className="product-button product-button--accent"
          onClick={() => onRetry(run)}
        >
          Retry this run
        </button>
      ) : null}
      <p className="admin-security-note">
        Only sanitized error codes and summaries are rendered. Raw imported
        data, HTML, tokens, and credentials remain server-side.
      </p>
    </div>
  );
}

export function IngestionRunDetailWorkspace({
  initialRun,
  api = createBrowserApiClient(),
}: {
  initialRun: IngestionRunResponse;
  api?: Pick<IngestionApi, "retryIngestionRun">;
}) {
  const [run, setRun] = useState(initialRun);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryKey = useRef<string | null>(null);
  async function retry() {
    if (pending) return;
    setPending(true);
    setError(null);
    retryKey.current ??= idempotencyKey();
    try {
      setRun(await api.retryIngestionRun(run.id, retryKey.current));
      retryKey.current = null;
      setConfirming(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The ingestion retry failed.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <IngestionRunDetail run={run} onRetry={() => setConfirming(true)} />
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <ExactConfirmation
          action="retry"
          targetName={`${run.source} ingestion`}
          description="Queues a linked retry and preserves this original run."
          pending={pending}
          onCancel={() => setConfirming(false)}
          onConfirm={retry}
        />
      ) : null}
    </>
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
  return value
    .replaceAll("_", " ")
    .replace(/^./, (value) => value.toUpperCase());
}
function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
