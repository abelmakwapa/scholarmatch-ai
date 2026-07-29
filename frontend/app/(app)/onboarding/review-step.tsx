"use client";

import { Pencil } from "lucide-react";

import { countryName } from "@/app/lib/onboarding/countries";
import type { StepId } from "@/app/lib/onboarding/steps";
import type { Disclosure, OnboardingDraft } from "@/app/lib/onboarding/types";

/** Renders a disclosure answer, keeping unknown / prefer-not-to-say distinct. */
function formatDisclosure<T>(
  disclosure: Disclosure<T> | undefined,
  format: (value: T) => string,
): string {
  if (!disclosure) return "Not answered";
  switch (disclosure.status) {
    case "provided":
      return format(disclosure.value);
    case "unknown":
      return "Unknown";
    case "prefer_not_to_say":
      return "Prefer not to say";
  }
}

const EXPERIENCE_LABELS: Record<string, string> = {
  has: "Has relevant experience",
  none: "None yet",
  unknown: "Not sure",
  prefer_not_to_say: "Prefer not to say",
};

const STUDY_LABELS: Record<string, string> = {
  undergraduate: "Undergraduate",
  postgraduate: "Postgraduate",
  doctoral: "Doctoral",
  other: "Something else",
};

const CONTACT_LABELS: Record<string, string> = {
  email: "Email is fine",
  no_preference: "No preference",
  prefer_not_to_say: "Prefer not to say",
};

type ReviewRow = { term: string; value: string };
type ReviewGroup = { step: StepId; title: string; rows: ReviewRow[] };

function buildGroups(draft: OnboardingDraft): ReviewGroup[] {
  const fieldValue = draft.fieldOfStudyUndecided
    ? "Haven't decided yet"
    : draft.fieldOfStudy?.trim() || "Not answered";

  return [
    {
      step: "identity",
      title: "About you",
      rows: [
        { term: "Full name", value: draft.fullName?.trim() || "Not answered" },
        {
          term: "Preferred name",
          value: draft.preferredName?.trim() || "Not added",
        },
        {
          term: "Pronouns",
          value: formatDisclosure(draft.pronouns, (value) => value),
        },
      ],
    },
    {
      step: "location",
      title: "Location",
      rows: [
        {
          term: "Country of residence",
          value: draft.countryOfResidence
            ? (countryName(draft.countryOfResidence) ??
              draft.countryOfResidence)
            : "Not answered",
        },
        {
          term: "Nationality",
          value: formatDisclosure(
            draft.nationality,
            (value) => countryName(value) ?? value,
          ),
        },
      ],
    },
    {
      step: "education",
      title: "Study level",
      rows: [
        {
          term: "Level",
          value: draft.studyLevel
            ? STUDY_LABELS[draft.studyLevel]
            : "Not answered",
        },
      ],
    },
    {
      step: "field",
      title: "Field of study",
      rows: [{ term: "Field", value: fieldValue }],
    },
    {
      step: "results",
      title: "Academic results",
      rows: [
        {
          term: "GPA",
          value: formatDisclosure(draft.gpa, (value) => value.toFixed(1)),
        },
        ...(draft.gradingScaleNote?.trim()
          ? [{ term: "Scale note", value: draft.gradingScaleNote.trim() }]
          : []),
      ],
    },
    {
      step: "goals",
      title: "Goals & interests",
      rows: [
        {
          term: "Interests",
          value: (draft.interests ?? []).join(", ") || "Not answered",
        },
        { term: "Goals", value: draft.goals?.trim() || "Not added" },
      ],
    },
    {
      step: "experience",
      title: "Experience",
      rows: [
        {
          term: "Experience",
          value: draft.experienceStatus
            ? EXPERIENCE_LABELS[draft.experienceStatus]
            : "Not answered",
        },
        ...(draft.experienceStatus === "has" && draft.experienceSummary?.trim()
          ? [{ term: "Summary", value: draft.experienceSummary.trim() }]
          : []),
      ],
    },
    {
      step: "preferences",
      title: "Support & preferences",
      rows: [
        {
          term: "Accommodations",
          value: formatDisclosure(draft.accommodations, (value) => value),
        },
        {
          term: "Contact",
          value: draft.contactPreference
            ? CONTACT_LABELS[draft.contactPreference]
            : "Not added",
        },
      ],
    },
  ];
}

type ReviewStepProps = {
  draft: OnboardingDraft;
  onEdit: (step: StepId) => void;
};

export function ReviewStep({ draft, onEdit }: ReviewStepProps) {
  const groups = buildGroups(draft);
  return (
    <div className="review">
      <p className="review__note">
        Only the fields the scholarship service can use are sent when you
        submit. Nationality, experience, and support preferences are kept in
        your account to improve future checks.
      </p>
      {groups.map((group) => (
        <section className="review__group" key={group.step}>
          <div className="review__group-head">
            <h3>{group.title}</h3>
            <button
              type="button"
              className="review__edit"
              onClick={() => onEdit(group.step)}
            >
              <Pencil aria-hidden="true" size={14} />
              <span>
                Edit<span className="sr-only"> {group.title}</span>
              </span>
            </button>
          </div>
          <dl className="review__list">
            {group.rows.map((row) => (
              <div className="review__row" key={row.term}>
                <dt>{row.term}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export { buildGroups };
