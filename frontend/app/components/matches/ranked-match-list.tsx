"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  RefreshCw,
  ShieldQuestion,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataState } from "@/app/components/product/data-state";
import { EligibilitySignal } from "@/app/components/scholarships/eligibility-signal";
import type { JobResponse, MatchPage } from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import { ApiError } from "@/app/lib/api/errors";
import {
  formatConfidence,
  formatMatchTimestamp,
  formatScore,
  matchIdempotencyKey,
} from "@/app/lib/matches/presentation";
import { deadlineState, formatDate } from "@/app/lib/scholarships/format";

type MatchActions = {
  recalculate?: () => Promise<JobResponse>;
  waitForJob?: (jobId: string) => Promise<JobResponse>;
  reload?: () => Promise<MatchPage>;
  loadPage?: (cursor: string) => Promise<MatchPage>;
};

export function RankedMatchList({
  initialPage,
  actions = {},
}: {
  initialPage: MatchPage;
  actions?: MatchActions;
}) {
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState(initialPage.data);
  const [pagination, setPagination] = useState(initialPage.pagination);
  const [pending, setPending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function recalculate() {
    if (pending) return;
    setPending(true);
    setError("");
    setStatus("Recalculation queued. You can keep reviewing these matches.");
    let api: ReturnType<typeof createBrowserApiClient> | null = null;
    const browserApi = () => (api ??= createBrowserApiClient());
    try {
      const job = actions.recalculate
        ? await actions.recalculate()
        : await browserApi().recalculateMatches(matchIdempotencyKey("matches"));
      const completed =
        job.status === "completed" || job.status === "failed"
          ? job
          : actions.waitForJob
            ? await actions.waitForJob(job.id)
            : await waitForJob(browserApi(), job.id);

      if (completed.status === "failed") {
        throw new Error("Recalculation failed");
      }

      const page = actions.reload
        ? await actions.reload()
        : await browserApi().listMatches({
            limit: initialPage.pagination.limit,
          });
      setItems(page.data);
      setPagination(page.pagination);
      setStatus(
        `Recalculation complete. Matches updated ${formatMatchTimestamp(completed.matches_updated_at ?? completed.updated_at)}.`,
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.kind === "rate_limited") {
        const wait = reason.retryAfterSeconds;
        setError(
          wait
            ? `Recalculation is rate limited. Try again in ${wait} seconds.`
            : "Recalculation is rate limited. Please wait and try again.",
        );
      } else {
        setError(
          "Matches could not be recalculated. Existing deterministic results remain available.",
        );
      }
      setStatus("");
    } finally {
      setPending(false);
    }
  }

  async function loadMore() {
    if (!pagination.next_cursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = actions.loadPage
        ? await actions.loadPage(pagination.next_cursor)
        : await createBrowserApiClient().listMatches({
            limit: pagination.limit,
            cursor: pagination.next_cursor,
          });
      setItems((current) => [...current, ...page.data]);
      setPagination(page.pagination);
    } catch {
      setError(
        "The next page could not be loaded. Current matches remain available.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const latest = items[0]?.calculated_at;

  return (
    <div className="match-list" data-motion={reduceMotion ? "reduced" : "full"}>
      <section
        className="match-list__controls"
        aria-labelledby="match-controls-title"
      >
        <div>
          <h2 id="match-controls-title">Your current ranking</h2>
          <p>
            Scores compare profile fit with available scholarship data. They are
            not probabilities of receiving an award.
          </p>
          {latest ? (
            <p className="match-list__updated">
              Last calculated{" "}
              <time dateTime={latest}>{formatMatchTimestamp(latest)}</time>
            </p>
          ) : null}
        </div>
        <button
          className="product-button product-button--accent"
          type="button"
          disabled={pending}
          onClick={recalculate}
        >
          <RefreshCw
            className={pending ? "data-state__spinner" : undefined}
            aria-hidden="true"
          />
          {pending ? "Recalculating…" : "Recalculate matches"}
        </button>
      </section>
      <div
        className="match-list__announcer"
        aria-live="polite"
        aria-atomic="true"
      >
        {status ? <p>{status}</p> : null}
        {error ? (
          <p className="match-list__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <DataState
          kind="empty"
          title="No ranked matches yet"
          description="Complete your profile, then recalculate to compare it with published scholarships."
          compact
        />
      ) : (
        <>
          <div
            className="ranked-matches"
            aria-label="Ranked scholarship matches"
          >
            <AnimatePresence initial={false}>
              {items.map((match) => {
                const deadline = deadlineState(
                  match.scholarship.deadline,
                  match.scholarship.status,
                );
                return (
                  <motion.article
                    className="ranked-match"
                    key={match.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18 }}
                    data-stale={
                      match.calculation_status === "stale" || undefined
                    }
                  >
                    <div
                      className="ranked-match__rank"
                      aria-label={`Rank ${match.rank}`}
                    >
                      <span>#</span>
                      {match.rank}
                    </div>
                    <div className="ranked-match__main">
                      <div className="ranked-match__labels">
                        <EligibilitySignal
                          status={match.scholarship.eligibility.status}
                          compact
                        />
                        {match.calculation_status === "stale" ? (
                          <span className="match-stale">
                            <AlertTriangle aria-hidden="true" />
                            Needs recalculation
                          </span>
                        ) : null}
                      </div>
                      <p className="product-eyebrow">
                        {match.scholarship.provider}
                      </p>
                      <h2>
                        <Link
                          href={`/matches/${match.scholarship.id}`}
                          prefetch={false}
                        >
                          {match.scholarship.title}
                        </Link>
                      </h2>
                      <div className="ranked-match__meta">
                        <span>
                          <CalendarDays aria-hidden="true" />
                          {formatDate(match.scholarship.deadline)}
                          {deadline === "expired" ? " — closed" : ""}
                        </span>
                        <span>
                          <ShieldQuestion aria-hidden="true" />
                          Input confidence {formatConfidence(match.confidence)}
                        </span>
                      </div>
                      <details className="match-metadata">
                        <summary>Calculation details</summary>
                        <dl>
                          <div>
                            <dt>Calculated</dt>
                            <dd>{formatMatchTimestamp(match.calculated_at)}</dd>
                          </div>
                          <div>
                            <dt>Algorithm</dt>
                            <dd>{match.algorithm_version}</dd>
                          </div>
                          <div>
                            <dt>Status</dt>
                            <dd>
                              {match.calculation_status === "stale"
                                ? "Stale — profile or data changed"
                                : "Current"}
                            </dd>
                          </div>
                        </dl>
                        {match.stale_reasons.length ? (
                          <ul>
                            {match.stale_reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        ) : null}
                      </details>
                    </div>
                    <div className="ranked-match__score">
                      <span>Total fit score</span>
                      <strong>{formatScore(match.score)}</strong>
                      <small>Not a winning probability</small>
                      <Link
                        href={`/matches/${match.scholarship.id}`}
                        prefetch={false}
                      >
                        See explanation <ArrowRight aria-hidden="true" />
                      </Link>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
          {pagination.has_more && pagination.next_cursor ? (
            <div className="scholarship-load-more">
              <button
                className="product-button product-button--quiet"
                type="button"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? "Loading…" : "Load more matches"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

async function waitForJob(
  api: ReturnType<typeof createBrowserApiClient>,
  jobId: string,
): Promise<JobResponse> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const job = await api.getMatchRecalculationJob(jobId);
    if (job.status === "completed" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Recalculation timed out");
}
