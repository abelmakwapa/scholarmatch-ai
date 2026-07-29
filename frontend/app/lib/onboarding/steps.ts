import type { OnboardingDraft } from "@/app/lib/onboarding/types";
import { validateStep } from "@/app/lib/onboarding/validation";

export type StepId =
  | "consent"
  | "identity"
  | "location"
  | "education"
  | "field"
  | "results"
  | "goals"
  | "experience"
  | "preferences"
  | "review";

export type StepMeta = {
  id: StepId;
  /** Short label for the progress indicator. */
  label: string;
  /** Question-group heading shown at the top of the step. */
  title: string;
  /** Plain-language explanation of what and why. */
  help: string;
  /** True for steps that collect sensitive data (drives consent copy). */
  sensitive: boolean;
  /** True when the whole step can be skipped without any answer. */
  optional: boolean;
};

/**
 * The ordered wizard. `consent` gates all sensitive collection; `review` is the
 * final confirm-and-submit screen and collects nothing new.
 */
export const STEPS: readonly StepMeta[] = [
  {
    id: "consent",
    label: "Privacy",
    title: "Before we begin",
    help: "We use your answers only to check scholarship eligibility and explain your matches. You control what you share, and you can edit or delete it later.",
    sensitive: false,
    optional: false,
  },
  {
    id: "identity",
    label: "You",
    title: "What should we call you?",
    help: "Your name appears on applications you choose to start. Pronouns are optional and never affect matching.",
    sensitive: false,
    optional: false,
  },
  {
    id: "location",
    label: "Location",
    title: "Where are you based?",
    help: "Many scholarships are limited to residents or nationals of certain countries. Nationality is optional and helps widen the checks we can run for you.",
    sensitive: true,
    optional: false,
  },
  {
    id: "education",
    label: "Level",
    title: "What level are you studying at?",
    help: "Eligibility usually depends on your current or intended study level.",
    sensitive: false,
    optional: false,
  },
  {
    id: "field",
    label: "Field",
    title: "What do you want to study?",
    help: "Field-specific awards match on subject area. It's fine to be undecided.",
    sensitive: false,
    optional: true,
  },
  {
    id: "results",
    label: "Results",
    title: "Your academic results",
    help: "Some awards set a minimum GPA. Sharing yours is optional — an unknown or private result never counts against you.",
    sensitive: true,
    optional: false,
  },
  {
    id: "goals",
    label: "Goals",
    title: "Your goals and interests",
    help: "Interests power semantic matching beyond hard eligibility rules.",
    sensitive: false,
    optional: false,
  },
  {
    id: "experience",
    label: "Experience",
    title: "Relevant experience",
    help: "Work, research, volunteering, or leadership can unlock specific awards. Telling us you have none is a valid answer.",
    sensitive: true,
    optional: false,
  },
  {
    id: "preferences",
    label: "Support",
    title: "Accessibility & preferences",
    help: "Optional. If you'd like accommodations or have a contact preference, share it here. This is sensitive information and is never used for matching.",
    sensitive: true,
    optional: true,
  },
  {
    id: "review",
    label: "Review",
    title: "Review and submit",
    help: "Check everything looks right. You can go back to any step to change an answer.",
    sensitive: false,
    optional: false,
  },
];

export const STEP_ORDER: readonly StepId[] = STEPS.map((step) => step.id);

/** Steps that count toward the visible progress indicator (excludes review). */
export const PROGRESS_STEPS = STEPS.filter((step) => step.id !== "review");

export function stepIndex(id: StepId): number {
  return STEP_ORDER.indexOf(id);
}

export function stepMeta(id: StepId): StepMeta {
  const meta = STEPS.find((step) => step.id === id);
  if (!meta) {
    throw new Error(`Unknown onboarding step: ${id}`);
  }
  return meta;
}

export function isStepId(value: string): value is StepId {
  return STEP_ORDER.includes(value as StepId);
}

/**
 * The furthest step a draft may resume to: the first step that is not yet
 * valid, or `review` when every data step is complete.
 */
export function firstIncompleteStep(draft: OnboardingDraft): StepId {
  for (const step of STEPS) {
    if (step.id === "review") {
      return "review";
    }
    if (step.optional) {
      continue;
    }
    if (Object.keys(validateStep(step.id, draft)).length > 0) {
      return step.id;
    }
  }
  return "review";
}
