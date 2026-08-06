"use client";

import {
  ArrowRight,
  Check,
  CircleAlert,
  Fingerprint,
  ListFilter,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import { motionTransitions } from "@/app/lib/motion/tokens";
import { useMotionPolicy } from "@/app/lib/motion/use-motion-policy";

import { heroScenarios } from "./hero-scenarios";
import { useMatchingScenario } from "./matching-demo-store";

type WorkspaceStep = 1 | 2 | 3;

export function MatchingWorkspace() {
  const { scenario, scenarioIndex, setScenarioIndex } = useMatchingScenario();
  const [activeStep, setActiveStep] = useState<WorkspaceStep>(3);
  const [announcement, setAnnouncement] = useState("");
  const { reduceMotion } = useMotionPolicy();
  const checksReady = activeStep >= 2;
  const matchesReady = activeStep >= 3;

  const chooseScenario = (index: number) => {
    setScenarioIndex(index);
    setActiveStep(3);
    setAnnouncement(heroScenarios[index].summary);
  };

  const advance = () => {
    if (activeStep === 3) {
      setActiveStep(1);
      setAnnouncement("Workspace reset to the student profile.");
    } else if (activeStep === 1) {
      setActiveStep(2);
      setAnnouncement(
        `Eligibility checks complete for the ${scenario.label.toLowerCase()} profile.`,
      );
    } else {
      setActiveStep(3);
      setAnnouncement(scenario.summary);
    }
  };

  const actionLabel =
    activeStep === 1
      ? "Check eligibility"
      : activeStep === 2
        ? "Rank matches"
        : "Start over";

  return (
    <div
      aria-label="Interactive ScholarMatch workspace"
      className="matching-workbench"
      data-eligibility-pipeline
      data-step={activeStep}
      id="how-it-works"
      role="region"
    >
      <div className="matching-workbench__topbar">
        <div>
          <span className="status-dot" />
          <strong>ScholarMatch workspace</strong>
        </div>
        <span>Step {activeStep} of 3 · Illustrative interface</span>
      </div>

      <div className="matching-workbench__toolbar">
        <div
          aria-label="Workspace student profile"
          className="matching-workbench__scenarios"
          role="group"
        >
          {heroScenarios.map((item, index) => (
            <motion.button
              aria-pressed={scenarioIndex === index}
              key={item.id}
              onClick={() => chooseScenario(index)}
              transition={motionTransitions.instant}
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              {item.label}
            </motion.button>
          ))}
        </div>
        <button
          className="matching-workbench__action"
          onClick={advance}
          type="button"
        >
          {activeStep === 3 ? (
            <RotateCcw aria-hidden="true" size={15} />
          ) : (
            <ArrowRight aria-hidden="true" size={15} />
          )}
          {actionLabel}
        </button>
      </div>

      <ol
        aria-label="Workspace progress"
        className="matching-workbench__progress"
      >
        {["Profile", "Eligibility", "Ranking"].map((label, index) => (
          <li
            aria-current={activeStep === index + 1 ? "step" : undefined}
            key={label}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="matching-workbench__grid">
        <article
          className="workbench-panel workbench-profile"
          data-active="true"
        >
          <div className="workbench-panel__heading">
            <span className="workbench-icon">
              <Fingerprint aria-hidden="true" size={18} />
            </span>
            <div>
              <p>Step 01</p>
              <h3>Profile facts</h3>
            </div>
          </div>
          <div className="profile-fact-list">
            {scenario.facts.map((fact) => (
              <div className="profile-fact" key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
                <Check aria-hidden="true" size={15} />
              </div>
            ))}
          </div>
          <p className="workbench-caption">
            You control the facts. Missing information stays visible.
          </p>
        </article>

        <article
          aria-label={
            checksReady ? "Eligibility results" : "Eligibility checks waiting"
          }
          className="workbench-panel workbench-rules"
          data-active={checksReady}
        >
          <div className="workbench-panel__heading">
            <span className="workbench-icon">
              <ListFilter aria-hidden="true" size={18} />
            </span>
            <div>
              <p>Step 02</p>
              <h3>Eligibility checks</h3>
            </div>
          </div>
          <div className="rule-path" aria-label="Eligibility check sequence">
            {scenario.gates.map((gate, index) => (
              <div key={gate.label}>
                <div
                  className={`rule-path__item ${
                    checksReady
                      ? gate.state === "confirmed"
                        ? "rule-path__item--pass"
                        : "rule-path__item--unknown"
                      : "rule-path__item--pending"
                  }`}
                >
                  {checksReady && gate.state === "confirmed" ? (
                    <Check aria-hidden="true" size={15} />
                  ) : (
                    <CircleAlert aria-hidden="true" size={15} />
                  )}
                  <span>{gate.label}</span>
                  <strong>
                    {checksReady ? gate.result : "Ready to check"}
                  </strong>
                </div>
                {index < scenario.gates.length - 1 ? (
                  <div className="rule-path__line" aria-hidden="true" />
                ) : null}
              </div>
            ))}
          </div>
          <p className="workbench-caption">
            Hard rules filter first. Review items stay visible instead of
            becoming rejection.
          </p>
        </article>

        <article
          aria-label={
            matchesReady ? "Ranked results" : "Ranked results waiting"
          }
          className="workbench-panel workbench-matches"
          data-active={matchesReady}
        >
          <div className="workbench-panel__heading">
            <span className="workbench-icon workbench-icon--accent">
              <Sparkles aria-hidden="true" size={18} />
            </span>
            <div>
              <p>Step 03</p>
              <h3>Ranked matches</h3>
            </div>
          </div>
          {matchesReady ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="match-result-stack"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              key={scenario.id}
              transition={
                reduceMotion ? { duration: 0 } : motionTransitions.standard
              }
            >
              <div className="match-result-card">
                <div>
                  <span>01</span>
                  <p>Ranked first for this profile</p>
                </div>
                <strong>{scenario.matches[0].title}</strong>
                <ul>
                  {scenario.matches[0].reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div className="match-result-card match-result-card--muted">
                <div>
                  <span>02</span>
                  <p>{scenario.matches[1].title}</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="workbench-pending">
              <Sparkles aria-hidden="true" size={20} />
              <strong>Ranking waits for eligibility.</strong>
              <p>
                Complete the checks to reveal ordered matches and their reasons.
              </p>
            </div>
          )}
        </article>
      </div>

      <p
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {announcement}
      </p>
    </div>
  );
}
