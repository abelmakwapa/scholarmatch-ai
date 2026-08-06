"use client";

import { useState } from "react";

import { heroScenarios } from "./hero-scenarios";
import { useMatchingScenario } from "./matching-demo-store";

type WorkspaceStep = 1 | 2 | 3;

export function MatchingWorkspace() {
  const { scenario, scenarioIndex, setScenarioIndex } = useMatchingScenario();
  const [step, setStep] = useState<WorkspaceStep>(3);
  const [announcement, setAnnouncement] = useState("");
  const checksReady = step > 1;
  const matchesReady = step > 2;

  const chooseScenario = (index: number) => {
    setScenarioIndex(index);
    setStep(3);
    setAnnouncement(heroScenarios[index].summary);
  };

  const advance = () => {
    const nextStep = (step === 3 ? 1 : step + 1) as WorkspaceStep;
    setStep(nextStep);
    setAnnouncement(
      nextStep === 1
        ? "Workspace reset to the student profile."
        : nextStep === 2
          ? `Eligibility checks complete for the ${scenario.label.toLowerCase()} profile.`
          : scenario.summary,
    );
  };

  const actionLabel =
    step === 1
      ? "Check eligibility"
      : step === 2
        ? "Rank matches"
        : "Start over";

  return (
    <div
      aria-label="Interactive ScholarMatch workspace"
      className="matching-workbench"
      data-eligibility-pipeline
      data-step={step}
      id="how-it-works"
      role="region"
    >
      <div className="matching-workbench__topbar">
        <div>
          <span className="status-dot" />
          <strong>ScholarMatch workspace</strong>
        </div>
        <span>Step {step} of 3 · Illustrative interface</span>
      </div>

      <div className="matching-workbench__toolbar">
        <label>
          Example profile
          <select
            aria-label="Workspace student profile"
            onChange={(event) => chooseScenario(Number(event.target.value))}
            value={scenarioIndex}
          >
            {heroScenarios.map((item, index) => (
              <option key={item.id} value={index}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="matching-workbench__action"
          onClick={advance}
          type="button"
        >
          {actionLabel}
        </button>
      </div>

      <ol
        aria-label="Workspace progress"
        className="matching-workbench__progress"
      >
        {["Profile", "Eligibility", "Ranking"].map((label, index) => (
          <li
            aria-current={step === index + 1 ? "step" : undefined}
            key={label}
          >
            <span>0{index + 1}</span>
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
            <span className="workbench-icon" aria-hidden="true">
              01
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
                <i aria-hidden="true">✓</i>
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
            <span className="workbench-icon" aria-hidden="true">
              02
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
                  className={`rule-path__item rule-path__item--${
                    checksReady ? gate.state : "pending"
                  }`}
                >
                  <i aria-hidden="true">
                    {checksReady && gate.state === "confirmed" ? "✓" : "!"}
                  </i>
                  <span>{gate.label}</span>
                  <strong>
                    {checksReady ? gate.result : "Ready to check"}
                  </strong>
                </div>
                {index < 2 ? (
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
            <span
              className="workbench-icon workbench-icon--accent"
              aria-hidden="true"
            >
              03
            </span>
            <div>
              <p>Step 03</p>
              <h3>Ranked matches</h3>
            </div>
          </div>
          {matchesReady ? (
            <div className="match-result-stack" key={scenario.id}>
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
            </div>
          ) : (
            <div className="workbench-pending">
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
