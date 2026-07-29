import type { MatchExplanation, MatchResponse } from "@/app/lib/api/client";

export const SCORE_DIMENSIONS = [
  "academics",
  "eligibility_fit",
  "interests_goals",
  "experience",
  "readiness_timing",
] as const;

export const SCORE_LABELS: Record<(typeof SCORE_DIMENSIONS)[number], string> = {
  academics: "Academics",
  eligibility_fit: "Eligibility fit",
  interests_goals: "Interests and goals",
  experience: "Experience",
  readiness_timing: "Readiness and timing",
};

export type PresentedExplanation = {
  explanation: MatchExplanation;
  source: "ai" | "deterministic";
  statusMessage: string;
};

/** A deterministic explanation is mandatory, so Qwen failure never hides a match. */
export function presentExplanation(match: MatchResponse): PresentedExplanation {
  if (match.explanation_status === "ready" && match.ai_explanation) {
    return {
      explanation: match.ai_explanation,
      source: "ai",
      statusMessage:
        "AI-assisted wording grounded in the deterministic score and published requirements.",
    };
  }

  return {
    explanation: match.deterministic_explanation,
    source: "deterministic",
    statusMessage:
      match.explanation_status === "pending"
        ? "The AI explanation is still pending. This deterministic explanation remains available."
        : "The AI explanation is unavailable. This deterministic explanation remains available.",
  };
}

export function formatScore(value: number): string {
  return `${Math.round(value * 100)} / 100`;
}

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatMatchTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function matchIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
