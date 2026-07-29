import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { DashboardView } from "@/app/(app)/dashboard/dashboard-view";
import { buildDashboardViewModel } from "@/app/lib/dashboard/model";
import {
  applicationFixture,
  matchFixture,
  profileFixture,
} from "@/test/fixtures";

beforeEach(() => mocks.refresh.mockReset());

describe("DashboardView", () => {
  test("shows an honest first-use state when no profile exists", () => {
    render(<DashboardView state={{ kind: "first-use" }} />);
    expect(
      screen.getByRole("heading", { name: "Build your matching profile" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start profile/ })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });

  test("recovers a failed server query by refreshing the route", async () => {
    const user = userEvent.setup();
    render(
      <DashboardView
        state={{ kind: "error", message: "Profile data is unavailable." }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  test("prioritizes the nearest real deadline after profile completion", () => {
    const completeProfile = { ...profileFixture, gpa: 3.8 };
    const view = buildDashboardViewModel({
      profile: completeProfile,
      matches: [matchFixture],
      applications: [applicationFixture],
      now: new Date("2026-07-29T12:00:00Z"),
    });
    render(<DashboardView state={{ kind: "ready", view }} />);

    expect(
      screen.getByRole("heading", { name: "Fixture scholarship" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Continue application/ }),
    ).toHaveAttribute("href", "/applications");
    expect(
      screen.getByText("7", { selector: ".deadline-list__date strong" }),
    ).toBeInTheDocument();
  });

  test("labels empty and partial sections without fabricating records", () => {
    const view = buildDashboardViewModel({
      profile: profileFixture,
      matches: [],
      applications: [],
      unavailableSources: ["matches"],
      now: new Date("2026-07-29T12:00:00Z"),
    });
    render(<DashboardView state={{ kind: "ready", view }} />);

    expect(
      screen.getByText("Match activity is temporarily unavailable."),
    ).toBeInTheDocument();
    expect(screen.getByText("No applications tracked")).toBeInTheDocument();
  });
});
