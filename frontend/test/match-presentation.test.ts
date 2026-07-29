import { describe, expect, it } from "vitest";

import { presentExplanation } from "@/app/lib/matches/presentation";
import { matchFixture } from "@/test/fixtures";

describe("match explanation selection", () => {
  it("uses the grounded AI explanation only when it is ready", () => {
    expect(presentExplanation(matchFixture).source).toBe("ai");
  });

  it.each(["pending", "unavailable"] as const)(
    "keeps the deterministic explanation when AI is %s",
    (explanation_status) => {
      const presented = presentExplanation({
        ...matchFixture,
        explanation_status,
        ai_explanation: null,
      });
      expect(presented.source).toBe("deterministic");
      expect(presented.explanation).toBe(
        matchFixture.deterministic_explanation,
      );
      expect(presented.statusMessage).toMatch(/deterministic explanation/i);
    },
  );
});
