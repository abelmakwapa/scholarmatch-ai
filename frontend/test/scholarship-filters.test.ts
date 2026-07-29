import { describe, expect, it } from "vitest";

import {
  parseScholarshipFilters,
  serializeScholarshipFilters,
} from "@/app/lib/scholarships/filters";

describe("scholarship filter serialization", () => {
  it("round-trips supported shareable filters", () => {
    const parsed = parseScholarshipFilters({
      q: "renewable energy",
      study_level: "postgraduate",
      field: "Engineering",
      destination: "GB",
      nationality: "BW",
      residency: "BW",
      funding_type: "research",
      deadline_from: "2026-08-01",
      deadline_to: "2026-12-31",
      verified: "true",
      sort: "deadline",
    });
    const restored = parseScholarshipFilters(
      Object.fromEntries(
        new URLSearchParams(serializeScholarshipFilters(parsed)),
      ),
    );
    expect(restored).toEqual(parsed);
  });

  it("drops unsupported enum values and uses relevance sorting", () => {
    expect(
      parseScholarshipFilters({ study_level: "primary", sort: "popular" }),
    ).toEqual({ limit: 12, sort: "relevance" });
  });
});
