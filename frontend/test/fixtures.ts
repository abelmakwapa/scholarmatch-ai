import type {
  ApplicationResponse,
  MatchResponse,
  ProfileResponse,
  ScholarshipResponse,
} from "@/app/lib/api/client";

export const profileFixture: ProfileResponse = {
  id: "4dbbe0b4-c9d8-4d21-a28d-c97e85df2dc3",
  full_name: "Ada Lovelace",
  country: "GB",
  study_level: "undergraduate",
  field_of_study: "Mathematics",
  gpa: null,
  interests: ["Computing"],
  goals: "Study applied mathematics.",
  created_at: "2026-06-01T09:00:00Z",
  updated_at: "2026-07-20T10:30:00Z",
};

export const scholarshipFixture: ScholarshipResponse = {
  id: "6278c751-97e2-47d8-a9a1-3ef922a2f2fb",
  title: "Fixture scholarship",
  provider: "Fixture provider",
  description: "A factual fixture used only in tests.",
  amount: 12000,
  currency: "USD",
  funding_type: "partial",
  funding_summary: null,
  study_levels: ["undergraduate"],
  fields_of_study: ["Mathematics"],
  destination_countries: ["GB"],
  nationality_requirements: ["Open to eligible nationalities"],
  residency_requirements: [],
  deadline: "2026-08-05",
  eligibility_summary: "Profile meets the currently structured requirements.",
  eligibility: {
    status: "eligible",
    summary: "Profile meets the currently structured requirements.",
    reasons: ["Study level aligns"],
    missing_facts: [],
  },
  requirements: ["Undergraduate study"],
  required_documents: ["Transcript"],
  source_url: "https://example.com/scholarship",
  application_url: "https://example.com/apply",
  provenance: {
    source_name: "Fixture provider website",
    source_url: "https://example.com/scholarship",
    ingested_at: "2026-07-01T09:00:00Z",
    last_checked_at: "2026-07-20T09:00:00Z",
  },
  verified_at: "2026-07-20T09:00:00Z",
  saved: false,
  status: "published",
  created_at: "2026-07-01T09:00:00Z",
  updated_at: "2026-07-20T09:00:00Z",
};

export const matchFixture: MatchResponse = {
  id: "03bbf781-05ec-4137-97ca-073226854bf7",
  rank: 1,
  scholarship: scholarshipFixture,
  score: 0.82,
  confidence: 0.74,
  score_components: [
    { name: "academics", score: 0.9, weight: 0.25 },
    { name: "eligibility_fit", score: 1, weight: 0.3 },
    { name: "interests_goals", score: 0.8, weight: 0.2 },
    { name: "experience", score: 0.6, weight: 0.1 },
    { name: "readiness_timing", score: 0.7, weight: 0.15 },
  ],
  requirement_evidence: [
    {
      label: "Undergraduate study",
      detail: "The published requirement aligns with the profile study level.",
      basis: "verified_requirement",
      source_url: "https://example.com/scholarship",
    },
    {
      label: "Computing interest",
      detail:
        "The catalogue description appears relevant to a stated interest.",
      basis: "inferred_relevance",
      source_url: null,
    },
  ],
  deterministic_explanation: {
    why_this_matches: ["Your study level aligns with a published requirement."],
    what_may_block_you: [],
    missing_information: [
      { field: "gpa", question: "What is your current GPA?" },
    ],
    next_actions: ["Confirm the GPA requirement with the provider."],
  },
  ai_explanation: {
    why_this_matches: [
      "Your undergraduate mathematics profile aligns with the published study level.",
    ],
    what_may_block_you: [],
    missing_information: [
      { field: "gpa", question: "What is your current GPA?" },
    ],
    next_actions: ["Add your GPA, then verify the provider requirement."],
  },
  reasons: [],
  gaps: [],
  explanation_status: "ready",
  algorithm_version: "match-ranker-v1.0",
  calculation_status: "current",
  stale_reasons: [],
  calculated_at: "2026-07-25T12:00:00Z",
};

export const applicationFixture: ApplicationResponse = {
  id: "7ec21747-c7c2-457c-ab38-0a2513f74911",
  scholarship_id: matchFixture.scholarship.id,
  scholarship: matchFixture.scholarship,
  status: "preparing",
  allowed_transitions: ["saved", "ready", "withdrawn"],
  checklist: [
    {
      id: "38ed579d-1065-40cd-8ab6-c160ff9c0a04",
      label: "Review eligibility requirements",
      required: true,
      completed: false,
      updated_at: "2026-07-26T09:00:00Z",
    },
  ],
  document_readiness: [
    {
      required_document: "Academic transcript",
      ready: false,
      matched_document_ids: [],
      shared_externally: false,
    },
  ],
  status_history: [
    {
      id: "74791bd0-f43d-4e08-b16d-954b5cf63df7",
      from_status: "saved",
      to_status: "preparing",
      changed_at: "2026-07-18T08:00:00Z",
    },
  ],
  reminder: null,
  notes: null,
  deadline_at: null,
  deadline_timezone: null,
  submitted_at: null,
  created_at: "2026-07-18T08:00:00Z",
  updated_at: "2026-07-26T09:00:00Z",
};
