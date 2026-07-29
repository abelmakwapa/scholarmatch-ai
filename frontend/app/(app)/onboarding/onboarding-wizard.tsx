"use client";

import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { FormStatus } from "@/app/components/forms/form-status";
import { SubmitButton } from "@/app/components/forms/submit-button";
import { ProgressIndicator } from "@/app/(app)/onboarding/progress-indicator";
import { ReviewStep } from "@/app/(app)/onboarding/review-step";
import {
  ConsentStep,
  EducationStep,
  ExperienceStep,
  FieldStep,
  GoalsStep,
  IdentityStep,
  LocationStep,
  PreferencesStep,
  ResultsStep,
  type StepViewProps,
} from "@/app/(app)/onboarding/step-views";
import { ApiError } from "@/app/lib/api/errors";
import type { ProfileWrite } from "@/app/lib/api/client";
import { draftToProfileWrite } from "@/app/lib/onboarding/serialize";
import {
  PROGRESS_STEPS,
  STEP_ORDER,
  firstIncompleteStep,
  stepIndex,
  stepMeta,
  type StepId,
} from "@/app/lib/onboarding/steps";
import { makeProgress, type OnboardingStore } from "@/app/lib/onboarding/store";
import type {
  OnboardingDraft,
  OnboardingProgress,
} from "@/app/lib/onboarding/types";
import {
  validateStep,
  type FieldErrors,
} from "@/app/lib/onboarding/validation";
import { useOnlineStatus } from "@/app/lib/hooks/use-online-status";

export type StepNavigation = {
  currentStep: StepId | null;
  goToStep: (step: StepId, options?: { replace?: boolean }) => void;
};

type SaveState = "idle" | "saving" | "saved" | "local-only";

type OnboardingWizardProps = {
  store: OnboardingStore;
  navigation: StepNavigation;
  /** Persists the profile; must throw an {@link ApiError} on failure. */
  submitProfile: (body: ProfileWrite) => Promise<void>;
  onComplete: () => void;
  onSessionExpired: () => void;
  initialProgress: OnboardingProgress | null;
};

const STEP_COMPONENTS: Record<
  Exclude<StepId, "review">,
  (props: StepViewProps) => React.JSX.Element
> = {
  consent: ConsentStep,
  identity: IdentityStep,
  location: LocationStep,
  education: EducationStep,
  field: FieldStep,
  results: ResultsStep,
  goals: GoalsStep,
  experience: ExperienceStep,
  preferences: PreferencesStep,
};

export function OnboardingWizard({
  store,
  navigation,
  submitProfile,
  onComplete,
  onSessionExpired,
  initialProgress,
}: OnboardingWizardProps) {
  const online = useOnlineStatus();
  const [draft, setDraft] = useState<OnboardingDraft>(
    initialProgress?.draft ?? {},
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [advancing, setAdvancing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const resumeStep = firstIncompleteStep(draft);
  const resumeIndex = stepIndex(resumeStep);

  // Resolve the effective step: fall back to the resume point, and never allow
  // jumping past the first incomplete step (protects against manual URL edits
  // and stale forward navigation).
  const requested = navigation.currentStep;
  const clampedStep: StepId =
    requested && stepIndex(requested) <= resumeIndex ? requested : resumeStep;

  // Keep the URL in sync with the clamped step without corrupting history.
  useEffect(() => {
    if (navigation.currentStep !== clampedStep) {
      navigation.goToStep(clampedStep, { replace: true });
    }
  }, [navigation, clampedStep]);

  // Move focus to the step heading on each step change for screen-reader users.
  useEffect(() => {
    headingRef.current?.focus();
    if (
      typeof window !== "undefined" &&
      typeof window.scrollTo === "function"
    ) {
      try {
        window.scrollTo({ top: 0, behavior: "auto" });
      } catch {
        // Not all environments implement scrollTo (e.g. jsdom in tests).
      }
    }
  }, [clampedStep]);

  const meta = stepMeta(clampedStep);
  const currentIndex = stepIndex(clampedStep);
  const isReview = clampedStep === "review";
  const isFirst = currentIndex === 0;

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      if (Object.keys(current).length === 0) return current;
      const nextErrors = { ...current };
      for (const key of Object.keys(patch)) {
        delete nextErrors[key];
      }
      return nextErrors;
    });
    setSaveState("idle");
  }, []);

  const focusFirstError = useCallback(() => {
    const node = bodyRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    node?.focus();
  }, []);

  const persist = useCallback(
    async (nextDraft: OnboardingDraft, completedStep: StepId) => {
      setSaveState("saving");
      const { remote } = await store.save(
        makeProgress(nextDraft, completedStep),
      );
      setSaveState(remote ? "saved" : "local-only");
    },
    [store],
  );

  const handleContinue = useCallback(async () => {
    if (advancing) return; // guard against double submission
    const stepErrors = validateStep(clampedStep, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      requestAnimationFrame(focusFirstError);
      return;
    }
    setErrors({});
    setAdvancing(true);
    try {
      await persist(draft, clampedStep);
    } finally {
      setAdvancing(false);
    }
    const nextStep = STEP_ORDER[currentIndex + 1];
    if (nextStep) navigation.goToStep(nextStep);
  }, [
    advancing,
    clampedStep,
    currentIndex,
    draft,
    focusFirstError,
    navigation,
    persist,
  ]);

  const handleBack = useCallback(() => {
    const prevStep = STEP_ORDER[currentIndex - 1];
    if (prevStep) navigation.goToStep(prevStep);
  }, [currentIndex, navigation]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    const incomplete = firstIncompleteStep(draft);
    if (incomplete !== "review") {
      navigation.goToStep(incomplete);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitProfile(draftToProfileWrite(draft));
      await store.clear();
      onComplete();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.kind === "unauthorized") {
          onSessionExpired();
          return;
        }
        setSubmitError(error);
      } else {
        setSubmitError(
          new ApiError({
            kind: "unknown",
            status: 0,
            message:
              "Something went wrong. Your answers are saved — try again.",
          }),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    draft,
    navigation,
    onComplete,
    onSessionExpired,
    store,
    submitProfile,
    submitting,
  ]);

  const furthestReachableIndex = Math.min(
    PROGRESS_STEPS.findIndex((step) => step.id === resumeStep) === -1
      ? PROGRESS_STEPS.length - 1
      : PROGRESS_STEPS.findIndex((step) => step.id === resumeStep),
    PROGRESS_STEPS.length - 1,
  );

  const StepComponent = isReview
    ? null
    : STEP_COMPONENTS[clampedStep as Exclude<StepId, "review">];

  return (
    <div className="onboarding">
      <ProgressIndicator
        currentStep={clampedStep}
        furthestReachableIndex={furthestReachableIndex}
        onStepSelect={(step) => navigation.goToStep(step)}
      />

      <div className="onboarding__panel">
        <div className="onboarding__head">
          {meta.sensitive ? (
            <span className="onboarding__sensitive">
              <Lock aria-hidden="true" size={13} />
              Sensitive · handled with care
            </span>
          ) : null}
          <h2 ref={headingRef} tabIndex={-1} className="onboarding__title">
            {meta.title}
          </h2>
          <p className="onboarding__help">{meta.help}</p>
        </div>

        {!online ? (
          <FormStatus tone="offline">
            You&rsquo;re offline. Your answers are saved on this device and will
            sync when you reconnect.
          </FormStatus>
        ) : null}
        {submitError ? (
          <FormStatus tone="error">{submitError.message}</FormStatus>
        ) : null}

        <form
          className="onboarding__form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (isReview) {
              void handleSubmit();
            } else {
              void handleContinue();
            }
          }}
        >
          <div className="onboarding__body" ref={bodyRef}>
            {isReview ? (
              <ReviewStep
                draft={draft}
                onEdit={(step) => navigation.goToStep(step)}
              />
            ) : StepComponent ? (
              <StepComponent draft={draft} errors={errors} update={update} />
            ) : null}
          </div>

          <p className="onboarding__save" aria-live="polite">
            {saveState === "saving"
              ? "Saving your progress…"
              : saveState === "saved"
                ? "Progress saved — you can safely resume on any device."
                : saveState === "local-only"
                  ? "Saved on this device. It will sync when you reconnect."
                  : ""}
          </p>

          <div className="onboarding__controls">
            <button
              type="button"
              className="onboarding__back"
              onClick={handleBack}
              disabled={isFirst || advancing || submitting}
            >
              <ArrowLeft aria-hidden="true" size={16} />
              Back
            </button>

            {isReview ? (
              <SubmitButton pending={submitting} pendingLabel="Submitting…">
                Submit profile
              </SubmitButton>
            ) : (
              <SubmitButton
                pending={advancing}
                pendingLabel="Saving…"
                aria-label={meta.optional ? "Continue" : undefined}
              >
                Continue
                <ArrowRight aria-hidden="true" size={16} />
              </SubmitButton>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
