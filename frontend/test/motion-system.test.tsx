import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const policy = vi.hoisted(() => ({ allowMotion: true, reduceMotion: false }));

vi.mock("@/app/lib/motion/use-motion-policy", () => ({
  useMotionPolicy: () => ({
    ...policy,
    documentVisible: true,
  }),
}));

import { StoryMotion } from "@/app/components/marketing/motion/story-motion";
import { HeroMotion } from "@/app/components/marketing/motion/hero-motion";
import { ScrollTrigger } from "@/app/lib/motion/gsap-client";

function StoryFixture() {
  return (
    <main data-story-motion-root>
      <section data-eligibility-pipeline>
        <div className="workbench-panel" />
        <div className="workbench-panel" />
        <div className="workbench-panel" />
        <div className="rule-path__item" />
        <div className="rule-path__item" />
      </section>
      <StoryMotion />
    </main>
  );
}

function HeroFixture() {
  return (
    <section data-hero-motion>
      {[0, 1, 2].map((index) => (
        <div className="hero-matcher__fact-token" key={`fact-${index}`} />
      ))}
      {[0, 1, 2].map((index) => (
        <div className="hero-matcher__gate" key={`gate-${index}`} />
      ))}
      {[0, 1, 2].map((index) => (
        <div className="hero-matcher__match-card" key={`match-${index}`} />
      ))}
      <HeroMotion animationKey="undergraduate-0" onComplete={vi.fn()} playing />
    </section>
  );
}

const expectedIds = ["scholarmatch-eligibility-pipeline"];

describe("GSAP marketing lifecycle", () => {
  beforeEach(() => {
    policy.allowMotion = true;
    policy.reduceMotion = false;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  });

  test("creates one timeline per sequence under Strict Mode and reverts on unmount", async () => {
    const view = render(
      <StrictMode>
        <StoryFixture />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(
        ScrollTrigger.getAll()
          .map((trigger) => trigger.vars.id)
          .filter((id): id is string => typeof id === "string")
          .sort(),
      ).toEqual([...expectedIds].sort());
    });

    view.unmount();

    await waitFor(() => expect(ScrollTrigger.getAll()).toHaveLength(0));
  });

  test("renders final content without timelines under reduced motion", () => {
    policy.allowMotion = false;
    policy.reduceMotion = true;

    render(<StoryFixture />);

    expect(screen.getByTestId("story-motion-runtime")).toHaveAttribute(
      "data-motion",
      "reduced",
    );
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  test("keeps the explanatory workflow stacked without a scroll timeline on small screens", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 768,
    });

    render(<StoryFixture />);

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(screen.getByTestId("story-motion-runtime")).toHaveAttribute(
      "data-motion",
      "full",
    );
  });

  test("does not duplicate the hero timeline across Strict Mode remounts", async () => {
    const first = render(
      <StrictMode>
        <HeroFixture />
      </StrictMode>,
    );

    await waitFor(() =>
      expect(ScrollTrigger.getAll().map((trigger) => trigger.vars.id)).toEqual([
        "scholarmatch-hero-demo",
      ]),
    );
    first.unmount();
    await waitFor(() => expect(ScrollTrigger.getAll()).toHaveLength(0));

    const second = render(
      <StrictMode>
        <HeroFixture />
      </StrictMode>,
    );
    await waitFor(() =>
      expect(ScrollTrigger.getAll().map((trigger) => trigger.vars.id)).toEqual([
        "scholarmatch-hero-demo",
      ]),
    );
    second.unmount();
    await waitFor(() => expect(ScrollTrigger.getAll()).toHaveLength(0));
  });
});
