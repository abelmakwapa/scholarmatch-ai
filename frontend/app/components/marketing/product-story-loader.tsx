"use client";

import { useEffect } from "react";

export function ProductStoryEnhancerLoader() {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const targets = document.querySelectorAll(
      "#match-anatomy, #opportunity-explorer, #application-readiness, #use-cases, #faq",
    );

    const load = async () => {
      const { enhanceProductStory } = await import("./product-story-enhancer");
      if (!cancelled) cleanup = enhanceProductStory();
    };

    if (!targets.length || typeof IntersectionObserver === "undefined") {
      void load();
      return () => {
        cancelled = true;
        cleanup?.();
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        void load();
      },
      { rootMargin: "500px 0px" },
    );
    targets.forEach((target) => observer.observe(target));

    return () => {
      cancelled = true;
      observer.disconnect();
      cleanup?.();
    };
  }, []);

  return null;
}
