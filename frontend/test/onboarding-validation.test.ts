import { describe, expect, test } from "vitest";

import { draftToProfileWrite } from "@/app/lib/onboarding/serialize";
import { firstIncompleteStep } from "@/app/lib/onboarding/steps";
import {
  PREFER_NOT_TO_SAY,
  UNKNOWN,
  provided,
  type OnboardingDraft,
} from "@/app/lib/onboarding/types";
import { isStepValid, validateStep } from "@/app/lib/onboarding/validation";

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

describe("step validation", () => {
  test("consent must be explicitly accepted", () => {
    expect(validateStep("consent", {}).consentAccepted).toBeDefined();
    expect(isStepValid("consent", { consentAccepted: true })).toBe(true);
  });

  test("identity requires a name within length limits", () => {
    expect(validateStep("identity", {}).fullName).toBeDefined();
    expect(isStepValid("identity", { fullName: "Grace Hopper" })).toBe(true);
    expect(
      validateStep("identity", { fullName: "x".repeat(201) }).fullName,
    ).toBeDefined();
  });

  test("location requires a valid ISO country code", () => {
    expect(
      validateStep("location", { countryOfResidence: "" }).countryOfResidence,
    ).toBeDefined();
    expect(
      validateStep("location", { countryOfResidence: "ZZ" }).countryOfResidence,
    ).toBeDefined();
    expect(isStepValid("location", { countryOfResidence: "KE" })).toBe(true);
  });

  test("results demands an explicit disclosure choice", () => {
    // No choice at all is invalid — the student must decide.
    expect(validateStep("results", {}).gpa).toBeDefined();
    // Unknown and prefer-not-to-say are valid, distinct answers.
    expect(isStepValid("results", { gpa: UNKNOWN })).toBe(true);
    expect(isStepValid("results", { gpa: PREFER_NOT_TO_SAY })).toBe(true);
    // A provided value is range-checked.
    expect(validateStep("results", { gpa: provided(4.5) }).gpa).toBeDefined();
    expect(isStepValid("results", { gpa: provided(3.6) })).toBe(true);
  });

  test("goals requires at least one interest", () => {
    expect(validateStep("goals", { interests: [] }).interests).toBeDefined();
    expect(isStepValid("goals", { interests: ["robotics"] })).toBe(true);
  });

  test("experience accepts 'none' as a real answer", () => {
    expect(validateStep("experience", {}).experienceStatus).toBeDefined();
    expect(isStepValid("experience", { experienceStatus: "none" })).toBe(true);
  });
});

describe("firstIncompleteStep (resume target)", () => {
  test("returns the first required step that is not yet valid", () => {
    expect(firstIncompleteStep({})).toBe("consent");
    expect(firstIncompleteStep({ consentAccepted: true })).toBe("identity");
  });

  test("skips optional steps and reaches review when required steps are done", () => {
    expect(firstIncompleteStep(completeDraft())).toBe("review");
  });
});

describe("draftToProfileWrite", () => {
  test("maps provided values and treats undecided field as null", () => {
    const body = draftToProfileWrite(
      completeDraft({
        fieldOfStudyUndecided: false,
        fieldOfStudy: "  Computer Science  ",
        gpa: provided(3.9),
        goals: "  Become a researcher  ",
        interests: [" AI ", "AI", "ethics"],
      }),
    );
    expect(body).toEqual({
      full_name: "Ada Lovelace",
      country: "GB",
      study_level: "undergraduate",
      field_of_study: "Computer Science",
      gpa: 3.9,
      interests: ["AI", "AI", "ethics"],
      goals: "Become a researcher",
    });
  });

  test("unknown and prefer-not-to-say both serialize to null on the wire", () => {
    expect(draftToProfileWrite(completeDraft({ gpa: UNKNOWN })).gpa).toBeNull();
    expect(
      draftToProfileWrite(completeDraft({ gpa: PREFER_NOT_TO_SAY })).gpa,
    ).toBeNull();
  });

  test("refuses to serialize an incomplete draft", () => {
    expect(() => draftToProfileWrite({ fullName: "Ada" })).toThrow();
  });
});
