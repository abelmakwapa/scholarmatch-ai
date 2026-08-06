"use client";

import {
  ArrowLeft,
  ArrowRight,
  CirclePause,
  CirclePlay,
  MessageCircleMore,
} from "lucide-react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import {
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { motionDistances, motionTransitions } from "@/app/lib/motion/tokens";
import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

import type { ApprovedStudentStory } from "./data";
import type { IllustrativeJourney } from "./story-data";

export type StudentStoriesProps = {
  approvedStories: readonly ApprovedStudentStory[];
  exampleJourneys?: readonly IllustrativeJourney[];
  autoplayMs?: number;
};

type CarouselItem =
  | { kind: "approved"; story: ApprovedStudentStory }
  | { kind: "illustrative"; story: IllustrativeJourney };

export function nextStoryIndexFromDrag(
  activeIndex: number,
  itemCount: number,
  offsetX: number,
): number {
  if (itemCount < 2 || Math.abs(offsetX) < 50) return activeIndex;
  return offsetX < 0
    ? (activeIndex + 1) % itemCount
    : (activeIndex - 1 + itemCount) % itemCount;
}

export function StudentStories({
  approvedStories,
  exampleJourneys = [],
  autoplayMs = 7000,
}: StudentStoriesProps) {
  const approved = useMemo(
    () => approvedStories.filter((story) => story.approval === "approved"),
    [approvedStories],
  );
  const items = useMemo<readonly CarouselItem[]>(
    () =>
      approved.length > 0
        ? approved.map((story) => ({ kind: "approved" as const, story }))
        : exampleJourneys.map((story) => ({
            kind: "illustrative" as const,
            story,
          })),
    [approved, exampleJourneys],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [userPaused, setUserPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const { documentVisible, reduceMotion } = useMotionPolicy();
  const hasMultiple = items.length > 1;
  const autoplayActive =
    hasMultiple &&
    !reduceMotion &&
    documentVisible &&
    !userPaused &&
    !interactionPaused;
  const playbackStopped = userPaused || reduceMotion || !hasMultiple;
  const renderedIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  useEffect(() => {
    if (!autoplayActive) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setActiveIndex((current) => (current + 1) % items.length);
    }, autoplayMs);
    return () => window.clearInterval(timer);
  }, [autoplayActive, autoplayMs, items.length]);

  if (items.length === 0) {
    return (
      <div className="stories-empty" data-testid="stories-empty">
        <span aria-hidden="true">
          <MessageCircleMore size={30} strokeWidth={1.7} />
        </span>
        <p className="eyebrow">Stories, when they are approved</p>
        <h3>No approved stories or illustrative journeys are published.</h3>
        <p>
          This space remains empty until reviewed content is explicitly
          supplied.
        </p>
      </div>
    );
  }

  const activeItem = items[renderedIndex];
  const mode = activeItem.kind;

  function show(index: number, nextDirection: 1 | -1, manual = true) {
    setDirection(nextDirection);
    setActiveIndex((index + items.length) % items.length);
    if (manual) setUserPaused(true);
  }

  function showPrevious() {
    show(renderedIndex - 1, -1);
  }

  function showNext() {
    show(renderedIndex + 1, 1);
  }

  function handleKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    } else if (event.key === "Home") {
      event.preventDefault();
      show(0, -1);
    } else if (event.key === "End") {
      event.preventDefault();
      show(items.length - 1, 1);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setInteractionPaused(false);
    }
  }

  function handleDragEnd(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) {
    const nextIndex = nextStoryIndexFromDrag(
      renderedIndex,
      items.length,
      info.offset.x,
    );
    if (nextIndex === renderedIndex) return;
    show(nextIndex, info.offset.x < 0 ? 1 : -1);
  }

  const itemLabel = (item: CarouselItem) =>
    item.kind === "approved"
      ? item.story.attribution.displayName
      : item.story.title;

  return (
    <div
      className="stories-carousel"
      data-autoplay={autoplayActive ? "playing" : "paused"}
      data-story-mode={mode}
      onBlurCapture={handleBlur}
      onFocusCapture={() => setInteractionPaused(true)}
      onPointerEnter={() => setInteractionPaused(true)}
      onPointerLeave={() => setInteractionPaused(false)}
    >
      <div
        aria-label={`${mode === "approved" ? "Approved student stories" : "Illustrative example journeys"}. Use Left and Right Arrow keys to change slide.`}
        aria-live={autoplayActive ? "off" : "polite"}
        className="stories-carousel__viewport"
        onKeyDown={handleKeyboard}
        role="group"
        tabIndex={0}
      >
        <AnimatePresence custom={direction} initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="stories-carousel__slide"
            custom={direction}
            drag={!reduceMotion && hasMultiple ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.16}
            exit={
              reduceMotion
                ? { opacity: 1, x: 0 }
                : {
                    opacity: 0,
                    x: -direction * motionDistances.large,
                  }
            }
            initial={
              reduceMotion
                ? false
                : {
                    opacity: 0,
                    x: direction * motionDistances.large,
                  }
            }
            key={`${activeItem.kind}-${activeItem.story.id}`}
            onDragEnd={handleDragEnd}
            transition={
              reduceMotion ? { duration: 0 } : motionTransitions.standard
            }
          >
            {activeItem.kind === "approved" ? (
              <figure>
                <blockquote>“{activeItem.story.quote}”</blockquote>
                <figcaption>
                  <strong>{activeItem.story.attribution.displayName}</strong>
                  <span>{activeItem.story.attribution.context}</span>
                </figcaption>
              </figure>
            ) : (
              <article>
                <div className="stories-carousel__label-row">
                  <span>Illustrative scenario</span>
                  <small>No person or outcome represented</small>
                </div>
                <p className="eyebrow">{activeItem.story.context}</p>
                <h3>{activeItem.story.title}</h3>
                <p>{activeItem.story.summary}</p>
                <ol>
                  {activeItem.story.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="stories-carousel__next-step">
                  <strong>Practical next step</strong>
                  {activeItem.story.nextStep}
                </p>
              </article>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="stories-carousel__controls">
        <p aria-live="polite">
          Slide {renderedIndex + 1} of {items.length}
        </p>
        <div>
          <motion.button
            aria-label="Previous journey"
            disabled={!hasMultiple}
            onClick={showPrevious}
            transition={motionTransitions.instant}
            type="button"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </motion.button>
          <motion.button
            aria-label={
              playbackStopped
                ? "Play automatic advance"
                : "Pause automatic advance"
            }
            disabled={!hasMultiple || reduceMotion}
            onClick={() => setUserPaused((current) => !current)}
            title={
              reduceMotion
                ? "Automatic advance is off while reduced motion is enabled"
                : undefined
            }
            transition={motionTransitions.instant}
            type="button"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          >
            {playbackStopped ? (
              <CirclePlay aria-hidden="true" size={20} />
            ) : (
              <CirclePause aria-hidden="true" size={20} />
            )}
          </motion.button>
          <motion.button
            aria-label="Next journey"
            disabled={!hasMultiple}
            onClick={showNext}
            transition={motionTransitions.instant}
            type="button"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          >
            <ArrowRight aria-hidden="true" size={20} />
          </motion.button>
        </div>
      </div>

      <div
        aria-label="Choose a journey"
        className="stories-carousel__dots"
        role="group"
      >
        {items.map((item, index) => (
          <button
            aria-current={index === renderedIndex ? "true" : undefined}
            aria-label={`Show slide ${index + 1}: ${itemLabel(item)}`}
            key={`${item.kind}-${item.story.id}`}
            onClick={() => show(index, index >= renderedIndex ? 1 : -1)}
            type="button"
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
