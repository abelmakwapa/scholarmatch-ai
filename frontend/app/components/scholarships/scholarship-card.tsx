"use client";

import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EligibilitySignal } from "@/app/components/scholarships/eligibility-signal";
import type { ScholarshipResponse } from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import {
  deadlineState,
  formatDate,
  formatFunding,
} from "@/app/lib/scholarships/format";

export function ScholarshipCard({
  scholarship,
  onSave,
}: {
  scholarship: ScholarshipResponse;
  onSave?: (saved: boolean) => Promise<void>;
}) {
  const [saved, setSaved] = useState(scholarship.saved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const deadline = deadlineState(scholarship.deadline, scholarship.status);

  async function toggleSaved() {
    const next = !saved;
    setPending(true);
    setError("");
    try {
      if (onSave) await onSave(next);
      else
        await createBrowserApiClient().setScholarshipSaved(
          scholarship.id,
          next,
        );
      setSaved(next);
    } catch {
      setError("Could not update saved state. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="scholarship-card">
      <div className="scholarship-card__topline">
        <EligibilitySignal status={scholarship.eligibility.status} compact />
        <button
          type="button"
          className="scholarship-save"
          aria-pressed={saved}
          aria-label={
            saved
              ? `Remove ${scholarship.title} from saved scholarships`
              : `Save ${scholarship.title}`
          }
          onClick={toggleSaved}
          disabled={pending}
        >
          {saved ? (
            <BookmarkCheck aria-hidden="true" />
          ) : (
            <Bookmark aria-hidden="true" />
          )}
          <span>{saved ? "Saved" : "Save"}</span>
        </button>
      </div>
      <div>
        <p className="product-eyebrow">{scholarship.provider}</p>
        <h2>
          <Link href={`/scholarships/${scholarship.id}`} prefetch={false}>
            {scholarship.title}
          </Link>
        </h2>
      </div>
      <dl className="scholarship-card__facts">
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
          <dt>Verified</dt>
          <dd>
            {scholarship.verified_at
              ? formatDate(scholarship.verified_at)
              : "Not yet verified"}
          </dd>
        </div>
      </dl>
      <p className="scholarship-card__explanation">
        {scholarship.eligibility.summary}
      </p>
      <Link
        className="scholarship-card__link"
        href={`/scholarships/${scholarship.id}`}
        prefetch={false}
      >
        View details <ExternalLink aria-hidden="true" />
      </Link>
      {error ? (
        <p className="scholarship-action-error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
