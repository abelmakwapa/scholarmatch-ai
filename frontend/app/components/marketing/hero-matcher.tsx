"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";

const facts = ["Study level", "Academic record", "Interests"];

export function HeroMatcher() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-label="Illustration of profile facts becoming an explainable scholarship match"
      className="hero-matcher"
      data-motion={prefersReducedMotion ? "reduced" : "animated"}
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
          <motion.i
            animate={
              prefersReducedMotion ? undefined : { left: ["0%", "88%", "0%"] }
            }
            transition={{ duration: 5.2, ease: "easeInOut", repeat: Infinity }}
          >
            <Sparkles size={15} />
          </motion.i>
        </div>

        <motion.div
          className="hero-matcher__result"
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  boxShadow: [
                    "0 0 0 0 rgba(240,215,255,0)",
                    "0 0 0 10px rgba(240,215,255,.45)",
                    "0 0 0 0 rgba(240,215,255,0)",
                  ],
                }
          }
          transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.2 }}
        >
          <span className="hero-matcher__result-icon" aria-hidden="true">
            <Check size={16} strokeWidth={3} />
          </span>
          <div>
            <strong>Eligibility checked</strong>
            <span>Fit explained before you apply</span>
          </div>
        </motion.div>
      </div>

      <div className="hero-matcher__facts" aria-hidden="true">
        {facts.map((fact, index) => (
          <motion.span
            animate={
              prefersReducedMotion
                ? undefined
                : { y: [0, index % 2 ? -5 : 5, 0] }
            }
            key={fact}
            transition={{
              duration: 3 + index * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {fact}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
