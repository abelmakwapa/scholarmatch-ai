"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { MatchResponse } from "@/app/lib/api/client";
import {
  SCORE_DIMENSIONS,
  SCORE_LABELS,
  formatScore,
} from "@/app/lib/matches/presentation";

export function ScoreBreakdown({ match }: { match: MatchResponse }) {
  const [open, setOpen] = useState(true);
  const reduceMotion = useReducedMotion();

  return (
    <section
      className="score-breakdown"
      data-motion={reduceMotion ? "reduced" : "full"}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="score-breakdown-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <small>Total fit score</small>
          <strong>{formatScore(match.score)}</strong>
        </span>
        <span>
          View score breakdown <ChevronDown aria-hidden="true" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="score-breakdown-panel"
            className="score-breakdown__panel"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            <p>
              Each dimension measures profile fit. None predicts whether you
              will receive an award.
            </p>
            <dl>
              {SCORE_DIMENSIONS.map((dimension) => {
                const component = match.score_components.find(
                  (item) => item.name === dimension,
                );
                return (
                  <div key={dimension}>
                    <dt>
                      <span>{SCORE_LABELS[dimension]}</span>
                      <small>
                        {component
                          ? `${Math.round(component.weight * 100)}% weight`
                          : "Not scored"}
                      </small>
                    </dt>
                    <dd>
                      <span className="score-track" aria-hidden="true">
                        <span
                          style={{
                            width: `${component ? component.score * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <strong>
                        {component ? formatScore(component.score) : "Unknown"}
                      </strong>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
