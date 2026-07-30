"use client";

import { ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type KeyboardEvent, useRef, useState } from "react";

import { motionDistances, motionTransitions } from "@/app/lib/motion/tokens";
import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

import { useCases } from "./data";

export function UseCaseTabs() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { reduceMotion } = useMotionPolicy();
  const selected = useCases[selectedIndex];

  const selectAndFocus = (index: number) => {
    setSelectedIndex(index);
    tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectAndFocus((index + 1) % useCases.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectAndFocus((index - 1 + useCases.length) % useCases.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectAndFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectAndFocus(useCases.length - 1);
    }
  };

  return (
    <div className="use-case-tabs">
      <div
        aria-label="Student use cases"
        className="use-case-tabs__list"
        role="tablist"
      >
        {useCases.map((useCase, index) => (
          <motion.button
            aria-controls={`panel-${useCase.id}`}
            aria-selected={selectedIndex === index}
            id={`tab-${useCase.id}`}
            key={useCase.id}
            onClick={() => setSelectedIndex(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            role="tab"
            tabIndex={selectedIndex === index ? 0 : -1}
            transition={motionTransitions.instant}
            type="button"
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          >
            {useCase.label}
            {selectedIndex === index ? (
              <motion.span
                aria-hidden="true"
                className="use-case-tabs__indicator"
                layoutId="use-case-active"
                transition={
                  reduceMotion ? { duration: 0 } : motionTransitions.standard
                }
              />
            ) : null}
          </motion.button>
        ))}
      </div>

      <div className="use-case-tabs__viewport">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            aria-labelledby={`tab-${selected.id}`}
            className="use-case-panel"
            exit={
              reduceMotion
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: -motionDistances.small }
            }
            id={`panel-${selected.id}`}
            initial={
              reduceMotion ? false : { opacity: 0, y: motionDistances.medium }
            }
            key={selected.id}
            role="tabpanel"
            transition={
              reduceMotion ? { duration: 0 } : motionTransitions.reveal
            }
          >
            <div className="use-case-panel__copy">
              <span className="use-case-panel__icon" aria-hidden="true">
                <selected.icon size={24} strokeWidth={1.8} />
              </span>
              <p className="eyebrow">{selected.signal}</p>
              <h3>{selected.title}</h3>
              <p>{selected.description}</p>
              <a href="#how-it-works">
                See how matching works{" "}
                <ArrowRight aria-hidden="true" size={17} />
              </a>
            </div>

            <div
              aria-label={`${selected.label} profile signals`}
              className="use-case-panel__visual"
            >
              <span className="use-case-panel__visual-label">
                Profile signals
              </span>
              {selected.facts.map((fact, index) => (
                <motion.div
                  className="use-case-panel__fact"
                  key={fact}
                  layout={!reduceMotion}
                  transition={
                    reduceMotion ? { duration: 0 } : motionTransitions.standard
                  }
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{fact}</strong>
                  <Check aria-hidden="true" size={16} />
                </motion.div>
              ))}
              <div className="use-case-panel__match">
                <span>Ready to compare</span>
                <strong>{selected.signal}</strong>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
