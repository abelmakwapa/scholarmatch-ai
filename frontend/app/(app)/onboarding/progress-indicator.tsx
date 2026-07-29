"use client";

import { Check } from "lucide-react";

import { PROGRESS_STEPS, type StepId } from "@/app/lib/onboarding/steps";

type ProgressIndicatorProps = {
  currentStep: StepId;
  /** Index (within PROGRESS_STEPS) of the furthest reachable step. */
  furthestReachableIndex: number;
  onStepSelect: (step: StepId) => void;
};

/**
 * A visible, keyboard-navigable progress indicator. Completed steps are
 * revisitable; steps ahead of the student's progress are disabled so the flow
 * cannot be skipped.
 */
export function ProgressIndicator({
  currentStep,
  furthestReachableIndex,
  onStepSelect,
}: ProgressIndicatorProps) {
  const currentIndex = PROGRESS_STEPS.findIndex(
    (step) => step.id === currentStep,
  );
  const total = PROGRESS_STEPS.length;
  const humanCurrent = Math.min(currentIndex + 1, total);

  return (
    <nav aria-label="Onboarding progress" className="onboarding-progress">
      <p className="onboarding-progress__count">
        Step {humanCurrent} of {total}
      </p>
      <ol className="onboarding-progress__list">
        {PROGRESS_STEPS.map((step, index) => {
          const state =
            index < currentIndex
              ? "complete"
              : index === currentIndex
                ? "current"
                : "upcoming";
          const reachable = index <= furthestReachableIndex;
          return (
            <li
              className="onboarding-progress__item"
              data-state={state}
              key={step.id}
            >
              <button
                type="button"
                className="onboarding-progress__dot"
                onClick={() => onStepSelect(step.id)}
                disabled={!reachable}
                aria-current={state === "current" ? "step" : undefined}
              >
                <span
                  className="onboarding-progress__marker"
                  aria-hidden="true"
                >
                  {state === "complete" ? <Check size={12} /> : index + 1}
                </span>
                <span className="onboarding-progress__label">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
