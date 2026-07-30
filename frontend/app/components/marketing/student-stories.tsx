"use client";

import { ArrowLeft, ArrowRight, MessageCircleMore } from "lucide-react";
import { useState } from "react";

import type { StudentStory } from "./data";

type StudentStoriesProps = {
  stories: StudentStory[];
};

export function StudentStories({ stories }: StudentStoriesProps) {
  const [activeIndex, setActiveIndex] = useState(0);

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
        <figure key={activeStory.id}>
          <blockquote>“{activeStory.quote}”</blockquote>
          <figcaption>
            <strong>{activeStory.name}</strong>
            <span>{activeStory.context}</span>
          </figcaption>
        </figure>
      </div>

      <div className="stories-carousel__controls">
        <p aria-live="polite">
          {activeIndex + 1} / {stories.length}
        </p>
        <div>
          <button
            aria-label="Previous student story"
            onClick={showPrevious}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
          <button
            aria-label="Next student story"
            onClick={showNext}
            type="button"
          >
            <ArrowRight aria-hidden="true" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
