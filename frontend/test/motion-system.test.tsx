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
      <section data-proof-motion>
        <div className="category-marquee__track" />
      </section>
      <section data-feature-story>
        <article className="feature-card" />
        <article className="feature-card" />
      </section>
      <StoryMotion />
    </main>
  );
}

const expectedIds = [
  "scholarmatch-eligibility-pipeline",
  "scholarmatch-feature-story",
  "scholarmatch-proof-band",
];

describe("GSAP marketing lifecycle", () => {
  beforeEach(() => {
    policy.allowMotion = true;
    policy.reduceMotion = false;
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
});
