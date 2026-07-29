import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MatchFeedback } from "@/app/components/matches/match-feedback";
import { ScoreBreakdown } from "@/app/components/matches/score-breakdown";
import { matchFixture } from "@/test/fixtures";

describe("match detail components", () => {
  it("shows all five score dimensions and their labels", () => {
    render(<ScoreBreakdown match={matchFixture} />);
    for (const label of [
      "Academics",
      "Eligibility fit",
      "Interests and goals",
      "Experience",
      "Readiness and timing",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(
      screen.getByText(/None predicts whether you will receive an award/i),
    ).toBeInTheDocument();
  });

  it("operates the score disclosure from the keyboard", async () => {
    const user = userEvent.setup();
    render(<ScoreBreakdown match={matchFixture} />);
    const button = screen.getByRole("button", {
      name: /View score breakdown/,
    });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    await waitFor(() =>
      expect(screen.queryByText("Academics")).not.toBeInTheDocument(),
    );
  });

  it("submits useful feedback with a structured reason", async () => {
    const user = userEvent.setup();
    const submitFeedback = vi.fn(async () => undefined);
    render(
      <MatchFeedback
        scholarshipId={matchFixture.scholarship.id}
        submitFeedback={submitFeedback}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Useful" }));
    await user.selectOptions(screen.getByLabelText("Reason"), "accurate");
    await user.type(
      screen.getByLabelText(/Details/),
      "The requirement links helped.",
    );
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(submitFeedback).toHaveBeenCalledWith({
      useful: true,
      reason: "accurate",
      details: "The requirement links helped.",
    });
    expect(await screen.findByText(/recorded for review/i)).toBeInTheDocument();
    expect(screen.getByText(/does not instantly retrain/i)).toBeInTheDocument();
  });

  it("reports submission errors without discarding the form", async () => {
    const user = userEvent.setup();
    const submitFeedback = vi.fn(async () => {
      throw new Error("failed");
    });
    render(
      <MatchFeedback
        scholarshipId={matchFixture.scholarship.id}
        submitFeedback={submitFeedback}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Not useful" }));
    await user.selectOptions(screen.getByLabelText("Reason"), "unclear");
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(
      await screen.findByText(/could not be submitted/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not useful" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
