import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const policy = vi.hoisted(() => ({ allowMotion: true, reduceMotion: false }));

vi.mock("@/app/lib/motion/use-motion-policy", () => ({
  useMotionPolicy: () => ({
    ...policy,
    documentVisible: true,
  }),
}));

vi.mock("@/app/components/marketing/motion/hero-motion-loader", () => ({
  HeroMotionLoader: ({
    animationKey,
    playing,
  }: {
    animationKey: string;
    playing: boolean;
  }) => (
    <span
      data-animation-key={animationKey}
      data-playing={String(playing)}
      data-testid="hero-motion-mock"
    />
  ),
}));

import { HeroMatcher } from "@/app/components/marketing/hero-matcher";
import { MatchingWorkspace } from "@/app/components/marketing/matching-workspace";
import { HeroSection } from "@/app/components/marketing/sections";

describe("HeroMatcher", () => {
  beforeEach(() => {
    policy.allowMotion = true;
    policy.reduceMotion = false;
  });

  test("switches scenarios and updates facts, checks, rankings, and one live summary", async () => {
    const user = userEvent.setup();
    const { container } = render(<HeroMatcher />);

    expect(screen.getByText("Computer science")).toBeVisible();
    expect(
      container.querySelectorAll(".hero-matcher__fact-token"),
    ).toHaveLength(3);
    expect(container.querySelectorAll(".hero-matcher__gate")).toHaveLength(3);
    expect(
      container.querySelectorAll(".hero-matcher__match-card"),
    ).toHaveLength(3);

    await user.click(screen.getByRole("tab", { name: "Postgraduate" }));

    expect(screen.getByText("Public health")).toBeVisible();
    expect(screen.getByText("Proposal")).toBeVisible();
    const firstMatch = container.querySelector<HTMLElement>(
      '.hero-matcher__match-card[data-rank="1"]',
    );
    expect(firstMatch).not.toBeNull();
    expect(
      within(firstMatch!).getByRole("heading", {
        name: "Research potential opportunity",
      }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Postgraduate profile selected",
    );
  });

  test("supports keyboard scenario selection without announcing animation frames", async () => {
    const user = userEvent.setup();
    render(<HeroMatcher />);

    const undergraduate = screen.getByRole("tab", { name: "Undergraduate" });
    undergraduate.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");

    expect(screen.getByRole("tab", { name: "International" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "International profile selected",
    );
  });

  test("pauses, resumes, and replays without changing the selected content", async () => {
    const user = userEvent.setup();
    render(<HeroMatcher />);
    const runtime = screen.getByTestId("hero-motion-mock");
    const firstKey = runtime.getAttribute("data-animation-key");

    expect(runtime).toHaveAttribute("data-playing", "true");
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(runtime).toHaveAttribute("data-playing", "false");
    expect(screen.getByText("Computer science")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(runtime).toHaveAttribute("data-playing", "true");
    await user.click(screen.getByRole("button", { name: "Replay" }));
    expect(runtime.getAttribute("data-animation-key")).not.toBe(firstKey);
    expect(runtime).toHaveAttribute("data-playing", "true");
  });

  test("renders the complete result and disables autoplay under reduced motion", () => {
    policy.allowMotion = false;
    policy.reduceMotion = true;
    const { container } = render(<HeroMatcher />);

    expect(screen.getByTestId("hero-matcher")).toHaveAttribute(
      "data-motion",
      "reduced",
    );
    expect(screen.getByTestId("hero-motion-mock")).toHaveAttribute(
      "data-playing",
      "false",
    );
    expect(
      container.querySelectorAll(".hero-matcher__match-card"),
    ).toHaveLength(3);
  });
});

describe("shared matching demos", () => {
  test("keeps the profile preview and workspace on the same scenario", async () => {
    const user = userEvent.setup();
    render(
      <>
        <HeroMatcher />
        <MatchingWorkspace />
      </>,
    );
    const hero = screen.getByRole("region", {
      name: "Interactive example of a student profile becoming ranked scholarship matches",
    });
    const workspace = screen.getByRole("region", {
      name: "Interactive ScholarMatch workspace",
    });

    await user.click(within(hero).getByRole("tab", { name: "Postgraduate" }));
    expect(within(workspace).getByText("Public health")).toBeVisible();
    expect(
      within(workspace).getByRole("combobox", {
        name: "Example profile",
      }),
    ).toHaveValue("1");

    await user.selectOptions(
      within(workspace).getByRole("combobox", {
        name: "Example profile",
      }),
      "2",
    );
    expect(
      within(hero).getByRole("tab", { name: "International" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(within(workspace).getAllByText("Citizenship")).toHaveLength(2);
  });

  test("updates every workspace step from its profile selector", async () => {
    const user = userEvent.setup();
    render(<MatchingWorkspace />);
    const workspace = screen.getByRole("region", {
      name: "Interactive ScholarMatch workspace",
    });

    await user.selectOptions(
      within(workspace).getByRole("combobox", {
        name: "Example profile",
      }),
      "1",
    );
    expect(within(workspace).getByText("Public health")).toBeVisible();
    expect(within(workspace).getByText("Proposal")).toBeVisible();
    expect(
      within(workspace).getByText("Research potential opportunity"),
    ).toBeVisible();
  });
});

describe("HeroSection CTA routing", () => {
  test("routes anonymous students through onboarding", () => {
    render(<HeroSection />);
    expect(
      screen.getByRole("link", { name: /Find my scholarships/ }),
    ).toHaveAttribute("href", "/sign-up?next=/onboarding");
    expect(
      screen.getByRole("link", { name: /See how matching works/ }),
    ).toHaveAttribute("href", "#how-it-works");
  });

  test("routes authenticated students to ranked matches", () => {
    render(<HeroSection authenticated />);
    expect(
      screen.getByRole("link", { name: /Find my scholarships/ }),
    ).toHaveAttribute("href", "/matches");
  });
});
