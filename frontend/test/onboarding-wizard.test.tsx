import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";

import {
  OnboardingWizard,
  type StepNavigation,
} from "@/app/(app)/onboarding/onboarding-wizard";
import { ApiError } from "@/app/lib/api/errors";
import { makeProgress, type OnboardingStore } from "@/app/lib/onboarding/store";
import type { StepId } from "@/app/lib/onboarding/steps";
import {
  PREFER_NOT_TO_SAY,
  UNKNOWN,
  type OnboardingDraft,
} from "@/app/lib/onboarding/types";

function completeDraft(
  overrides: Partial<OnboardingDraft> = {},
): OnboardingDraft {
  return {
    consentAccepted: true,
    fullName: "Ada Lovelace",
    countryOfResidence: "GB",
    studyLevel: "undergraduate",
    fieldOfStudyUndecided: true,
    gpa: UNKNOWN,
    interests: ["mathematics"],
    experienceStatus: "none",
    ...overrides,
  };
}

function fakeStore(overrides: Partial<OnboardingStore> = {}): OnboardingStore {
  return {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue({ remote: true }),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

type HarnessProps = {
  store?: OnboardingStore;
  submitProfile?: (body: unknown) => Promise<void>;
  onComplete?: () => void;
  onSessionExpired?: () => void;
  initialProgress?: ReturnType<typeof makeProgress> | null;
  initialStep?: StepId | null;
};

function Harness({
  store = fakeStore(),
  submitProfile = vi.fn().mockResolvedValue(undefined),
  onComplete = vi.fn(),
  onSessionExpired = vi.fn(),
  initialProgress = null,
  initialStep = null,
}: HarnessProps) {
  const [step, setStep] = useState<StepId | null>(initialStep);
  const navigation: StepNavigation = {
    currentStep: step,
    goToStep: (next) => setStep(next),
  };
  return (
    <OnboardingWizard
      store={store}
      navigation={navigation}
      submitProfile={submitProfile}
      onComplete={onComplete}
      onSessionExpired={onSessionExpired}
      initialProgress={initialProgress}
    />
  );
}

describe("OnboardingWizard", () => {
  test("blocks Continue on the consent gate until consent is given", async () => {
    const user = userEvent.setup();
    const store = fakeStore();
    render(<Harness store={store} />);

    // Resumes to the consent step for an empty draft.
    expect(
      await screen.findByRole("heading", { name: "Before we begin" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(
      await screen.findByText(
        "Please confirm you understand how your information is used to continue.",
      ),
    ).toBeInTheDocument();
    expect(store.save).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /I understand how my information is used/,
      }),
    );
    await user.click(screen.getByRole("button", { name: /Continue/ }));

    // Advances to identity and persists the completed step.
    expect(
      await screen.findByRole("heading", { name: "What should we call you?" }),
    ).toBeInTheDocument();
    expect(store.save).toHaveBeenCalledOnce();
  });

  test("resumes at the first incomplete step of a saved draft", async () => {
    const draft = completeDraft({ gpa: undefined }); // results is unanswered
    render(<Harness initialProgress={makeProgress(draft, "field")} />);

    expect(
      await screen.findByRole("heading", { name: "Your academic results" }),
    ).toBeInTheDocument();
  });

  test("submits a complete profile and completes onboarding", async () => {
    const user = userEvent.setup();
    const submitProfile = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();
    const store = fakeStore();
    render(
      <Harness
        store={store}
        submitProfile={submitProfile}
        onComplete={onComplete}
        initialProgress={makeProgress(completeDraft(), "experience")}
        initialStep="review"
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Submit profile" }),
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(submitProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: "Ada Lovelace",
        country: "GB",
        study_level: "undergraduate",
        gpa: null,
      }),
    );
    expect(store.clear).toHaveBeenCalledOnce();
  });

  test("keeps the student on review and shows a banner when submit fails", async () => {
    const user = userEvent.setup();
    const submitProfile = vi.fn().mockRejectedValue(
      new ApiError({
        kind: "validation",
        status: 422,
        message: "That profile could not be saved.",
      }),
    );
    const onComplete = vi.fn();
    render(
      <Harness
        submitProfile={submitProfile}
        onComplete={onComplete}
        initialProgress={makeProgress(completeDraft(), "experience")}
        initialStep="review"
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Submit profile" }),
    );

    expect(
      await screen.findByText("That profile could not be saved."),
    ).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("routes an expired session to the session-expired handler", async () => {
    const user = userEvent.setup();
    const submitProfile = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ kind: "unauthorized", status: 401, message: "gone" }),
      );
    const onSessionExpired = vi.fn();
    render(
      <Harness
        submitProfile={submitProfile}
        onSessionExpired={onSessionExpired}
        initialProgress={makeProgress(completeDraft(), "experience")}
        initialStep="review"
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Submit profile" }),
    );

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledOnce());
  });

  test("preserves 'prefer not to say' distinctly from unknown on review", async () => {
    render(
      <Harness
        initialProgress={makeProgress(
          completeDraft({ gpa: PREFER_NOT_TO_SAY }),
          "experience",
        )}
        initialStep="review"
      />,
    );

    expect(await screen.findByText("Prefer not to say")).toBeInTheDocument();
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
  });
});
