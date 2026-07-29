"use client";

import { ShieldCheck } from "lucide-react";

import { CheckboxField } from "@/app/components/forms/checkbox-field";
import { DisclosureField } from "@/app/components/forms/disclosure-field";
import { RadioGroupField } from "@/app/components/forms/radio-group-field";
import { SelectField } from "@/app/components/forms/select-field";
import { TagField } from "@/app/components/forms/tag-field";
import { TextAreaField } from "@/app/components/forms/textarea-field";
import { TextField } from "@/app/components/forms/text-field";
import { COUNTRIES } from "@/app/lib/onboarding/countries";
import type { FieldErrors } from "@/app/lib/onboarding/validation";
import type {
  ExperienceStatus,
  OnboardingDraft,
  StudyLevel,
} from "@/app/lib/onboarding/types";

export type StepViewProps = {
  draft: OnboardingDraft;
  errors: FieldErrors;
  update: (patch: Partial<OnboardingDraft>) => void;
};

const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({
  value: country.code,
  label: country.name,
}));

const STUDY_LEVEL_OPTIONS: {
  value: StudyLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "undergraduate",
    label: "Undergraduate",
    description: "Bachelor's degree or equivalent.",
  },
  {
    value: "postgraduate",
    label: "Postgraduate",
    description: "Master's degree or equivalent.",
  },
  {
    value: "doctoral",
    label: "Doctoral",
    description: "PhD or other doctoral research.",
  },
  {
    value: "other",
    label: "Something else",
    description: "Foundation, diploma, professional, or not listed.",
  },
];

const EXPERIENCE_OPTIONS: {
  value: ExperienceStatus;
  label: string;
  description: string;
}[] = [
  {
    value: "has",
    label: "Yes, I have relevant experience",
    description: "Work, research, volunteering, or leadership.",
  },
  {
    value: "none",
    label: "No, not yet",
    description: "A valid answer — some awards are aimed at fresh starters.",
  },
  {
    value: "unknown",
    label: "I'm not sure",
    description: "We'll treat this as undecided, not as a no.",
  },
  {
    value: "prefer_not_to_say",
    label: "Prefer not to say",
    description: "We won't hold this against your eligibility.",
  },
];

export function ConsentStep({ draft, errors, update }: StepViewProps) {
  return (
    <div className="onboarding-consent">
      <div className="onboarding-consent__panel">
        <span className="onboarding-consent__icon" aria-hidden="true">
          <ShieldCheck size={20} />
        </span>
        <ul>
          <li>
            <strong>Why we ask.</strong> Scholarships set eligibility rules —
            country, study level, field, results. Your answers let us check
            those rules and explain each match.
          </li>
          <li>
            <strong>You stay in control.</strong> Most questions are optional.
            &ldquo;Unknown&rdquo; and &ldquo;prefer not to say&rdquo; are always
            valid and never count against you.
          </li>
          <li>
            <strong>Your data.</strong> We store your profile to power matching
            only. You can review, change, or delete it at any time.
          </li>
        </ul>
      </div>
      <CheckboxField
        label="I understand how my information is used and want to continue."
        checked={draft.consentAccepted ?? false}
        onCheckedChange={(checked) =>
          update({
            consentAccepted: checked,
            consentAcceptedAt: checked ? new Date().toISOString() : undefined,
          })
        }
        error={errors.consentAccepted}
      />
    </div>
  );
}

export function IdentityStep({ draft, errors, update }: StepViewProps) {
  return (
    <>
      <TextField
        label="Full name"
        autoComplete="name"
        value={draft.fullName ?? ""}
        onValueChange={(value) => update({ fullName: value })}
        error={errors.fullName}
        required
      />
      <TextField
        label="Preferred name"
        hint="Optional"
        help="What you'd like to be called, if different from your full name."
        value={draft.preferredName ?? ""}
        onValueChange={(value) => update({ preferredName: value })}
        error={errors.preferredName}
      />
      <DisclosureField
        legend="Pronouns"
        help="Optional, and never used for matching."
        value={draft.pronouns}
        onChange={(pronouns) => update({ pronouns })}
        provideLabel="Add my pronouns"
        error={errors.pronouns}
      >
        {({ value, setValue, describedBy, invalid }) => (
          <input
            className="field__input"
            aria-label="Your pronouns"
            placeholder="e.g. she/her, they/them"
            value={value ?? ""}
            onChange={(event) => setValue(event.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          />
        )}
      </DisclosureField>
    </>
  );
}

export function LocationStep({ draft, errors, update }: StepViewProps) {
  return (
    <>
      <SelectField
        label="Country of residence"
        help="Where you currently live. Many awards are limited by residency."
        placeholder="Select a country"
        options={COUNTRY_OPTIONS}
        value={draft.countryOfResidence ?? ""}
        onValueChange={(value) => update({ countryOfResidence: value })}
        error={errors.countryOfResidence}
        required
      />
      <DisclosureField
        legend="Nationality"
        help="Optional. Sharing it widens the eligibility checks we can run — some awards are open to nationals living abroad."
        value={draft.nationality}
        onChange={(nationality) => update({ nationality })}
        provideLabel="Add my nationality"
        error={errors.nationality}
      >
        {({ value, setValue, describedBy, invalid }) => (
          <select
            className="field__input field__select"
            aria-label="Your nationality"
            value={value ?? ""}
            onChange={(event) => setValue(event.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          >
            <option value="" disabled>
              Select a country
            </option>
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </DisclosureField>
    </>
  );
}

export function EducationStep({ draft, errors, update }: StepViewProps) {
  return (
    <RadioGroupField
      legend="Current or intended study level"
      value={draft.studyLevel}
      onValueChange={(studyLevel) => update({ studyLevel })}
      options={STUDY_LEVEL_OPTIONS}
      error={errors.studyLevel}
    />
  );
}

export function FieldStep({ draft, errors, update }: StepViewProps) {
  const undecided = draft.fieldOfStudyUndecided ?? false;
  return (
    <>
      <TextField
        label="Field of study"
        hint="Optional"
        help="The subject area you want to study, for example Computer Science."
        value={draft.fieldOfStudy ?? ""}
        onValueChange={(value) => update({ fieldOfStudy: value })}
        error={errors.fieldOfStudy}
        disabled={undecided}
      />
      <CheckboxField
        label="I haven't decided yet"
        help="A real answer — we'll match on your other details in the meantime."
        checked={undecided}
        onCheckedChange={(checked) =>
          update({
            fieldOfStudyUndecided: checked,
            fieldOfStudy: checked ? "" : draft.fieldOfStudy,
          })
        }
      />
    </>
  );
}

export function ResultsStep({ draft, errors, update }: StepViewProps) {
  return (
    <>
      <DisclosureField
        legend="Grade point average (GPA)"
        help="On a 0–4 scale. Some awards set a minimum. Unknown or private never counts against you."
        value={draft.gpa}
        onChange={(gpa) => update({ gpa })}
        provideLabel="Enter my GPA"
        unknownLabel="I don't know it yet"
        error={errors.gpa}
      >
        {({ value, setValue, describedBy, invalid }) => (
          <input
            className="field__input"
            aria-label="Your GPA on a 0 to 4 scale"
            type="number"
            inputMode="decimal"
            min={0}
            max={4}
            step={0.1}
            value={value === undefined || Number.isNaN(value) ? "" : value}
            onChange={(event) =>
              setValue(
                event.target.value === ""
                  ? Number.NaN
                  : Number.parseFloat(event.target.value),
              )
            }
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          />
        )}
      </DisclosureField>
      <TextField
        label="Grading scale note"
        hint="Optional"
        help="If your school uses a different scale (e.g. percentages), tell us here."
        value={draft.gradingScaleNote ?? ""}
        onValueChange={(value) => update({ gradingScaleNote: value })}
        error={errors.gradingScaleNote}
      />
    </>
  );
}

export function GoalsStep({ draft, errors, update }: StepViewProps) {
  return (
    <>
      <TagField
        label="Interests"
        help="Subjects, causes, or activities you care about. These power matches beyond hard eligibility rules."
        placeholder="e.g. renewable energy"
        values={draft.interests ?? []}
        onValuesChange={(interests) => update({ interests })}
        error={errors.interests}
      />
      <TextAreaField
        label="Your goals"
        hint="Optional"
        help="What are you hoping to achieve? A sentence or two is plenty."
        value={draft.goals ?? ""}
        onValueChange={(value) => update({ goals: value })}
        error={errors.goals}
        rows={4}
      />
    </>
  );
}

export function ExperienceStep({ draft, errors, update }: StepViewProps) {
  return (
    <>
      <RadioGroupField
        legend="Do you have relevant experience?"
        value={draft.experienceStatus}
        onValueChange={(experienceStatus) => update({ experienceStatus })}
        options={EXPERIENCE_OPTIONS}
        error={errors.experienceStatus}
      />
      {draft.experienceStatus === "has" ? (
        <TextAreaField
          label="Briefly, what experience?"
          hint="Optional"
          help="A short summary helps match experience-based awards."
          value={draft.experienceSummary ?? ""}
          onValueChange={(value) => update({ experienceSummary: value })}
          error={errors.experienceSummary}
          rows={3}
        />
      ) : null}
    </>
  );
}

const CONTACT_OPTIONS = [
  { value: "email" as const, label: "Email is fine" },
  { value: "no_preference" as const, label: "No preference" },
  { value: "prefer_not_to_say" as const, label: "Prefer not to say" },
];

export function PreferencesStep({ draft, errors, update }: StepViewProps) {
  return (
    <>
      <DisclosureField
        legend="Accessibility accommodations"
        help="Optional and sensitive. If there's support that would help you apply, tell us. This is never used for matching."
        value={draft.accommodations}
        onChange={(accommodations) => update({ accommodations })}
        provideLabel="Describe accommodations"
        error={errors.accommodations}
      >
        {({ value, setValue, describedBy, invalid }) => (
          <textarea
            className="field__input field__textarea"
            aria-label="Accommodations that would help you"
            rows={3}
            value={value ?? ""}
            onChange={(event) => setValue(event.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          />
        )}
      </DisclosureField>
      <RadioGroupField
        legend="Contact preference"
        help="Optional."
        value={draft.contactPreference}
        onValueChange={(contactPreference) => update({ contactPreference })}
        options={CONTACT_OPTIONS}
      />
    </>
  );
}
