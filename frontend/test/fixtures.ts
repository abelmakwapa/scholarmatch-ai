import type {
  ApplicationResponse,
  MatchResponse,
  ProfileResponse,
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

export const matchFixture: MatchResponse = {
  id: "03bbf781-05ec-4137-97ca-073226854bf7",
  scholarship: {
    id: "6278c751-97e2-47d8-a9a1-3ef922a2f2fb",
    title: "Fixture scholarship",
    provider: "Fixture provider",
    description: null,
    amount: null,
    currency: null,
    deadline: "2026-08-05",
    eligibility_summary: null,
    application_url: null,
    status: "published",
    created_at: "2026-07-01T09:00:00Z",
    updated_at: "2026-07-20T09:00:00Z",
  },
  score: 0.82,
  confidence: 0.74,
  score_components: [],
  reasons: [],
  gaps: [],
  explanation_status: "ready",
  calculated_at: "2026-07-25T12:00:00Z",
};

export const applicationFixture: ApplicationResponse = {
  id: "7ec21747-c7c2-457c-ab38-0a2513f74911",
  scholarship_id: matchFixture.scholarship.id,
  status: "preparing",
  notes: null,
  submitted_at: null,
  created_at: "2026-07-18T08:00:00Z",
  updated_at: "2026-07-26T09:00:00Z",
};
