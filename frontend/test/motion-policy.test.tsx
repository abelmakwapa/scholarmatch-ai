import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const preference = vi.hoisted(() => ({ reduced: false }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    useReducedMotion: () => preference.reduced,
  };
});

import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

let visibility: DocumentVisibilityState = "visible";

beforeEach(() => {
  preference.reduced = false;
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  visibility = "visible";
});

test("disables all optional motion for a reduced-motion preference", () => {
  preference.reduced = true;
  const { result } = renderHook(() => useMotionPolicy());

  expect(result.current).toEqual({
    allowMotion: false,
    documentVisible: true,
    reduceMotion: true,
  });
});

test("pauses optional motion while the document is hidden", () => {
  const { result } = renderHook(() => useMotionPolicy());
  expect(result.current.allowMotion).toBe(true);

  act(() => {
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
  });

  expect(result.current).toEqual({
    allowMotion: false,
    documentVisible: false,
    reduceMotion: false,
  });
});
