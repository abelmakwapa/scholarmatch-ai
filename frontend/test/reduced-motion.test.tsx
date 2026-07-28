import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => true };
});

import { HeroMatcher } from "@/app/components/marketing/hero-matcher";

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

test("renders the matching demonstration without looping motion when reduced motion is preferred", () => {
  render(<HeroMatcher />);
  expect(screen.getByTestId("hero-matcher")).toHaveAttribute(
    "data-motion",
    "reduced",
  );
});
