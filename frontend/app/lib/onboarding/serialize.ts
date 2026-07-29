import type { ProfileWrite } from "@/app/lib/api/client";
import { isProvided, type OnboardingDraft } from "@/app/lib/onboarding/types";

/**
 * Maps a completed onboarding draft onto the strict `ProfileWrite` contract.
 *
 * The contract has `additionalProperties: false`, so fields it does not model —
 * nationality, experience, accessibility, pronouns — are intentionally omitted
 * here and preserved only in the draft/user metadata. "Unknown" and "prefer not
 * to say" both serialize to `null`, because the wire contract cannot represent
 * the distinction; the distinction survives in the retained draft.
 */
export function draftToProfileWrite(draft: OnboardingDraft): ProfileWrite {
  const fullName = draft.fullName?.trim();
  const country = draft.countryOfResidence?.toUpperCase();
  const studyLevel = draft.studyLevel;

  if (!fullName || !country || !studyLevel) {
    throw new Error(
      "Cannot submit an incomplete profile: name, country, and study level are required.",
    );
  }

  let fieldOfStudy: string | null = null;
  if (!draft.fieldOfStudyUndecided) {
    const trimmed = draft.fieldOfStudy?.trim();
    fieldOfStudy = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  const gpa = isProvided(draft.gpa) ? draft.gpa.value : null;

  const goalsTrimmed = draft.goals?.trim();
  const goals = goalsTrimmed && goalsTrimmed.length > 0 ? goalsTrimmed : null;

  const interests = (draft.interests ?? [])
    .map((interest) => interest.trim())
    .filter((interest) => interest.length > 0);

  return {
    full_name: fullName,
    country,
    study_level: studyLevel,
    field_of_study: fieldOfStudy,
    gpa,
    interests,
    goals,
  };
}
