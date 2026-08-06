import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { CategoryRibbon } from "@/app/components/marketing/category-ribbon";

const preference = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => preference.reduced };
});

afterEach(() => {
  preference.reduced = false;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

describe("CategoryRibbon", () => {
  test("renders every browse category as a real destination", () => {
    render(<CategoryRibbon />);

    const expectedLabels = [
      "Fully funded",
      "Tuition support",
      "Research",
      "STEM",
      "Leadership",
      "Community",
      "Postgraduate",
      "International study",
    ];

    for (const label of expectedLabels) {
      const link = screen.getByRole("link", { name: label });
      expect(link.getAttribute("href")).toMatch(/^\/.+/);
      expect(link.getAttribute("href")).not.toBe("#");
    }
    expect(
      screen.getByText(/do not claim that a live opportunity/i),
    ).toBeVisible();
  });

  test("pauses for pointer, focus, and a hidden document", async () => {
    const { container } = render(<CategoryRibbon />);
    const section = container.querySelector(".category-ribbon");
    const viewport = container.querySelector(".category-ribbon__viewport");

    expect(section).toHaveAttribute("data-paused", "false");
    fireEvent.pointerEnter(viewport!);
    expect(section).toHaveAttribute("data-paused", "true");
    fireEvent.pointerLeave(viewport!);
    expect(section).toHaveAttribute("data-paused", "false");

    fireEvent.focus(screen.getByRole("link", { name: "STEM" }));
    expect(section).toHaveAttribute("data-paused", "true");

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(section).toHaveAttribute("data-paused", "true"));
  });

  test("does not animate or repeat content for reduced motion", () => {
    preference.reduced = true;
    const { container } = render(<CategoryRibbon />);
    const section = container.querySelector(".category-ribbon");

    expect(section).toHaveAttribute("data-motion", "reduced");
    expect(section).toHaveAttribute("data-paused", "true");
    expect(
      container.querySelector<HTMLElement>("[data-category-track]")?.style
        .transform,
    ).toBe("");
  });

  test("reverts every GSAP context when repeatedly mounted under Strict Mode", async () => {
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const view = render(
        <StrictMode>
          <CategoryRibbon />
        </StrictMode>,
      );
      const track = view.container.querySelector<HTMLElement>(
        "[data-category-track]",
      )!;

      await waitFor(() => expect(track.style.transform).not.toBe(""));
      view.unmount();
      await waitFor(() => expect(track.style.transform).toBe(""));
      expect(track.style.willChange).toBe("");
    }
  });
});
