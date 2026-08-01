"use client";

import { Check, CircleAlert, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { type KeyboardEvent, useRef, useState } from "react";

import { motionTransitions } from "@/app/lib/motion/tokens";
import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

import { heroScenarios } from "./hero-scenarios";
import { useMatchingScenario } from "./matching-demo-store";
import { HeroMotionLoader } from "./motion/hero-motion-loader";

type PlaybackState = "complete" | "paused" | "playing";

export function HeroMatcher() {
  const [scenario, , setScenarioIndex] = useMatchingScenario();
  const [playback, setPlayback] = useState<PlaybackState>("playing");
  const [run, setRun] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { allowMotion, reduceMotion } = useMotionPolicy();
  const isPlaying = allowMotion && playback === "playing";

  const chooseScenario = (index: number) => {
    setScenarioIndex(index);
    setRun((value) => value + 1);
    setPlayback(allowMotion ? "playing" : "paused");
  };

  const handleScenarioKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % heroScenarios.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + heroScenarios.length) % heroScenarios.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = heroScenarios.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    chooseScenario(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  const togglePlayback = () => {
    if (!allowMotion) return;
    if (playback === "playing") {
      setPlayback("paused");
      return;
    }
    if (playback === "complete") setRun((value) => value + 1);
    setPlayback("playing");
  };

  const replay = () => {
    setRun((value) => value + 1);
    setPlayback(allowMotion ? "playing" : "paused");
  };

  return (
    <div
      aria-label="Interactive example of a student profile becoming ranked scholarship matches"
      className="hero-matcher"
      data-hero-motion
      data-motion={reduceMotion ? "reduced" : "full"}
      data-playback={reduceMotion ? "static" : playback}
      data-scenario={scenario.id}
      data-testid="hero-matcher"
      role="region"
    >
      <div className="hero-matcher__topbar">
        <div>
          <span className="status-dot" aria-hidden="true" />
          <strong>Profile-to-match preview</strong>
        </div>
        <span>Illustrative data only</span>
      </div>

      <div className="hero-matcher__toolbar">
        <div
          aria-label="Example student profile"
          className="hero-matcher__scenarios"
          role="tablist"
        >
          {heroScenarios.map((item, index) => (
            <motion.button
              aria-controls="hero-scenario-panel"
              aria-selected={scenario.id === item.id}
              id={`hero-scenario-tab-${item.id}`}
              key={item.id}
              onClick={() => chooseScenario(index)}
              onKeyDown={(event) => handleScenarioKeyDown(event, index)}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              tabIndex={scenario.id === item.id ? 0 : -1}
              transition={motionTransitions.instant}
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              {item.label}
            </motion.button>
          ))}
        </div>

        <div aria-label="Demo playback" className="hero-matcher__controls">
          <button onClick={togglePlayback} type="button">
            <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            {isPlaying
              ? "Pause"
              : playback === "complete"
                ? "Play again"
                : "Play"}
          </button>
          <button onClick={replay} type="button">
            <span aria-hidden="true">↻</span>
            Replay
          </button>
        </div>
      </div>

      <div
        aria-labelledby={`hero-scenario-tab-${scenario.id}`}
        className="hero-matcher__canvas"
        id="hero-scenario-panel"
        role="tabpanel"
      >
        <svg
          aria-hidden="true"
          className="hero-matcher__path"
          preserveAspectRatio="none"
          viewBox="0 0 1000 210"
        >
          <path d="M95 135 C 250 30, 365 185, 505 105 S 760 20, 915 112" />
          <path
            className="hero-matcher__path-accent"
            d="M95 135 C 250 30, 365 185, 505 105 S 760 20, 915 112"
            pathLength="1"
          />
        </svg>

        <section
          aria-labelledby="hero-profile-facts"
          className="hero-matcher__column"
        >
          <div className="hero-matcher__column-heading">
            <span>01</span>
            <h2 id="hero-profile-facts">Profile facts</h2>
          </div>
          <ul className="hero-matcher__fact-list">
            {scenario.facts.map((fact) => (
              <li className="hero-matcher__fact-token" key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="hero-eligibility-checks"
          className="hero-matcher__column"
        >
          <div className="hero-matcher__column-heading">
            <span>02</span>
            <h2 id="hero-eligibility-checks">Eligibility checks</h2>
          </div>
          <ul className="hero-matcher__gate-list">
            {scenario.gates.map((gate) => (
              <li
                className="hero-matcher__gate"
                data-state={gate.state}
                key={gate.label}
              >
                {gate.state === "confirmed" ? (
                  <Check aria-hidden="true" size={14} strokeWidth={2.7} />
                ) : (
                  <CircleAlert aria-hidden="true" size={14} />
                )}
                <span>{gate.label}</span>
                <strong>{gate.result}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="hero-ranked-matches"
          className="hero-matcher__column"
        >
          <div className="hero-matcher__column-heading">
            <span>03</span>
            <h2 id="hero-ranked-matches">Ranked matches</h2>
          </div>
          <div className="hero-matcher__match-list">
            {scenario.matches.map((match, index) => (
              <motion.article
                className="hero-matcher__match-card"
                data-rank={index + 1}
                key={match.id}
                layout={!reduceMotion}
                layoutId={`hero-match-${match.id}`}
                transition={
                  reduceMotion ? { duration: 0 } : motionTransitions.standard
                }
              >
                <div>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {index === 0 ? (
                    <Sparkles aria-hidden="true" size={14} />
                  ) : null}
                </div>
                <h3>{match.title}</h3>
                <ul>
                  {match.reasons.map((reason) => (
                    <li key={reason}>
                      <Check aria-hidden="true" size={12} />
                      {reason}
                    </li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>
        </section>
      </div>

      <p
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {scenario.summary}
      </p>
      <HeroMotionLoader
        animationKey={`${scenario.id}-${run}`}
        onComplete={() => setPlayback("complete")}
        playing={isPlaying}
      />
    </div>
  );
}
