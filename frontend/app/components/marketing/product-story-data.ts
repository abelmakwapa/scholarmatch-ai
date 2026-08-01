export const matchAnatomyTabs = [
  {
    id: "eligibility",
    label: "Eligibility",
    eyebrow: "Published rules first",
    title: "Two rules confirmed, one fact needs review",
    body: "The example study-level and location rules are deterministic checks against published criteria. A missing transcript detail stays unresolved—it does not become an automatic rejection.",
    points: [
      "Study level: confirmed against the example rule",
      "Applicant location: confirmed against the example rule",
      "Transcript detail: review the official source",
    ],
  },
  {
    id: "reasons",
    label: "Match reasons",
    eyebrow: "Relevance after eligibility",
    title: "The ranking separates fit from permission to apply",
    body: "Once hard rules are checked, ScholarMatch can compare the profile’s field, interests, experience, and readiness. An AI-generated explanation summarizes those signals; it does not change the provider’s rules.",
    points: [
      "Computing focus is relevant to the example opportunity",
      "Undergraduate study level aligns with the stated audience",
      "Document readiness affects usefulness, not eligibility",
    ],
  },
  {
    id: "requirements",
    label: "Requirements",
    eyebrow: "Evidence to prepare",
    title: "See the work behind a promising result",
    body: "This illustrative card requests an academic transcript, a motivation statement, and one reference. Students should confirm the exact format and submission method on the official provider page.",
    points: [
      "Academic transcript: status not yet confirmed",
      "Motivation statement: outline not started",
      "Reference: potential referee not yet contacted",
    ],
  },
  {
    id: "deadline",
    label: "Deadline",
    eyebrow: "Timing with source context",
    title: "A date is useful only when its source is visible",
    body: "The timeline shown here is an example, not a live closing date. ScholarMatch should display the source, time zone, and last verification date so students can confirm timing with the provider.",
    points: [
      "Confirm the closing date on the official provider page",
      "Check the deadline time zone and required submission steps",
      "Plan evidence and references before writing the final application",
    ],
  },
] as const;

export type OpportunityExample = {
  id: string;
  title: string;
  studyLevel: "Undergraduate" | "Postgraduate";
  destination: "Home country" | "International" | "Regional";
  funding: "Study support" | "Tuition support" | "Project support";
  field: "Computing" | "Health" | "Public service" | "Research";
  reason: string;
};

export const opportunityExamples: readonly OpportunityExample[] = [
  {
    id: "academic-pathway",
    title: "Academic pathway opportunity",
    studyLevel: "Undergraduate",
    destination: "Home country",
    funding: "Tuition support",
    field: "Computing",
    reason: "Example fit: undergraduate level and computing field align.",
  },
  {
    id: "stem-study",
    title: "STEM study opportunity",
    studyLevel: "Undergraduate",
    destination: "International",
    funding: "Study support",
    field: "Computing",
    reason: "Example fit: the named field and international-study goal align.",
  },
  {
    id: "community-leadership",
    title: "Community leadership opportunity",
    studyLevel: "Undergraduate",
    destination: "Regional",
    funding: "Project support",
    field: "Public service",
    reason: "Example fit: community work is relevant to the stated purpose.",
  },
  {
    id: "health-research",
    title: "Health research opportunity",
    studyLevel: "Postgraduate",
    destination: "Home country",
    funding: "Project support",
    field: "Health",
    reason:
      "Example fit: postgraduate study and applied-health research align.",
  },
  {
    id: "research-mobility",
    title: "Research mobility opportunity",
    studyLevel: "Postgraduate",
    destination: "International",
    funding: "Study support",
    field: "Research",
    reason: "Example fit: research readiness and destination preference align.",
  },
  {
    id: "regional-policy",
    title: "Regional public-service opportunity",
    studyLevel: "Postgraduate",
    destination: "Regional",
    funding: "Tuition support",
    field: "Public service",
    reason: "Example fit: prior study and public-service focus are relevant.",
  },
] as const;

export const readinessItems = [
  {
    id: "eligibility-evidence",
    label: "Eligibility evidence",
    detail:
      "Confirm identity, residency, study level, and any published academic thresholds.",
  },
  {
    id: "essays",
    label: "Essays and statements",
    detail: "Draft against the provider’s exact prompts and word limits.",
  },
  {
    id: "references",
    label: "References",
    detail:
      "Ask early and share the opportunity requirements with each referee.",
  },
  {
    id: "transcripts",
    label: "Transcripts",
    detail:
      "Check whether certified copies, translations, or recent results are required.",
  },
  {
    id: "deadline-planning",
    label: "Deadline planning",
    detail:
      "Confirm the official date and time zone, then set an earlier personal deadline.",
  },
] as const;

export const faqItems = [
  {
    id: "ranking",
    question: "How does ranking work?",
    answer:
      "ScholarMatch checks published eligibility rules first. Opportunities that remain plausible can then be ordered using separate relevance signals such as study fit, interests, experience, and readiness. The explanation shows those signals so a ranking is not presented as a verdict.",
  },
  {
    id: "eligible",
    question: "What does “eligible” mean?",
    answer:
      "Eligible means the profile facts available to ScholarMatch satisfy the deterministic rules currently recorded for an opportunity. Unknown or ambiguous facts stay marked for review. Students should always confirm the final requirements with the official scholarship provider.",
  },
  {
    id: "verification",
    question: "How is scholarship data verified?",
    answer:
      "Scholarship records should retain their source, the date they were checked, and any unresolved detail. When a source changes or conflicts with another source, the uncertainty should be visible rather than silently guessed.",
  },
  {
    id: "ai-decision",
    question: "Does AI decide whether I am eligible?",
    answer:
      "No. Deterministic checks compare profile facts with published rules. AI may help explain relevance or summarize why a result appears, but it should not rewrite provider requirements or make the provider’s final decision.",
  },
  {
    id: "privacy",
    question: "What happens to my profile information?",
    answer:
      "Public marketing examples contain no live student data. Signed-in product features should use only the facts needed for matching, keep private documents out of public pages, and make data controls available to the student.",
  },
  {
    id: "costs",
    question: "Does ScholarMatch charge students?",
    answer:
      "This page makes no pricing promise. Any current fees or free access terms should be shown clearly before a student commits to a paid action. Browsing this illustrative homepage does not submit an application or create a charge.",
  },
  {
    id: "corrections",
    question: "How do I report incorrect scholarship data?",
    answer:
      "Use the contact and support route and include the opportunity name, the field that appears incorrect, and the official source you checked. A report should request review; it does not contact or apply to the scholarship provider.",
  },
] as const;
