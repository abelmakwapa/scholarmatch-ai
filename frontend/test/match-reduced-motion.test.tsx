import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => true };
});

import { ScoreBreakdown } from "@/app/components/matches/score-breakdown";
import { RankedMatchList } from "@/app/components/matches/ranked-match-list";
import { matchFixture } from "@/test/fixtures";

test("score disclosure removes transition duration for reduced motion", () => {
  render(<ScoreBreakdown match={matchFixture} />);
  expect(
    screen.getByText("View score breakdown").closest("section"),
  ).toHaveAttribute("data-motion", "reduced");
});

test("rank changes expose the reduced-motion rendering path", () => {
  render(
    <RankedMatchList
      initialPage={{
        data: [matchFixture],
        pagination: { has_more: false, next_cursor: null, limit: 20 },
      }}
    />,
  );
  expect(
    screen.getByText("Your current ranking").closest("div.match-list"),
  ).toHaveAttribute("data-motion", "reduced");
});
