import { isValidCountryCode } from "@/app/lib/onboarding/countries";
import type { OnboardingDraft } from "@/app/lib/onboarding/types";

export type FieldErrors = Record<string, string>;

const STUDY_LEVELS = new Set([
  "undergraduate",
  "postgraduate",
  "doctoral",
  "other",
]);

const EXPERIENCE_STATUSES = new Set([
  "has",
  "none",
  "unknown",
  "prefer_not_to_say",
]);

/** Validators for each step id. Each returns an empty object when the step is valid. */
export const STEP_VALIDATORS: Record<
  string,
  (draft: OnboardingDraft) => FieldErrors
> = {
  consent(draft) {
    const errors: FieldErrors = {};
    if (draft.consentAccepted !== true) {
      errors.consentAccepted =
        "Please confirm you understand how your information is used to continue.";
    }
    return errors;
  },

  identity(draft) {
    const errors: FieldErrors = {};
    const name = draft.fullName?.trim() ?? "";
    if (name.length === 0) {
      errors.fullName =
        "Enter your full name so providers can identify your application.";
    } else if (name.length > 200) {
      errors.fullName = "Name must be 200 characters or fewer.";
    }
    if ((draft.preferredName?.length ?? 0) > 200) {
      errors.preferredName = "Preferred name must be 200 characters or fewer.";
    }
    if (draft.pronouns?.status === "provided") {
      const value = draft.pronouns.value.trim();
      if (value.length === 0) {
        errors.pronouns =
          "Enter your pronouns, or choose to skip this question.";
      } else if (value.length > 100) {
        errors.pronouns = "Pronouns must be 100 characters or fewer.";
      }
    }
    return errors;
  },

  location(draft) {
    const errors: FieldErrors = {};
    const country = draft.countryOfResidence ?? "";
    if (country.length === 0) {
      errors.countryOfResidence = "Select your country of residence.";
    } else if (!isValidCountryCode(country)) {
      errors.countryOfResidence = "Choose a country from the list.";
    }
    if (
      draft.nationality?.status === "provided" &&
      !isValidCountryCode(draft.nationality.value)
    ) {
      errors.nationality = "Choose a nationality from the list.";
    }
    return errors;
  },

  education(draft) {
    const errors: FieldErrors = {};
    if (!draft.studyLevel || !STUDY_LEVELS.has(draft.studyLevel)) {
      errors.studyLevel =
        "Select the level you are studying at or applying for.";
    }
    return errors;
  },

  field(draft) {
    const errors: FieldErrors = {};
    if (draft.fieldOfStudyUndecided) {
      return errors;
    }
    if ((draft.fieldOfStudy?.length ?? 0) > 200) {
      errors.fieldOfStudy = "Field of study must be 200 characters or fewer.";
    }
    return errors;
  },

  results(draft) {
    const errors: FieldErrors = {};
    if (!draft.gpa) {
      errors.gpa =
        "Choose one option — enter your GPA, or tell us it's unknown or private.";
      return errors;
    }
    if (draft.gpa.status === "provided") {
      const value = draft.gpa.value;
      if (!Number.isFinite(value) || value < 0 || value > 4) {
        errors.gpa = "Enter a GPA between 0.0 and 4.0.";
      }
    }
    if ((draft.gradingScaleNote?.length ?? 0) > 200) {
      errors.gradingScaleNote = "Note must be 200 characters or fewer.";
    }
    return errors;
  },

  goals(draft) {
    const errors: FieldErrors = {};
    const interests = draft.interests ?? [];
    if (interests.length === 0) {
      errors.interests =
        "Add at least one interest so we can match your goals.";
    } else if (interests.length > 50) {
      errors.interests = "Add up to 50 interests.";
    } else if (interests.some((interest) => interest.length > 100)) {
      errors.interests = "Each interest must be 100 characters or fewer.";
    }
    if ((draft.goals?.length ?? 0) > 4000) {
      errors.goals = "Goals must be 4000 characters or fewer.";
    }
    return errors;
  },

  experience(draft) {
    const errors: FieldErrors = {};
    if (
      !draft.experienceStatus ||
      !EXPERIENCE_STATUSES.has(draft.experienceStatus)
    ) {
      errors.experienceStatus =
        "Choose the option that best describes your experience.";
    }
    if ((draft.experienceSummary?.length ?? 0) > 2000) {
      errors.experienceSummary = "Summary must be 2000 characters or fewer.";
    }
    return errors;
  },

  preferences(draft) {
    const errors: FieldErrors = {};
    if (
      draft.accommodations?.status === "provided" &&
      draft.accommodations.value.trim().length === 0
    ) {
      errors.accommodations =
        "Describe the support you'd like, or choose to skip this question.";
    }
    if (
      (draft.accommodations?.status === "provided"
        ? draft.accommodations.value.length
        : 0) > 2000
    ) {
      errors.accommodations = "Please keep this under 2000 characters.";
    }
    return errors;
  },
};

/** Runs the validator for one step, returning field-level errors. */
export function validateStep(
  stepId: string,
  draft: OnboardingDraft,
): FieldErrors {
  const validator = STEP_VALIDATORS[stepId];
  return validator ? validator(draft) : {};
}

export function isStepValid(stepId: string, draft: OnboardingDraft): boolean {
  return Object.keys(validateStep(stepId, draft)).length === 0;
}
