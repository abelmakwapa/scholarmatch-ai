import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";

import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import type { DashboardLoadState } from "@/app/lib/dashboard/server";

export function DashboardView({ state }: { state: DashboardLoadState }) {
  if (state.kind === "error") {
    return (
      <div className="workspace-page">
        <DataState
          kind="error"
          title="Your dashboard isn’t available"
          description={state.message}
          action={<RetryButton />}
        />
      </div>
    );
  }

  if (state.kind === "first-use") {
    return (
      <div className="workspace-page">
        <DataState
          kind="empty"
          title="Build your matching profile"
          description="Add the facts ScholarMatch needs to check requirements and explain recommendations. You can review every answer before saving."
          action={
            <Link
              className="product-button product-button--accent"
              href="/onboarding"
            >
              Start profile
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          }
        />
      </div>
    );
  }

  const { view } = state;
  const firstName = view.profile.full_name.trim().split(/\s+/)[0] || "there";
  const applicationsTotal = Object.values(view.applicationCounts).reduce(
    (total, count) => total + count,
    0,
  );

  return (
    <div className="workspace-page dashboard-view">
      <header className="workspace-page__header dashboard-greeting">
        <div>
          <p className="product-eyebrow">Dashboard</p>
          <h1>Good to see you, {firstName}.</h1>
          <p>
            Your live priorities, based on the profile and activity available
            now.
          </p>
        </div>
        <p className="dashboard-greeting__freshness">
          Profile updated{" "}
          <time dateTime={view.profile.updated_at}>
            {formatRelativeDate(view.profile.updated_at)}
          </time>
        </p>
      </header>

      <section className="next-action" aria-labelledby="next-action-title">
        <div className="next-action__icon" aria-hidden="true">
          <ArrowRight />
        </div>
        <div>
          <p className="product-eyebrow">{view.nextAction.eyebrow}</p>
          <h2 id="next-action-title">{view.nextAction.title}</h2>
          <p>{view.nextAction.description}</p>
        </div>
        <Link
          className="product-button product-button--accent"
          href={view.nextAction.href}
        >
          {view.nextAction.label}
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </section>

      <section className="dashboard-metrics" aria-label="Account summary">
        <article>
          <span
            className="metric-icon metric-icon--lavender"
            aria-hidden="true"
          >
            <UserRoundCheck />
          </span>
          <div>
            <strong>{view.completeness.percent}%</strong>
            <span>Profile complete</span>
          </div>
        </article>
        <article>
          <span className="metric-icon metric-icon--amber" aria-hidden="true">
            <CalendarClock />
          </span>
          <div>
            <strong>{view.urgentDeadlines.length}</strong>
            <span>Deadlines within 30 days</span>
          </div>
        </article>
        <article>
          <span className="metric-icon metric-icon--mint" aria-hidden="true">
            <Sparkles />
          </span>
          <div>
            <strong>{view.recentMatches.length}</strong>
            <span>Matches calculated in 14 days</span>
          </div>
        </article>
        <article>
          <span className="metric-icon" aria-hidden="true">
            <CheckCircle2 />
          </span>
          <div>
            <strong>{applicationsTotal}</strong>
            <span>Tracked applications</span>
          </div>
        </article>
      </section>

      <div className="dashboard-columns">
        <section className="product-section" aria-labelledby="deadlines-title">
          <div className="product-section__head">
            <div>
              <p className="product-eyebrow">Time-sensitive</p>
              <h2 id="deadlines-title">Urgent deadlines</h2>
            </div>
            <Link href="/applications">All applications</Link>
          </div>
          {view.unavailableSources.includes("matches") ? (
            <InlineDataError label="Deadline data is temporarily unavailable." />
          ) : view.urgentDeadlines.length === 0 ? (
            <InlineEmpty
              title="No urgent deadlines"
              description="No active match currently has a confirmed deadline within the next 30 days."
            />
          ) : (
            <ul className="deadline-list">
              {view.urgentDeadlines.slice(0, 4).map((deadline) => (
                <li key={deadline.scholarshipId}>
                  <span
                    className="deadline-list__date"
                    data-urgent={deadline.daysRemaining <= 7 || undefined}
                  >
                    <strong>
                      {deadline.daysRemaining === 0
                        ? "Today"
                        : deadline.daysRemaining}
                    </strong>
                    <small>
                      {deadline.daysRemaining === 0 ? "Due" : "days"}
                    </small>
                  </span>
                  <span className="deadline-list__copy">
                    <strong>{deadline.title}</strong>
                    <small>
                      {deadline.provider} · {formatDate(deadline.deadline)}
                    </small>
                  </span>
                  <span
                    className="status-pill"
                    data-status={deadline.applicationStatus ?? "not-started"}
                  >
                    {deadline.applicationStatus
                      ? formatStatus(deadline.applicationStatus)
                      : "Not started"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="product-section" aria-labelledby="matches-title">
          <div className="product-section__head">
            <div>
              <p className="product-eyebrow">Latest activity</p>
              <h2 id="matches-title">New and updated matches</h2>
            </div>
            <Link href="/matches">All matches</Link>
          </div>
          {view.unavailableSources.includes("matches") ? (
            <InlineDataError label="Match activity is temporarily unavailable." />
          ) : view.recentMatches.length === 0 ? (
            <InlineEmpty
              title="No recent match activity"
              description="There are no matches calculated in the last 14 days."
            />
          ) : (
            <ul className="match-activity-list">
              {view.recentMatches.slice(0, 4).map((match) => (
                <li key={match.id}>
                  <span
                    className="match-score"
                    aria-label={`Match score ${Math.round(match.score * 100)} percent`}
                  >
                    {Math.round(match.score * 100)}
                  </span>
                  <span>
                    <strong>{match.scholarship.title}</strong>
                    <small>
                      {match.scholarship.provider} · calculated{" "}
                      {formatRelativeDate(match.calculated_at)}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dashboard-columns dashboard-columns--lower">
        <section
          className="product-section"
          aria-labelledby="applications-title"
        >
          <div className="product-section__head">
            <div>
              <p className="product-eyebrow">Application progress</p>
              <h2 id="applications-title">Your pipeline</h2>
            </div>
          </div>
          {view.unavailableSources.includes("applications") ? (
            <InlineDataError label="Application progress is temporarily unavailable." />
          ) : applicationsTotal === 0 ? (
            <InlineEmpty
              title="No applications tracked"
              description="Save or start an application and its progress will appear here."
            />
          ) : (
            <dl className="application-summary">
              {(["saved", "preparing", "submitted"] as const).map((status) => (
                <div key={status}>
                  <dt>
                    <CircleDot aria-hidden="true" size={14} />
                    {formatStatus(status)}
                  </dt>
                  <dd>{view.applicationCounts[status]}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="confidence-note" aria-labelledby="confidence-title">
          <Sparkles aria-hidden="true" />
          <div>
            <h2 id="confidence-title">How completeness affects confidence</h2>
            <p>
              ScholarMatch can compare more requirements when more relevant
              facts are current. Missing facts are treated as unknown—not as
              proof that you are eligible or ineligible—and no completeness
              score guarantees eligibility.
            </p>
            <Link href="/profile">
              Review profile facts <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function InlineEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="inline-state">
      <Clock3 aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function InlineDataError({ label }: { label: string }) {
  return (
    <div className="inline-state inline-state--error" role="status">
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <p>Refresh the dashboard to try this section again.</p>
      </div>
    </div>
  );
}

function formatStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatRelativeDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
