import { render } from "@testing-library/react";
import axe from "axe-core";
import { expect, test } from "vitest";

import { MatchFeedback } from "@/app/components/matches/match-feedback";
import { RankedMatchList } from "@/app/components/matches/ranked-match-list";
import { ScoreBreakdown } from "@/app/components/matches/score-breakdown";
import { matchFixture } from "@/test/fixtures";

test("ranked matches and explanation controls have no automated accessibility violations", async () => {
  const { container } = render(
    <main>
      <h1>Scholarship matches</h1>
      <RankedMatchList
        initialPage={{
          data: [matchFixture],
          pagination: { has_more: false, next_cursor: null, limit: 20 },
        }}
      />
      <ScoreBreakdown match={matchFixture} />
      <MatchFeedback scholarshipId={matchFixture.scholarship.id} />
    </main>,
  );

  const results = await axe.run(container, {
    // jsdom has no layout engine, so contrast is checked during browser QA.
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});
