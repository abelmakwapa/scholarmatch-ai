"use client";

import { heroScenarios } from "./hero-scenarios";
import { useMatchingScenario } from "./matching-demo-store";

export function MatchingWorkspace() {
  const [scenario, scenarioIndex, setScenarioIndex] = useMatchingScenario();

  return (
    <div
      aria-label="Interactive ScholarMatch workspace"
      className="matching-workbench"
      data-eligibility-pipeline
      role="region"
    >
      <div className="matching-workbench__topbar">
        <div>
          <span className="status-dot" />
          <strong>ScholarMatch workspace</strong>
        </div>
        <span>Illustrative interface</span>
      </div>

      <div className="matching-workbench__toolbar">
        <label>
          Example profile
          <select
            onChange={(event) => setScenarioIndex(Number(event.target.value))}
            value={scenarioIndex}
          >
            {heroScenarios.map((item, index) => (
              <option key={item.id} value={index}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="matching-workbench__grid">
        <article className="workbench-panel workbench-profile">
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

        <article className="workbench-panel workbench-rules">
          <div className="workbench-panel__heading">
            <span className="workbench-icon" aria-hidden="true">
              02
            </span>
            <div>
              <p>Step 02</p>
              <h3>Eligibility checks</h3>
            </div>
          </div>
          <div className="rule-path">
            {scenario.gates.map((gate) => (
              <div
                className={`rule-path__item rule-path__item--${gate.state}`}
                key={gate.label}
              >
                <i aria-hidden="true">
                  {gate.state === "confirmed" ? "✓" : "!"}
                </i>
                <span>{gate.label}</span>
                <strong>{gate.result}</strong>
              </div>
            ))}
          </div>
          <p className="workbench-caption">
            Hard rules filter first. Review items stay visible instead of
            becoming rejection.
          </p>
        </article>

        <article className="workbench-panel workbench-matches">
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
        </article>
      </div>
    </div>
  );
}
