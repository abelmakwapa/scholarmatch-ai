export type MarketingContentSection = {
  title: string;
  body: string;
  points?: readonly string[];
};

export type MarketingContentPage = {
  path: string;
  eyebrow: string;
  title: string;
  introduction: string;
  sections: readonly MarketingContentSection[];
  nextLabel: string;
  nextHref: string;
};

const productPages: readonly MarketingContentPage[] = [
  {
    path: "how-it-works",
    eyebrow: "Product",
    title: "A visible path from profile to match.",
    introduction:
      "ScholarMatch is designed to narrow a large search without hiding the rules or the evidence used along the way.",
    sections: [
      {
        title: "1. Build one profile",
        body: "Share the study plans, academic facts, locations, interests, and experience you want the matcher to consider. Missing information stays unknown.",
      },
      {
        title: "2. Check published requirements",
        body: "Structured eligibility rules are evaluated before relevance. A result can be eligible, ineligible, or still need information.",
      },
      {
        title: "3. Review ranked opportunities",
        body: "The remaining opportunities are organized with reasons, gaps, source details, deadlines, and next actions attached.",
      },
    ],
    nextLabel: "See explainable matches",
    nextHref: "/explainable-matches",
  },
  {
    path: "explainable-matches",
    eyebrow: "Product",
    title: "A score should start a review—not end one.",
    introduction:
      "ScholarMatch keeps eligibility evidence, relevance signals, missing facts, and calculation status visible beside a recommendation.",
    sections: [
      {
        title: "What aligns",
        body: "See the profile facts that correspond to published study-level, location, academic, field, or experience requirements.",
      },
      {
        title: "What may block an application",
        body: "Confirmed conflicts are separated from information that has not been provided or cannot yet be verified.",
      },
      {
        title: "What to do next",
        body: "Use concrete next actions to update a profile, review an official source, prepare evidence, or decide that an opportunity is not worth pursuing.",
      },
    ],
    nextLabel: "Understand eligibility checks",
    nextHref: "/eligibility-checks",
  },
  {
    path: "eligibility-checks",
    eyebrow: "Product",
    title: "Published rules come before prediction.",
    introduction:
      "Eligibility is treated as a structured question grounded in provider requirements, not as an AI guess about who might succeed.",
    sections: [
      {
        title: "Confirmed",
        body: "The available profile evidence agrees with the structured requirement.",
      },
      {
        title: "Conflict",
        body: "A known profile fact conflicts with a published hard requirement. The source and reason should remain reviewable.",
      },
      {
        title: "Unknown",
        body: "The profile or source does not contain enough information. Unknown must not be silently converted into rejection.",
      },
    ],
    nextLabel: "Read the eligibility glossary",
    nextHref: "/resources/eligibility-glossary",
  },
  {
    path: "deadline-tracking",
    eyebrow: "Product",
    title: "Treat the deadline as part of the match.",
    introduction:
      "A relevant opportunity is only actionable when the closing date, time zone, preparation work, and source freshness are visible together.",
    sections: [
      {
        title: "Review the source date",
        body: "Check when the scholarship record was last verified and open the provider page before relying on a deadline.",
      },
      {
        title: "Plan backwards",
        body: "Allow time for references, official transcripts, certified copies, essays, and provider-specific submission steps.",
      },
      {
        title: "Keep status honest",
        body: "Track whether an application is saved, preparing, ready, submitted, or withdrawn without implying that ScholarMatch submitted it for you.",
      },
    ],
    nextLabel: "Open the application checklist",
    nextHref: "/resources/application-checklist",
  },
  {
    path: "document-readiness",
    eyebrow: "Product",
    title: "Know what each document is for.",
    introduction:
      "Document readiness connects requested materials to an opportunity while keeping private files out of public marketing interfaces.",
    sections: [
      {
        title: "Match requirements",
        body: "Relate transcripts, identity evidence, references, essays, and certificates to the provider wording that requests them.",
      },
      {
        title: "Separate ready from present",
        body: "A file can exist but still need certification, translation, a newer issue date, or a provider-specific format.",
      },
      {
        title: "Keep control",
        body: "Uploading a private document should not send it to a scholarship provider. External sharing requires a separate, explicit action.",
      },
    ],
    nextLabel: "Prepare an application",
    nextHref: "/resources/application-checklist",
  },
];

const studentDetails = {
  undergraduate: [
    "Study level and intended qualification",
    "Academic history and subject fit",
    "Location, nationality, and residency rules",
  ],
  postgraduate: [
    "Prior qualification and intended degree",
    "Field, research, or professional direction",
    "Academic thresholds and required evidence",
  ],
  international: [
    "Nationality and current residency",
    "Permitted destinations and mobility conditions",
    "Language, visa, and local admission dependencies",
  ],
  stem: [
    "Eligible disciplines and course alignment",
    "Technical interests or relevant experience",
    "Academic and document requirements",
  ],
  research: [
    "Research area and intended study level",
    "Methods, experience, and proposal readiness",
    "Supervisor, institution, or admission dependencies",
  ],
  community: [
    "Service, leadership, and impact evidence",
    "Communities or themes named by the provider",
    "Required references and supporting material",
  ],
} as const;

const studentPages = Object.entries(studentDetails).map(
  ([slug, points]): MarketingContentPage => ({
    path: `for-students/${slug}`,
    eyebrow: "For students",
    title: `${slug[0].toUpperCase()}${slug.slice(1)} opportunities, explained in context.`,
    introduction:
      "The same scholarship can look very different depending on your study plan and the provider's published restrictions.",
    sections: [
      {
        title: "Facts the matcher can consider",
        body: "ScholarMatch should use only the information you choose to provide and keep hard requirements separate from softer relevance signals.",
        points,
      },
      {
        title: "Questions to confirm",
        body: "Before applying, verify the current provider page, admission dependencies, funding coverage, closing date, and required evidence.",
      },
      {
        title: "What the explanation should show",
        body: "Look for confirmed alignment, possible blockers, missing information, source dates, and a practical next action—not just one overall score.",
      },
    ],
    nextLabel: "See how matching works",
    nextHref: "/how-it-works",
  }),
);

const resourceAndTrustPages: readonly MarketingContentPage[] = [
  {
    path: "resources/scholarship-guide",
    eyebrow: "Resource",
    title: "A practical scholarship search guide.",
    introduction:
      "Move from a broad goal to a short, verified application list without losing track of requirements or sources.",
    sections: [
      {
        title: "Start with constraints",
        body: "Write down your study level, field, destinations, nationality or residency facts, academic evidence, and the kinds of funding you need.",
      },
      {
        title: "Read beyond the headline",
        body: "Check the official eligibility wording, funding exclusions, admission conditions, required documents, deadline time zone, and application route.",
      },
      {
        title: "Keep a decision trail",
        body: "Record why an opportunity fits, what remains uncertain, when the source was checked, and the next action required.",
      },
    ],
    nextLabel: "Use the application checklist",
    nextHref: "/resources/application-checklist",
  },
  {
    path: "resources/application-checklist",
    eyebrow: "Resource",
    title: "Prepare the evidence before the rush.",
    introduction:
      "Every provider differs, but a consistent review can expose missing work while there is still time to resolve it.",
    sections: [
      {
        title: "Eligibility and source",
        body: "Confirm the official provider page, current cycle, closing date, study level, location rules, academic threshold, and funding scope.",
      },
      {
        title: "Evidence and writing",
        body: "List transcripts, identity or residency evidence, references, essays, research material, certifications, translations, and file-format rules.",
      },
      {
        title: "Submission and follow-up",
        body: "Check the submission portal, account access, time zone, confirmation receipt, provider contact route, and any later interview or admission steps.",
      },
    ],
    nextLabel: "Review deadline planning",
    nextHref: "/deadline-tracking",
  },
  {
    path: "resources/eligibility-glossary",
    eyebrow: "Resource",
    title: "Eligibility language, without the fog.",
    introduction:
      "Provider wording is the authority. These plain-language definitions are a reading aid, not a replacement for the official terms.",
    sections: [
      {
        title: "Nationality and residency",
        body: "Nationality generally concerns citizenship; residency concerns where and under what status a person currently lives. A provider may restrict either or both.",
      },
      {
        title: "Study level and admission",
        body: "A funding offer may require a particular qualification level and a separate admission offer. Eligibility for one does not automatically guarantee the other.",
      },
      {
        title: "Funding coverage and deadline",
        body: "Fully funded, tuition-only, stipend, travel, and partial awards cover different costs. Deadline wording may also specify a time zone or an earlier institutional nomination date.",
      },
    ],
    nextLabel: "Read frequently asked questions",
    nextHref: "/faq",
  },
  {
    path: "faq",
    eyebrow: "Help",
    title: "Questions worth asking before you rely on a match.",
    introduction:
      "ScholarMatch is intended to support a student's review, not replace provider rules, admissions decisions, or personal judgment.",
    sections: [
      {
        title: "Does AI decide eligibility?",
        body: "It should not. Structured provider requirements determine eligibility checks; AI-generated language may help explain a result but must remain grounded in those checks.",
      },
      {
        title: "What does unknown mean?",
        body: "It means the available profile or source lacks enough information. Unknown is a prompt to investigate, not an automatic rejection or approval.",
      },
      {
        title: "Should I verify the provider page?",
        body: "Yes. Requirements, deadlines, and funding can change. Review the current official source before making an application decision.",
      },
    ],
    nextLabel: "Contact support",
    nextHref: "/contact",
  },
  {
    path: "about",
    eyebrow: "About",
    title: "Make scholarship discovery easier to inspect.",
    introduction:
      "ScholarMatch is being built around a simple principle: students should be able to understand why an opportunity appears and what still needs verification.",
    sections: [
      {
        title: "Eligibility before relevance",
        body: "Hard provider requirements should be evaluated before softer similarity signals influence ranking.",
      },
      {
        title: "Reasons beside results",
        body: "Matches should show supporting evidence, conflicts, missing facts, source details, and concrete next steps.",
      },
      {
        title: "Students remain in control",
        body: "The product organizes information and preparation. Providers remain responsible for their terms and decisions; students decide where to apply.",
      },
    ],
    nextLabel: "See how data is verified",
    nextHref: "/about/data-verification",
  },
  {
    path: "about/data-verification",
    eyebrow: "About",
    title: "Keep the source attached to the claim.",
    introduction:
      "Scholarship information is more trustworthy when its origin, review time, publication state, and possible conflicts remain visible.",
    sections: [
      {
        title: "Capture provenance",
        body: "Records should identify the source page, source name, ingestion time, and last verification time.",
      },
      {
        title: "Review before publication",
        body: "Automated extraction can assist, but ambiguous requirements, duplicates, and material changes need a bounded review workflow.",
      },
      {
        title: "Report corrections",
        body: "A correction route should preserve the disputed source and let maintainers review changes without silently rewriting history.",
      },
    ],
    nextLabel: "Read the privacy approach",
    nextHref: "/privacy",
  },
  {
    path: "privacy",
    eyebrow: "Trust",
    title: "Use profile data for the task the student expects.",
    introduction:
      "This product principle summary is not a substitute for the final jurisdiction-specific privacy notice that must be approved before launch.",
    sections: [
      {
        title: "Purpose and restraint",
        body: "Collect only information needed for matching, eligibility review, application organization, security, or an explicitly requested feature.",
      },
      {
        title: "Clear controls",
        body: "Students should be able to review, correct, export, and request deletion of their information through documented controls.",
      },
      {
        title: "No hidden publication",
        body: "Private profile facts and documents must not appear in public marketing pages or be shared with providers without an explicit action.",
      },
    ],
    nextLabel: "Review data controls",
    nextHref: "/data-controls",
  },
  {
    path: "accessibility",
    eyebrow: "Trust",
    title: "Access is part of product quality.",
    introduction:
      "ScholarMatch aims for keyboard access, clear structure, readable contrast, reduced-motion support, useful errors, and responsive layouts.",
    sections: [
      {
        title: "Multiple ways to operate",
        body: "Navigation, forms, tabs, disclosures, and application tools should work without requiring precise pointer movement or animation.",
      },
      {
        title: "Understandable states",
        body: "Loading, errors, eligibility outcomes, missing information, and progress should be conveyed in text rather than color alone.",
      },
      {
        title: "Feedback matters",
        body: "Accessibility issues should be reported through the contact route with the affected page, task, browser, and assistive technology when a user is comfortable sharing them.",
      },
    ],
    nextLabel: "Contact ScholarMatch",
    nextHref: "/contact",
  },
  {
    path: "contact",
    eyebrow: "Support",
    title: "Route the question to the right place.",
    introduction:
      "Check the currently configured support route, prepare the smallest useful report, and avoid sharing unnecessary sensitive information.",
    sections: [
      {
        title: "Incorrect scholarship data",
        body: "Keep the scholarship title, provider, official source URL, disputed detail, and date you checked it ready for the configured support channel.",
      },
      {
        title: "Account or privacy request",
        body: "Use the authenticated support route when available so the team can verify identity without asking you to place sensitive profile information in a public message.",
      },
      {
        title: "Accessibility issue",
        body: "Describe the page and task that was blocked. Include browser or assistive-technology details only if you choose to share them.",
      },
    ],
    nextLabel: "Read frequently asked questions",
    nextHref: "/faq",
  },
  {
    path: "terms",
    eyebrow: "Legal",
    title: "Terms must match the product that actually ships.",
    introduction:
      "Final terms require legal approval before launch. Until then, do not rely on this development build for provider decisions or completed applications.",
    sections: [
      {
        title: "Informational support",
        body: "ScholarMatch organizes scholarship information and explanations; it does not guarantee eligibility, funding, admission, or selection.",
      },
      {
        title: "Provider authority",
        body: "The scholarship provider's current official materials govern requirements, deadlines, funding, and decisions.",
      },
      {
        title: "Responsible use",
        body: "Users should provide accurate information, protect account access, and avoid uploading material they do not have permission to use.",
      },
    ],
    nextLabel: "Read the privacy approach",
    nextHref: "/privacy",
  },
  {
    path: "data-controls",
    eyebrow: "Trust",
    title: "Make data choices visible and reversible.",
    introduction:
      "Data controls should let students understand what is stored and take action without navigating a hidden support process.",
    sections: [
      {
        title: "Review and correct",
        body: "Profile fields should remain inspectable and editable, with unknown kept distinct from a negative answer.",
      },
      {
        title: "Export and deletion",
        body: "Production controls should document what can be exported, what deletion covers, any legal retention, and how long requests take.",
      },
      {
        title: "Sharing boundaries",
        body: "Saving, matching, or preparing an opportunity should not silently send profile information or documents to an external provider.",
      },
    ],
    nextLabel: "Read the privacy approach",
    nextHref: "/privacy",
  },
];

export const marketingContentPages = [
  ...productPages,
  ...studentPages,
  ...resourceAndTrustPages,
] as const;

export function getMarketingContentPage(
  slug: readonly string[],
): MarketingContentPage | undefined {
  const path = slug.join("/");
  return marketingContentPages.find((page) => page.path === path);
}
