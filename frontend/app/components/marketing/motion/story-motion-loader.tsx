"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const StoryMotion = dynamic(
  () => import("./story-motion").then((module) => module.StoryMotion),
  { ssr: false },
);

export function StoryMotionLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const target = document.querySelector("[data-story-motion-root]");
    if (!target || typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return ready ? <StoryMotion /> : null;
}
