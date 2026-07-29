import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  ExternalLink,
  Lightbulb,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchFeedback } from "@/app/components/matches/match-feedback";
import { ScoreBreakdown } from "@/app/components/matches/score-breakdown";
import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { EligibilitySignal } from "@/app/components/scholarships/eligibility-signal";
import { ApiError } from "@/app/lib/api/errors";
import { createServerApiClient } from "@/app/lib/api/server-client";
import type { MatchResponse } from "@/app/lib/api/client";
import { requireStudentSession } from "@/app/lib/auth/server-session";
import {
  formatConfidence,
  formatMatchTimestamp,
  presentExplanation,
} from "@/app/lib/matches/presentation";
import { formatDate } from "@/app/lib/scholarships/format";

export const metadata: Metadata = {
  title: "Match explanation",
  robots: { index: false, follow: false },
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ scholarshipId: string }>;
}) {
  const { scholarshipId } = await params;
  const { accessToken } = await requireStudentSession(
    `/matches/${scholarshipId}`,
  );
  let match;
  try {
    match = await createServerApiClient(accessToken).getMatch(scholarshipId);
  } catch (error) {
    if (error instanceof ApiError && error.kind === "not_found") notFound();
    return (
      <div className="workspace-page">
        <DataState
          kind="error"
          title="Match explanation could not be loaded"
          description="The ranking may be temporarily unavailable. No match data has been discarded."
          action={<RetryButton />}
        />
      </div>
    );
  }

  const presented = presentExplanation(match);

  return (
    <article className="workspace-page match-detail">
      <Link className="match-detail__back" href="/matches">
        <ArrowLeft aria-hidden="true" />
        Back to ranked matches
      </Link>
      {match.calculation_status === "stale" ? (
        <aside className="match-stale-banner">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>This match needs recalculation</strong>
            <p>
              {match.stale_reasons.join(" ") ||
                "Your profile or the scholarship data changed after this score was calculated."}
            </p>
          </div>
        </aside>
      ) : null}
      <header className="match-detail__hero">
        <div>
          <p className="product-eyebrow">
            Rank #{match.rank} · {match.scholarship.provider}
          </p>
          <h1>{match.scholarship.title}</h1>
          <div className="match-detail__signals">
            <EligibilitySignal status={match.scholarship.eligibility.status} />
            <span>
              <ShieldQuestion aria-hidden="true" />
              Input confidence {formatConfidence(match.confidence)}
            </span>
          </div>
        </div>
        <dl>
          <div>
            <dt>Deadline</dt>
            <dd>{formatDate(match.scholarship.deadline)}</dd>
          </div>
          <div>
            <dt>Calculated</dt>
            <dd>{formatMatchTimestamp(match.calculated_at)}</dd>
          </div>
          <div>
            <dt>Algorithm</dt>
            <dd>{match.algorithm_version}</dd>
          </div>
        </dl>
      </header>

      <ScoreBreakdown match={match} />

      <section
        className="match-explanation"
        aria-labelledby="match-explanation-title"
      >
        <header>
          <div>
            <p className="product-eyebrow">
              {presented.source === "ai"
                ? "AI-assisted explanation"
                : "Deterministic explanation"}
            </p>
            <h2 id="match-explanation-title">How to read this match</h2>
          </div>
          <p>{presented.statusMessage}</p>
        </header>
        <div className="match-explanation__grid">
          <ExplanationGroup
            title="Why this matches"
            icon={<ShieldCheck aria-hidden="true" />}
            items={presented.explanation.why_this_matches}
            empty="No positive fit factors are currently available."
          />
          <ExplanationGroup
            title="What may block you"
            icon={<XCircle aria-hidden="true" />}
            items={presented.explanation.what_may_block_you}
            empty="No blockers are currently identified. Verify every requirement with the provider."
            tone="warning"
          />
          <section className="explanation-group" data-tone="questions">
            <h3>
              <CircleHelp aria-hidden="true" />
              Missing information
            </h3>
            {presented.explanation.missing_information.length ? (
              <ul>
                {presented.explanation.missing_information.map((item) => (
                  <li key={item.field}>
                    <span>{item.question}</span>
                    <Link href="/profile">
                      Resolve in profile <ArrowRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No profile questions are currently unresolved.</p>
            )}
          </section>
          <ExplanationGroup
            title="Next actions"
            icon={<Lightbulb aria-hidden="true" />}
            items={presented.explanation.next_actions}
            empty="Review the scholarship source and confirm current requirements."
          />
        </div>
      </section>

      <RequirementEvidence match={match} />

      <div className="match-detail__links">
        <Link
          className="product-button product-button--accent"
          href={`/scholarships/${match.scholarship.id}`}
        >
          View scholarship details <ArrowRight aria-hidden="true" />
        </Link>
        <a
          className="product-button product-button--quiet"
          href={match.scholarship.source_url}
          target="_blank"
          rel="noreferrer"
        >
          Open provider source <ExternalLink aria-hidden="true" />
        </a>
      </div>
      <MatchFeedback scholarshipId={match.scholarship.id} />
    </article>
  );
}

function ExplanationGroup({
  title,
  icon,
  items,
  empty,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  empty: string;
  tone?: string;
}) {
  return (
    <section className="explanation-group" data-tone={tone}>
      <h3>
        {icon}
        {title}
      </h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

const BASIS = {
  verified_requirement: {
    label: "Verified hard requirement",
    Icon: ShieldCheck,
  },
  inferred_relevance: { label: "Inferred relevance", Icon: Lightbulb },
  profile_unknown: { label: "Unknown profile fact", Icon: CircleHelp },
  requirement_not_met: { label: "Requirement not met", Icon: XCircle },
} as const;

function RequirementEvidence({ match }: { match: MatchResponse }) {
  return (
    <section className="requirement-evidence" aria-labelledby="evidence-title">
      <header>
        <div>
          <p className="product-eyebrow">Evidence and provenance</p>
          <h2 id="evidence-title">Requirements used in this score</h2>
        </div>
        <p>
          Verified requirements are provider facts. Inferred relevance is a
          comparison with your profile, not an eligibility decision.
        </p>
      </header>
      {match.requirement_evidence.length ? (
        <ul>
          {match.requirement_evidence.map((evidence) => {
            const { label, Icon } = BASIS[evidence.basis];
            return (
              <li
                key={`${evidence.label}-${evidence.basis}`}
                data-basis={evidence.basis}
              >
                <span>
                  <Icon aria-hidden="true" />
                  {label}
                </span>
                <strong>{evidence.label}</strong>
                <p>{evidence.detail}</p>
                {evidence.source_url ? (
                  <a
                    href={evidence.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View source <ExternalLink aria-hidden="true" />
                  </a>
                ) : (
                  <small>
                    No direct source link was attached to this evidence.
                  </small>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <DataState
          kind="empty"
          title="No requirement evidence available"
          description="Review the provider source before acting on this score."
          compact
        />
      )}
    </section>
  );
}
