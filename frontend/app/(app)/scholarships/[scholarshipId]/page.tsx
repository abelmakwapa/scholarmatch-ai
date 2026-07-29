import {
  CalendarDays,
  ExternalLink,
  FileCheck2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { EligibilitySignal } from "@/app/components/scholarships/eligibility-signal";
import { ScholarshipActions } from "@/app/components/scholarships/scholarship-actions";
import { ScholarshipCard } from "@/app/components/scholarships/scholarship-card";
import { ApiError } from "@/app/lib/api/errors";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireStudentSession } from "@/app/lib/auth/server-session";
import {
  deadlineState,
  formatDate,
  formatFunding,
  titleCase,
} from "@/app/lib/scholarships/format";

export const metadata: Metadata = {
  title: "Scholarship details",
  robots: { index: false, follow: false },
};

export default async function ScholarshipDetailPage({
  params,
}: {
  params: Promise<{ scholarshipId: string }>;
}) {
  const { scholarshipId } = await params;
  const { accessToken } = await requireStudentSession(
    `/scholarships/${scholarshipId}`,
  );
  const api = createServerApiClient(accessToken);
  let scholarship;
  try {
    scholarship = await api.getScholarship(scholarshipId);
  } catch (error) {
    if (error instanceof ApiError && error.kind === "not_found") notFound();
    return (
      <div className="workspace-page">
        <DataState
          kind="error"
          title="Scholarship details could not be loaded"
          description="The record may be temporarily unavailable."
          action={<RetryButton />}
        />
      </div>
    );
  }
  const related = await api
    .listRelatedScholarships(scholarshipId, { limit: 3 })
    .catch(() => null);
  const deadline = deadlineState(scholarship.deadline, scholarship.status);

  return (
    <article className="workspace-page scholarship-detail">
      <nav className="scholarship-breadcrumb" aria-label="Breadcrumb">
        <Link href="/scholarships">Scholarships</Link>
        <span aria-hidden="true">/</span>
        <span>Details</span>
      </nav>
      <header className="scholarship-detail__hero">
        <div>
          <p className="product-eyebrow">{scholarship.provider}</p>
          <h1>{scholarship.title}</h1>
          <EligibilitySignal status={scholarship.eligibility.status} />
        </div>
        <dl className="scholarship-detail__summary">
          <div>
            <dt>Funding</dt>
            <dd>{formatFunding(scholarship)}</dd>
          </div>
          <div>
            <dt>
              <CalendarDays aria-hidden="true" /> Deadline
            </dt>
            <dd data-expired={deadline === "expired"}>
              {formatDate(scholarship.deadline)}
              {deadline === "expired" ? " — closed" : ""}
            </dd>
          </div>
          <div>
            <dt>
              <ShieldCheck aria-hidden="true" /> Verified
            </dt>
            <dd>
              {scholarship.verified_at
                ? formatDate(scholarship.verified_at)
                : "Not yet verified"}
            </dd>
          </div>
        </dl>
      </header>
      <ScholarshipActions
        scholarship={scholarship}
        actionable={
          scholarship.status === "published" && deadline !== "expired"
        }
      />
      <div className="scholarship-detail__layout">
        <div className="scholarship-detail__content">
          <section>
            <h2>About this scholarship</h2>
            <p>
              {scholarship.description ||
                "The provider has not published a detailed description."}
            </p>
          </section>
          <section>
            <h2>Your eligibility signal</h2>
            <p>{scholarship.eligibility.summary}</p>
            {scholarship.eligibility.reasons.length ? (
              <List items={scholarship.eligibility.reasons} />
            ) : null}
            {scholarship.eligibility.missing_facts.length ? (
              <>
                <h3>Profile facts still needed</h3>
                <List items={scholarship.eligibility.missing_facts} />
              </>
            ) : null}
            <p className="scholarship-detail__caveat">
              This assessment compares your profile with published requirements.
              The provider makes the final decision.
            </p>
          </section>
          <section>
            <h2>Requirements</h2>
            {scholarship.requirements.length ? (
              <List items={scholarship.requirements} />
            ) : (
              <p>
                No structured requirements are available. Check the source
                before applying.
              </p>
            )}
          </section>
          <section>
            <h2>Required documents</h2>
            {scholarship.required_documents.length ? (
              <List items={scholarship.required_documents} />
            ) : (
              <p>No document list has been published in the catalogue.</p>
            )}
          </section>
        </div>
        <aside
          className="scholarship-detail__aside"
          aria-label="Scholarship facts and source"
        >
          <section>
            <h2>Opportunity facts</h2>
            <dl>
              <Fact label="Provider" value={scholarship.provider} />
              <Fact
                label="Study level"
                value={
                  scholarship.study_levels.map(titleCase).join(", ") ||
                  "Not specified"
                }
              />
              <Fact
                label="Fields"
                value={
                  scholarship.fields_of_study.join(", ") ||
                  "Any or not specified"
                }
              />
              <Fact
                label="Destination"
                value={
                  scholarship.destination_countries.join(", ") ||
                  "Not specified"
                }
                icon={<MapPin aria-hidden="true" />}
              />
              <Fact
                label="Nationality"
                value={
                  scholarship.nationality_requirements.join(", ") ||
                  "Not specified"
                }
              />
              <Fact
                label="Residency"
                value={
                  scholarship.residency_requirements.join(", ") ||
                  "Not specified"
                }
              />
            </dl>
          </section>
          <section>
            <h2>Source and provenance</h2>
            <a
              className="scholarship-source"
              href={scholarship.source_url}
              target="_blank"
              rel="noreferrer"
            >
              Open provider source <ExternalLink aria-hidden="true" />
            </a>
            <dl>
              <Fact label="Source" value={scholarship.provenance.source_name} />
              <Fact
                label="Imported"
                value={formatDate(scholarship.provenance.ingested_at)}
              />
              <Fact
                label="Last checked"
                value={formatDate(scholarship.provenance.last_checked_at)}
              />
            </dl>
            <p>
              ScholarMatch preserves the original source so you can verify
              details directly.
            </p>
          </section>
        </aside>
      </div>
      <section className="scholarship-related" aria-labelledby="related-title">
        <header>
          <p className="product-eyebrow">From the live catalogue</p>
          <h2 id="related-title">Related scholarships</h2>
        </header>
        {related === null ? (
          <DataState
            kind="error"
            title="Related scholarships unavailable"
            description="The main scholarship details are unaffected."
            compact
          />
        ) : related.data.length ? (
          <div className="scholarship-grid">
            {related.data.map((item) => (
              <ScholarshipCard key={item.id} scholarship={item} />
            ))}
          </div>
        ) : (
          <DataState
            kind="empty"
            title="No related scholarships yet"
            description="There are no related published results in the current catalogue."
            compact
          />
        )}
      </section>
    </article>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="scholarship-detail__list">
      {items.map((item) => (
        <li key={item}>
          <FileCheck2 aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}
function Fact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
