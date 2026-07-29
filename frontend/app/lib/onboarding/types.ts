/**
 * Onboarding data model.
 *
 * A guiding rule of this flow: "unknown" and "prefer not to say" are first-class
 * answers that must never collapse into a negative answer or an empty value.
 * Sensitive and optional fields therefore use an explicit {@link Disclosure}
 * discriminated union instead of a bare value-or-null.
 */

/** How a student chose to answer a sensitive or optional question. */
export type DisclosureStatus =
  | "provided" // the student gave a concrete value
  | "unknown" // the student genuinely does not know it yet
  | "prefer_not_to_say"; // the student declines to share it

export type Disclosure<T> =
  | { status: "provided"; value: T }
  | { status: "unknown" }
  | { status: "prefer_not_to_say" };

export function provided<T>(value: T): Disclosure<T> {
  return { status: "provided", value };
}

export const UNKNOWN = { status: "unknown" } as const;
export const PREFER_NOT_TO_SAY = { status: "prefer_not_to_say" } as const;

export function isProvided<T>(
  disclosure: Disclosure<T> | undefined,
): disclosure is { status: "provided"; value: T } {
  return disclosure?.status === "provided";
}

export type StudyLevel =
  | "undergraduate"
  | "postgraduate"
  | "doctoral"
  | "other";

/**
 * Whether a student has relevant experience. `none` is a real, negative answer
 * and is intentionally distinct from `unknown` / `prefer_not_to_say`.
 */
export type ExperienceStatus = "has" | "none" | "unknown" | "prefer_not_to_say";

/** The complete draft. Every field is optional so a partial draft can resume. */
export type OnboardingDraft = {
  /** The student has read and accepted the data & privacy notice. */
  consentAccepted?: boolean;
  consentAcceptedAt?: string;

  // Identity
  fullName?: string;
  preferredName?: string;
  pronouns?: Disclosure<string>;

  // Location & nationality
  countryOfResidence?: string; // ISO 3166-1 alpha-2
  nationality?: Disclosure<string>; // ISO 3166-1 alpha-2

  // Education level
  studyLevel?: StudyLevel;

  // Field of study — `undecided` is a real answer, not a refusal.
  fieldOfStudy?: string;
  fieldOfStudyUndecided?: boolean;

  // Academic results
  gpa?: Disclosure<number>;
  gradingScaleNote?: string;

  // Goals & interests
  goals?: string;
  interests?: string[];

  // Experience
  experienceStatus?: ExperienceStatus;
  experienceSummary?: string;

  // Accessibility & preferences (optional, sensitive)
  accommodations?: Disclosure<string>;
  contactPreference?: "email" | "no_preference" | "prefer_not_to_say";
};

/** Persisted alongside the draft so resume lands on the right step. */
export type OnboardingProgress = {
  draft: OnboardingDraft;
  /** Id of the furthest step the student has completed. */
  lastCompletedStep: string | null;
  updatedAt: string;
  /** Schema version, so future migrations can detect old drafts. */
  version: 1;
};

export const ONBOARDING_VERSION = 1 as const;
