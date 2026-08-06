export type IllustrativeJourney = {
  id: string;
  title: string;
  context: string;
  summary: string;
  steps: readonly string[];
  nextStep: string;
};

/**
 * These are product walkthroughs, not student testimonials. They deliberately
 * contain no person, institution, quotation, award value, or claimed outcome.
 */
export const illustrativeJourneys: readonly IllustrativeJourney[] = [
  {
    id: "undergraduate-shortlist",
    title: "From a broad search to a reviewable shortlist",
    context: "Illustrative undergraduate journey",
    summary:
      "A student adds their intended study level, computing interest, location facts, and available transcript information.",
    steps: [
      "Published study-level and location rules are checked first.",
      "Plausible examples are ordered by field alignment and readiness.",
      "Unknown transcript wording remains a visible review item.",
    ],
    nextStep: "Open the official source before preparing an application.",
  },
  {
    id: "postgraduate-evidence",
    title: "Turning a promising match into an evidence plan",
    context: "Illustrative postgraduate journey",
    summary:
      "A student compares prior study, intended field, research direction, and the documents already available.",
    steps: [
      "A named qualification requirement is separated from relevance signals.",
      "Proposal and reference dependencies are marked as preparation work.",
      "The deadline is reviewed alongside the time needed for third-party evidence.",
    ],
    nextStep: "Confirm admission dependencies and referee deadlines.",
  },
  {
    id: "international-uncertainty",
    title: "Keeping location uncertainty visible",
    context: "Illustrative international-study journey",
    summary:
      "A student provides nationality, current residency, study destination, and language evidence without assuming the terms are interchangeable.",
    steps: [
      "Nationality and residency rules receive separate checks.",
      "An unclear mobility condition stays unknown rather than becoming rejection.",
      "The explanation points back to the provider wording that needs confirmation.",
    ],
    nextStep:
      "Verify visa, admission, and residency wording with official sources.",
  },
] as const;
