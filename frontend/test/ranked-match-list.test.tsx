import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RankedMatchList } from "@/app/components/matches/ranked-match-list";
import { ApiError } from "@/app/lib/api/errors";
import type { JobResponse, MatchPage } from "@/app/lib/api/client";
import { matchFixture } from "@/test/fixtures";

const page: MatchPage = {
  data: [matchFixture],
  pagination: { has_more: false, next_cursor: null, limit: 20 },
};

const queuedJob: JobResponse = {
  id: "a7dba28f-3e6a-4c68-ac99-8c5588241be2",
  status: "queued",
  created_at: "2026-07-29T07:00:00Z",
  updated_at: "2026-07-29T07:00:00Z",
  completed_at: null,
  matches_updated_at: null,
  error_code: null,
};

describe("ranked match list", () => {
  it("labels scores as fit rather than winning probability", () => {
    render(<RankedMatchList initialPage={page} />);
    expect(screen.getByText("82 / 100")).toBeInTheDocument();
    expect(screen.getByText("Not a winning probability")).toBeInTheDocument();
    expect(
      screen.getByText(/not probabilities of receiving an award/i),
    ).toBeInTheDocument();
  });

  it("shows unknown and ineligible states with text labels", () => {
    const unknown = {
      ...matchFixture,
      id: "7c514e10-1cdc-456e-a021-a5bab08aca9d",
      rank: 2,
      scholarship: {
        ...matchFixture.scholarship,
        id: "a0443bea-c5a5-4121-90e8-fb78bb12432b",
        eligibility: {
          ...matchFixture.scholarship.eligibility,
          status: "unknown" as const,
        },
      },
    };
    const ineligible = {
      ...matchFixture,
      id: "c6435cd4-135d-4c0a-a747-c0c1bfbf96f3",
      rank: 3,
      scholarship: {
        ...matchFixture.scholarship,
        id: "d3e09548-73af-4675-a044-e3fe699d4998",
        eligibility: {
          ...matchFixture.scholarship.eligibility,
          status: "ineligible" as const,
        },
      },
    };
    render(
      <RankedMatchList
        initialPage={{ ...page, data: [unknown, ineligible] }}
      />,
    );
    expect(
      screen.getByText("Unknown — profile data missing"),
    ).toBeInTheDocument();
    expect(screen.getByText("Ineligible")).toBeInTheDocument();
  });

  it("shows stale calculation metadata and its reason", async () => {
    const user = userEvent.setup();
    render(
      <RankedMatchList
        initialPage={{
          ...page,
          data: [
            {
              ...matchFixture,
              calculation_status: "stale",
              stale_reasons: ["Profile updated after calculation."],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Needs recalculation")).toBeInTheDocument();
    await user.click(screen.getByText("Calculation details"));
    expect(
      screen.getByText("Profile updated after calculation."),
    ).toBeInTheDocument();
  });

  it("announces recalculation completion without replacing the control", async () => {
    const user = userEvent.setup();
    const recalculate = vi.fn(async () => queuedJob);
    const waitForJob = vi.fn(async () => ({
      ...queuedJob,
      status: "completed" as const,
      updated_at: "2026-07-29T07:02:00Z",
      completed_at: "2026-07-29T07:02:00Z",
      matches_updated_at: "2026-07-29T07:02:00Z",
    }));
    const reload = vi.fn(async () => page);
    render(
      <RankedMatchList
        initialPage={page}
        actions={{ recalculate, waitForJob, reload }}
      />,
    );
    const button = screen.getByRole("button", { name: "Recalculate matches" });
    await user.click(button);
    expect(
      await screen.findByText(/Recalculation complete/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recalculate matches" }),
    ).toBeInTheDocument();
    expect(recalculate).toHaveBeenCalledOnce();
  });

  it("provides actionable rate-limit feedback", async () => {
    const user = userEvent.setup();
    const recalculate = vi.fn(async () => {
      throw new ApiError({
        kind: "rate_limited",
        status: 429,
        message: "Rate limited",
        retryAfterSeconds: 45,
      });
    });
    render(<RankedMatchList initialPage={page} actions={{ recalculate }} />);
    await user.click(
      screen.getByRole("button", { name: "Recalculate matches" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Try again in 45 seconds",
    );
  });
});
