import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { ApprovedStudentStory } from "@/app/components/marketing/data";
import { illustrativeJourneys } from "@/app/components/marketing/story-data";
import {
  nextStoryIndexFromDrag,
  StudentStories,
} from "@/app/components/marketing/student-stories";

const preference = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => preference.reduced };
});

const approvedFixture: readonly ApprovedStudentStory[] = [
  {
    approval: "approved",
    id: "one",
    quote: "First approved story",
    attribution: {
      displayName: "Approved contributor one",
      context: "Reviewed fixture",
    },
  },
  {
    approval: "approved",
    id: "two",
    quote: "Second approved story",
    attribution: {
      displayName: "Approved contributor two",
      context: "Reviewed fixture",
    },
  },
];

afterEach(() => {
  preference.reduced = false;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

describe("StudentStories", () => {
  test("shows an honest empty state when neither approved nor example content exists", () => {
    render(<StudentStories approvedStories={[]} exampleJourneys={[]} />);

    expect(screen.getByTestId("stories-empty")).toHaveTextContent(
      "No approved stories or illustrative journeys are published.",
    );
    expect(
      screen.queryByRole("button", { name: "Next journey" }),
    ).not.toBeInTheDocument();
  });

  test("uses clearly labelled illustrative journeys when approved stories are absent", () => {
    render(
      <StudentStories
        approvedStories={[]}
        exampleJourneys={illustrativeJourneys}
      />,
    );

    expect(screen.getByText("Illustrative scenario")).toBeVisible();
    expect(screen.getByText("No person or outcome represented")).toBeVisible();
    expect(screen.queryByRole("blockquote")).not.toBeInTheDocument();
  });

  test("disables movement controls for one approved story", () => {
    render(<StudentStories approvedStories={approvedFixture.slice(0, 1)} />);

    expect(screen.getByText("Slide 1 of 1")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Previous journey" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next journey" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Play automatic advance" }),
    ).toBeDisabled();
  });

  test("supports buttons, direct selection, and arrow-key navigation", async () => {
    const user = userEvent.setup();
    render(<StudentStories approvedStories={approvedFixture} />);

    expect(screen.getByText(/First approved story/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next journey" }));
    await waitFor(() =>
      expect(screen.getByText(/Second approved story/)).toBeVisible(),
    );

    await user.click(
      screen.getByRole("button", {
        name: /Show slide 1: Approved contributor one/,
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(/First approved story/)).toBeVisible(),
    );

    fireEvent.keyDown(
      screen.getByRole("group", { name: /Approved student stories/ }),
      { key: "ArrowRight" },
    );
    await waitFor(() =>
      expect(screen.getByText(/Second approved story/)).toBeVisible(),
    );

    expect(nextStoryIndexFromDrag(1, 2, 80)).toBe(0);
    expect(nextStoryIndexFromDrag(0, 2, -80)).toBe(1);
    expect(nextStoryIndexFromDrag(0, 2, -20)).toBe(0);
  });

  test("pauses autoplay for pointer, focus, document visibility, and reduced motion", async () => {
    const { container, rerender } = render(
      <StudentStories approvedStories={approvedFixture} />,
    );
    const carousel = container.querySelector(".stories-carousel");
    expect(carousel).toHaveAttribute("data-autoplay", "playing");

    fireEvent.pointerEnter(carousel!);
    expect(carousel).toHaveAttribute("data-autoplay", "paused");
    fireEvent.pointerLeave(carousel!);
    expect(carousel).toHaveAttribute("data-autoplay", "playing");

    fireEvent.focus(
      screen.getByRole("group", { name: /Approved student stories/ }),
    );
    expect(carousel).toHaveAttribute("data-autoplay", "paused");
    fireEvent.blur(
      screen.getByRole("group", { name: /Approved student stories/ }),
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() =>
      expect(carousel).toHaveAttribute("data-autoplay", "paused"),
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    fireEvent(document, new Event("visibilitychange"));
    preference.reduced = true;
    rerender(<StudentStories approvedStories={approvedFixture} />);
    expect(carousel).toHaveAttribute("data-autoplay", "paused");
    expect(
      screen.getByRole("button", { name: "Play automatic advance" }),
    ).toBeDisabled();
  });
});
