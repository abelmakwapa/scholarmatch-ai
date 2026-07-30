import { Check, Sparkles } from "lucide-react";

import { HeroMotionLoader } from "./motion/hero-motion-loader";

const facts = ["Study level", "Academic record", "Interests"];

export function HeroMatcher() {
  return (
    <div
      aria-label="Illustration of profile facts becoming an explainable scholarship match"
      className="hero-matcher"
      data-hero-motion
      data-motion="system"
      data-testid="hero-matcher"
      role="img"
    >
      <div className="hero-matcher__label">
        <span>Illustrative interface</span>
        <span aria-hidden="true">•</span>
        <span>No live student data</span>
      </div>

      <div className="hero-matcher__stage">
        <div className="hero-matcher__profile">
          <span className="hero-matcher__avatar" aria-hidden="true">
            SM
          </span>
          <div>
            <strong>Your profile</strong>
            <span>One secure set of facts</span>
          </div>
        </div>

        <div className="hero-matcher__rail" aria-hidden="true">
          <span />
          <i>
            <Sparkles size={15} />
          </i>
        </div>

        <div className="hero-matcher__result">
          <span className="hero-matcher__result-icon" aria-hidden="true">
            <Check size={16} strokeWidth={3} />
          </span>
          <div>
            <strong>Eligibility checked</strong>
            <span>Fit explained before you apply</span>
          </div>
        </div>
      </div>

      <div className="hero-matcher__facts" aria-hidden="true">
        {facts.map((fact, index) => (
          <span data-direction={index % 2 ? "up" : "down"} key={fact}>
            {fact}
          </span>
        ))}
      </div>
      <HeroMotionLoader />
    </div>
  );
}
