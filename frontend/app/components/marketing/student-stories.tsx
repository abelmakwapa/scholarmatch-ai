"use client";

import { ArrowLeft, ArrowRight, MessageCircleMore } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { motionDistances, motionTransitions } from "@/app/lib/motion/tokens";
import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

import type { StudentStory } from "./data";

type StudentStoriesProps = {
  stories: StudentStory[];
};

export function StudentStories({ stories }: StudentStoriesProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { reduceMotion } = useMotionPolicy();

  if (stories.length === 0) {
    return (
      <div className="stories-empty" data-testid="stories-empty">
        <span aria-hidden="true">
          <MessageCircleMore size={30} strokeWidth={1.7} />
        </span>
        <p className="eyebrow">Stories, when they are approved</p>
        <h3>No published student stories yet.</h3>
        <p>
          This space is intentionally honest. Approved, attributable student
          experiences will appear here when they are available.
        </p>
      </div>
    );
  }

  const activeStory = stories[activeIndex];
  const showPrevious = () =>
    setActiveIndex((activeIndex - 1 + stories.length) % stories.length);
  const showNext = () => setActiveIndex((activeIndex + 1) % stories.length);

  return (
    <div className="stories-carousel">
      <div
        aria-atomic="true"
        aria-live="polite"
        className="stories-carousel__viewport"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.figure
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion
                ? { opacity: 1, x: 0 }
                : { opacity: 0, x: -motionDistances.medium }
            }
            initial={
              reduceMotion ? false : { opacity: 0, x: motionDistances.medium }
            }
            key={activeStory.id}
            transition={
              reduceMotion ? { duration: 0 } : motionTransitions.standard
            }
          >
            <blockquote>“{activeStory.quote}”</blockquote>
            <figcaption>
              <strong>{activeStory.name}</strong>
              <span>{activeStory.context}</span>
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>

      <div className="stories-carousel__controls">
        <p aria-live="polite">
          {activeIndex + 1} / {stories.length}
        </p>
        <div>
          <motion.button
            aria-label="Previous student story"
            onClick={showPrevious}
            transition={motionTransitions.instant}
            type="button"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </motion.button>
          <motion.button
            aria-label="Next student story"
            onClick={showNext}
            transition={motionTransitions.instant}
            type="button"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          >
            <ArrowRight aria-hidden="true" size={20} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
