"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

export type MotionPolicy = {
  allowMotion: boolean;
  documentVisible: boolean;
  reduceMotion: boolean;
};

/** Shared accessibility and page-visibility policy for Motion and GSAP. */
export function useMotionPolicy(): MotionPolicy {
  const reduceMotion = Boolean(useReducedMotion());
  const [documentVisible, setDocumentVisible] = useState(
    () =>
      typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setDocumentVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return {
    allowMotion: !reduceMotion && documentVisible,
    documentVisible,
    reduceMotion,
  };
}
