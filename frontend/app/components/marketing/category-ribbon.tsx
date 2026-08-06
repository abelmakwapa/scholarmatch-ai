"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

const browseCategories = [
  {
    label: "Fully funded",
    href: "/resources/eligibility-glossary#funding-and-time",
  },
  {
    label: "Tuition support",
    href: "/resources/eligibility-glossary#funding-and-time",
  },
  { label: "Research", href: "/for-students/research" },
  { label: "STEM", href: "/for-students/stem" },
  { label: "Leadership", href: "/for-students/community" },
  { label: "Community", href: "/for-students/community" },
  { label: "Postgraduate", href: "/for-students/postgraduate" },
  { label: "International study", href: "/for-students/international" },
] as const;

type RibbonTimeline = {
  paused(value: boolean): RibbonTimeline;
};

export function CategoryRibbon() {
  const rootRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<RibbonTimeline | null>(null);
  const pausedRef = useRef(false);
  const [pointerPaused, setPointerPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const { documentVisible, reduceMotion } = useMotionPolicy();
  const paused =
    reduceMotion || !documentVisible || pointerPaused || focusPaused;

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    if (reduceMotion || !rootRef.current) return;

    void import("@/app/lib/motion/gsap-client").then(({ gsap }) => {
      if (cancelled || !rootRef.current) return;
      const context = gsap.context(() => {
        const track = rootRef.current?.querySelector<HTMLElement>(
          "[data-category-track]",
        );
        if (!track) return;
        const timeline = gsap.timeline({ repeat: -1 });
        timeline.to(track, {
          duration: 34,
          ease: "none",
          xPercent: -50,
        });
        timeline.paused(pausedRef.current);
        timelineRef.current = timeline;
      }, rootRef);
      cleanup = () => {
        timelineRef.current = null;
        context.revert();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reduceMotion]);

  useEffect(() => {
    timelineRef.current?.paused(paused);
    const track = rootRef.current?.querySelector<HTMLElement>(
      "[data-category-track]",
    );
    if (track) track.style.willChange = paused ? "auto" : "transform";

    return () => {
      if (track) track.style.removeProperty("will-change");
    };
  }, [paused]);

  return (
    <section
      aria-labelledby="category-ribbon-heading"
      className="category-ribbon"
      data-motion={reduceMotion ? "reduced" : "full"}
      data-paused={paused}
      id="browse-categories"
    >
      <div className="category-ribbon__intro">
        <p className="eyebrow">Browse themes</p>
        <h2 id="category-ribbon-heading">Start with the path you recognise.</h2>
        <p>
          These links describe browse categories. They do not claim that a live
          opportunity is currently available in every category.
        </p>
      </div>
      <div
        className="category-ribbon__viewport"
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocusPaused(false);
          }
        }}
        onFocusCapture={() => setFocusPaused(true)}
        onPointerEnter={() => setPointerPaused(true)}
        onPointerLeave={() => setPointerPaused(false)}
        ref={rootRef}
      >
        <div className="category-ribbon__track" data-category-track>
          {[false, true].map((duplicate) => (
            <ul aria-hidden={duplicate || undefined} key={String(duplicate)}>
              {browseCategories.map((category) => (
                <li key={`${duplicate}-${category.label}`}>
                  <Link
                    href={category.href}
                    tabIndex={duplicate ? -1 : undefined}
                  >
                    {category.label}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
