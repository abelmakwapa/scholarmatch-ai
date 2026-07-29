import type { ProfileResponse } from "@/app/lib/api/client";

export type CompletenessFact = {
  id: keyof Pick<
    ProfileResponse,
    | "full_name"
    | "country"
    | "study_level"
    | "field_of_study"
    | "gpa"
    | "interests"
    | "goals"
  >;
  label: string;
  complete: boolean;
};

export type ProfileCompleteness = {
  percent: number;
  completed: number;
  total: number;
  facts: CompletenessFact[];
  missing: CompletenessFact[];
};

export function profileCompleteness(
  profile: ProfileResponse,
): ProfileCompleteness {
  const facts: CompletenessFact[] = [
    {
      id: "full_name",
      label: "Name",
      complete: profile.full_name.trim().length > 0,
    },
    {
      id: "country",
      label: "Country",
      complete: profile.country.trim().length === 2,
    },
    {
      id: "study_level",
      label: "Study level",
      complete: Boolean(profile.study_level),
    },
    {
      id: "field_of_study",
      label: "Field of study",
      complete: Boolean(profile.field_of_study?.trim()),
    },
    {
      id: "gpa",
      label: "Academic result",
      complete: profile.gpa !== null && profile.gpa !== undefined,
    },
    {
      id: "interests",
      label: "Interests",
      complete: profile.interests.length > 0,
    },
    {
      id: "goals",
      label: "Study goals",
      complete: Boolean(profile.goals?.trim()),
    },
  ];
  const completed = facts.filter((fact) => fact.complete).length;
  return {
    percent: Math.round((completed / facts.length) * 100),
    completed,
    total: facts.length,
    facts,
    missing: facts.filter((fact) => !fact.complete),
  };
}
