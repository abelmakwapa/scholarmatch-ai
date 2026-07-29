"use client";

import { Check, Edit3, Info, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FormStatus } from "@/app/components/forms/form-status";
import { SelectField } from "@/app/components/forms/select-field";
import { SubmitButton } from "@/app/components/forms/submit-button";
import { TagField } from "@/app/components/forms/tag-field";
import { TextAreaField } from "@/app/components/forms/textarea-field";
import { TextField } from "@/app/components/forms/text-field";
import type { ProfileResponse, ProfileWrite } from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import { ApiError } from "@/app/lib/api/errors";
import { buildSignInUrl } from "@/app/lib/routing/safe-redirect";
import {
  COUNTRIES,
  countryName,
  isValidCountryCode,
} from "@/app/lib/onboarding/countries";
import { profileCompleteness } from "@/app/lib/profile/completeness";

type SectionId = "identity" | "academics" | "goals";
type Draft = {
  fullName: string;
  country: string;
  studyLevel: ProfileWrite["study_level"];
  fieldOfStudy: string;
  gpa: string;
  interests: string[];
  goals: string;
};
type FieldErrors = Partial<Record<keyof Draft, string>>;

type ProfileEditorProps = {
  initialProfile: ProfileResponse;
  initialEdit?: boolean;
  saveProfile?: (profile: ProfileWrite) => Promise<ProfileResponse>;
};

const STUDY_LEVELS = [
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate" },
  { value: "doctoral", label: "Doctoral" },
  { value: "other", label: "Other" },
] as const;

export function ProfileEditor({
  initialProfile,
  initialEdit = false,
  saveProfile,
}: ProfileEditorProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [draft, setDraft] = useState(() => toDraft(initialProfile));
  const [editing, setEditing] = useState<SectionId | null>(() =>
    initialEdit ? sectionForFirstGap(initialProfile) : null,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const completeness = useMemo(() => profileCompleteness(profile), [profile]);

  const update = <Key extends keyof Draft>(key: Key, value: Draft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setStatus(null);
  };

  const beginEdit = (section: SectionId) => {
    setDraft(toDraft(profile));
    setErrors({});
    setStatus(null);
    setEditing(section);
  };

  const cancel = () => {
    setDraft(toDraft(profile));
    setErrors({});
    setStatus(null);
    setEditing(null);
  };

  const handleSave = async () => {
    if (pending) return;
    const nextErrors = validateDraft(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const body = toProfileWrite(draft);
    setPending(true);
    setStatus(null);
    try {
      const updated = await (saveProfile
        ? saveProfile(body)
        : createBrowserApiClient().replaceProfile(body));
      setProfile(updated);
      setDraft(toDraft(updated));
      setEditing(null);
      setStatus({
        tone: "success",
        message: "Profile saved. Completeness is up to date.",
      });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.kind === "unauthorized") {
        router.replace(
          buildSignInUrl("/profile", { reason: "session-expired" }),
        );
        return;
      }
      if (error instanceof ApiError) {
        const apiErrors = error.fieldErrors();
        setErrors({
          fullName: apiErrors.full_name,
          country: apiErrors.country,
          studyLevel: apiErrors.study_level,
          fieldOfStudy: apiErrors.field_of_study,
          gpa: apiErrors.gpa,
          interests: apiErrors.interests,
          goals: apiErrors.goals,
        });
        setStatus({ tone: "error", message: error.message });
      } else {
        setStatus({
          tone: "error",
          message:
            "Your changes couldn’t be saved. The previous profile is still active.",
        });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="workspace-page profile-page">
      <header className="workspace-page__header profile-heading">
        <div>
          <p className="product-eyebrow">Matching profile</p>
          <h1>The facts behind your matches.</h1>
          <p>
            Review what ScholarMatch can use and keep time-sensitive details
            current.
          </p>
        </div>
        <div className="profile-freshness">
          <span>Last updated</span>
          <time dateTime={profile.updated_at}>
            {formatTimestamp(profile.updated_at)}
          </time>
        </div>
      </header>

      <section
        className="profile-completeness"
        aria-labelledby="completeness-title"
      >
        <div className="profile-completeness__copy">
          <div>
            <p className="product-eyebrow">Profile completeness</p>
            <h2 id="completeness-title">{completeness.percent}% complete</h2>
          </div>
          <strong>
            {completeness.completed} of {completeness.total} matching facts
          </strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Profile completeness"
          aria-valuenow={completeness.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${completeness.percent}%` }} />
        </div>
        <p>
          <Info aria-hidden="true" size={15} />
          More complete, current facts can increase confidence in requirement
          checks. Completeness does not guarantee eligibility or an award.
        </p>
      </section>

      {status ? (
        <FormStatus tone={status.tone}>{status.message}</FormStatus>
      ) : null}

      <form
        className="profile-edit-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <div className="profile-sections">
          <ProfileSection
            id="identity-title"
            title="Identity and location"
            description="Core facts used for location and residency requirements."
            editing={editing === "identity"}
            onEdit={() => beginEdit("identity")}
          >
            {editing === "identity" ? (
              <div className="profile-form-grid">
                <TextField
                  label="Full name"
                  value={draft.fullName}
                  onValueChange={(value) => update("fullName", value)}
                  error={errors.fullName}
                  autoComplete="name"
                  maxLength={200}
                  required
                />
                <SelectField
                  label="Country of residence"
                  value={draft.country}
                  onValueChange={(value) => update("country", value)}
                  error={errors.country}
                  options={COUNTRIES.map(({ code, name }) => ({
                    value: code,
                    label: name,
                  }))}
                />
              </div>
            ) : (
              <FactList
                facts={[
                  ["Full name", profile.full_name],
                  [
                    "Country of residence",
                    countryName(profile.country) ?? profile.country,
                  ],
                ]}
              />
            )}
          </ProfileSection>

          <ProfileSection
            id="academics-title"
            title="Academic profile"
            description="Level, field, and result information used in academic-fit checks."
            editing={editing === "academics"}
            onEdit={() => beginEdit("academics")}
          >
            {editing === "academics" ? (
              <div className="profile-form-grid">
                <SelectField
                  label="Study level"
                  value={draft.studyLevel}
                  onValueChange={(value) =>
                    update("studyLevel", value as Draft["studyLevel"])
                  }
                  error={errors.studyLevel}
                  options={STUDY_LEVELS}
                />
                <TextField
                  label="Field of study"
                  value={draft.fieldOfStudy}
                  onValueChange={(value) => update("fieldOfStudy", value)}
                  error={errors.fieldOfStudy}
                  maxLength={200}
                  placeholder="e.g. Computer science"
                />
                <TextField
                  label="GPA"
                  help="Use a 0–4 scale. Leave blank when unknown."
                  value={draft.gpa}
                  onValueChange={(value) => update("gpa", value)}
                  error={errors.gpa}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="4"
                  step="0.01"
                />
              </div>
            ) : (
              <FactList
                facts={[
                  ["Study level", formatLabel(profile.study_level)],
                  ["Field of study", profile.field_of_study || "Not provided"],
                  [
                    "GPA (4.0 scale)",
                    profile.gpa === null || profile.gpa === undefined
                      ? "Not provided"
                      : String(profile.gpa),
                  ],
                ]}
              />
            )}
          </ProfileSection>

          <ProfileSection
            id="goals-title"
            title="Goals and interests"
            description="Context used for relevance scoring after hard requirements are checked."
            editing={editing === "goals"}
            onEdit={() => beginEdit("goals")}
          >
            {editing === "goals" ? (
              <div className="profile-form-grid profile-form-grid--single">
                <TagField
                  label="Interests"
                  help="Press Enter after each interest."
                  values={draft.interests}
                  onValuesChange={(value) => update("interests", value)}
                  error={errors.interests}
                  maxItems={50}
                  placeholder="Add an interest"
                />
                <TextAreaField
                  label="Study goals"
                  value={draft.goals}
                  onValueChange={(value) => update("goals", value)}
                  error={errors.goals}
                  maxLength={4000}
                  rows={5}
                />
              </div>
            ) : (
              <FactList
                facts={[
                  [
                    "Interests",
                    profile.interests.length > 0
                      ? profile.interests.join(", ")
                      : "Not provided",
                  ],
                  ["Study goals", profile.goals || "Not provided"],
                ]}
              />
            )}
          </ProfileSection>
        </div>

        {editing ? (
          <div
            className="profile-savebar"
            aria-label="Profile editing controls"
          >
            <button
              className="product-button product-button--quiet"
              type="button"
              onClick={cancel}
              disabled={pending}
            >
              <X aria-hidden="true" size={16} /> Cancel
            </button>
            <SubmitButton pending={pending} pendingLabel="Saving…">
              <Save aria-hidden="true" size={16} /> Save profile
            </SubmitButton>
          </div>
        ) : null}
      </form>
    </div>
  );
}

function ProfileSection({
  id,
  title,
  description,
  editing,
  onEdit,
  children,
}: {
  id: string;
  title: string;
  description: string;
  editing: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className="profile-section"
      aria-labelledby={id}
      data-editing={editing || undefined}
    >
      <header>
        <div>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
        {editing ? (
          <span className="profile-section__editing">
            <Check aria-hidden="true" size={14} /> Editing
          </span>
        ) : (
          <button type="button" onClick={onEdit} aria-label={`Edit ${title}`}>
            <Edit3 aria-hidden="true" size={15} /> Edit
          </button>
        )}
      </header>
      <div className="profile-section__body">{children}</div>
    </section>
  );
}

function FactList({ facts }: { facts: [string, string][] }) {
  return (
    <dl className="profile-facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd data-empty={value === "Not provided" || undefined}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function toDraft(profile: ProfileResponse): Draft {
  return {
    fullName: profile.full_name,
    country: profile.country,
    studyLevel: profile.study_level,
    fieldOfStudy: profile.field_of_study ?? "",
    gpa:
      profile.gpa === null || profile.gpa === undefined
        ? ""
        : String(profile.gpa),
    interests: [...profile.interests],
    goals: profile.goals ?? "",
  };
}

function toProfileWrite(draft: Draft): ProfileWrite {
  return {
    full_name: draft.fullName.trim(),
    country: draft.country.toUpperCase(),
    study_level: draft.studyLevel,
    field_of_study: draft.fieldOfStudy.trim() || null,
    gpa: draft.gpa.trim() === "" ? null : Number(draft.gpa),
    interests: draft.interests.map((value) => value.trim()).filter(Boolean),
    goals: draft.goals.trim() || null,
  };
}

function validateDraft(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.fullName.trim()) errors.fullName = "Enter your full name.";
  if (!isValidCountryCode(draft.country))
    errors.country = "Choose a valid country.";
  if (draft.fieldOfStudy.length > 200)
    errors.fieldOfStudy = "Use 200 characters or fewer.";
  if (draft.goals.length > 4000)
    errors.goals = "Use 4,000 characters or fewer.";
  if (draft.gpa.trim()) {
    const value = Number(draft.gpa);
    if (!Number.isFinite(value) || value < 0 || value > 4)
      errors.gpa = "Enter a GPA between 0 and 4.";
  }
  return errors;
}

function sectionForFirstGap(profile: ProfileResponse): SectionId {
  const missing = profileCompleteness(profile).missing[0]?.id;
  if (missing === "full_name" || missing === "country") return "identity";
  if (
    missing === "study_level" ||
    missing === "field_of_study" ||
    missing === "gpa"
  )
    return "academics";
  return "goals";
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
