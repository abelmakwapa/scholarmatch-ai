export type EditorialCallout = {
  title: string;
  body: string;
  tone?: "lavender" | "ink";
};

export type EditorialDefinition = {
  term: string;
  description: string;
};

export type EditorialStep = {
  title: string;
  description: string;
};

export type EditorialSection = {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  points?: readonly string[];
  definitions?: readonly EditorialDefinition[];
  steps?: readonly EditorialStep[];
  callout?: EditorialCallout;
};

export type RelatedResource = {
  href: string;
  label: string;
  description: string;
};

export type EditorialPage = {
  metaDescription: string;
  sections: readonly EditorialSection[];
  related: readonly RelatedResource[];
  control?: "application-checklist" | "contact-options";
  faqs?: readonly { question: string; answer: string }[];
};

export const editorialPages = {
  "how-it-works": {
    metaDescription:
      "Learn how ScholarMatch turns student profile facts into eligibility checks, ranked opportunities, clear explanations, and a student-led final review.",
    sections: [
      {
        id: "profile-inputs",
        title: "Begin with facts you can review",
        paragraphs: [
          "A matching profile records the study level, intended field, academic history, nationality, residency, destinations, interests, experience, and application evidence a student chooses to provide.",
          "A blank field stays unknown. It is not treated as a failed requirement, and sensitive details should only be requested when they are relevant to a published rule or a feature the student has chosen to use.",
        ],
        callout: {
          title: "Student control",
          body: "A profile is an input to discovery, not a public résumé and not an application sent to a provider.",
        },
      },
      {
        id: "matching-sequence",
        title: "Five reviewable stages",
        steps: [
          {
            title: "Profile",
            description:
              "Collect relevant student facts and show which important fields are still unknown.",
          },
          {
            title: "Eligibility checks",
            description:
              "Compare known facts with structured requirements such as nationality, study level, academic thresholds, and field restrictions.",
          },
          {
            title: "Relevance ranking",
            description:
              "Order opportunities that remain plausible using study goals, interests, experience, and readiness signals. Ranking does not override a hard eligibility conflict.",
          },
          {
            title: "Explanations",
            description:
              "Show the facts that support the result, known conflicts, missing evidence, source details, and practical next actions.",
          },
          {
            title: "Student review",
            description:
              "Open the official provider source, confirm the current rules and deadline, then decide whether the application is worth pursuing.",
          },
        ],
      },
      {
        id: "rules-and-ranking",
        title: "Eligibility and relevance answer different questions",
        paragraphs: [
          "Deterministic eligibility checks ask whether known profile facts agree with published requirements. A check can be confirmed, conflicting, or unknown when evidence is missing or wording is ambiguous.",
          "Relevance ranking helps organize opportunities that remain worth reviewing. AI-generated language may make the reasons easier to read, but it should not invent a requirement, convert uncertainty into certainty, or decide who receives funding.",
        ],
        callout: {
          title: "The provider remains authoritative",
          body: "Scholarship terms can change. Always confirm requirements, coverage, closing dates, and submission instructions on the current official provider page.",
          tone: "ink",
        },
      },
    ],
    related: [
      {
        href: "/eligibility-checks",
        label: "Eligibility checks",
        description:
          "See how confirmed, conflicting, and unknown results differ.",
      },
      {
        href: "/explainable-matches",
        label: "Explainable matches",
        description: "Learn what a useful match explanation should contain.",
      },
      {
        href: "/sign-up?next=/onboarding",
        label: "Create a matching profile",
        description: "Start the real profile flow when you are ready.",
      },
    ],
  },
  "resources/scholarship-guide": {
    metaDescription:
      "A practical scholarship guide covering discovery, provider verification, shortlisting, evidence preparation, submission, and follow-up.",
    sections: [
      {
        id: "prepare-search",
        title: "Define the search before opening tabs",
        paragraphs: [
          "Write down your intended study level, field, destinations, nationality and residency facts, academic evidence, and the costs you need funding to cover. Separate essentials from preferences.",
          "Use broad discovery terms first, then narrow the list with provider rules. A scholarship title or search snippet rarely contains enough detail to judge eligibility.",
        ],
      },
      {
        id: "discovery-to-submission",
        title: "A practical discovery-to-submission path",
        steps: [
          {
            title: "Discover",
            description:
              "Build a broad candidate list from trusted directories, provider sites, universities, governments, and relevant organizations.",
          },
          {
            title: "Verify",
            description:
              "Open the official source and check the current cycle, eligibility wording, funding coverage, deadline time zone, and submission route.",
          },
          {
            title: "Shortlist",
            description:
              "Record why each opportunity fits, what is uncertain, and the preparation effort it requires. Remove confirmed conflicts early.",
          },
          {
            title: "Prepare",
            description:
              "Request references and transcripts early, outline essays against the published criteria, and note certification or translation rules.",
          },
          {
            title: "Review and submit",
            description:
              "Check every field and attachment in the provider system, submit before the final hours, and retain the confirmation receipt.",
          },
          {
            title: "Follow up",
            description:
              "Track interviews, admission dependencies, result dates, and any legitimate provider request for more information.",
          },
        ],
      },
      {
        id: "decision-record",
        title: "Keep a small decision record",
        points: [
          "Official source URL and the date you checked it",
          "Confirmed requirements, conflicts, and unanswered questions",
          "Funding included and important costs excluded",
          "Deadline with time zone and any earlier nomination date",
          "Documents, writing, references, and next action",
        ],
        callout: {
          title: "Avoid avoidable risk",
          body: "Do not pay an unofficial intermediary, send sensitive documents to an unverified address, or rely on copied deadline information when the provider source is available.",
        },
      },
    ],
    related: [
      {
        href: "/resources/application-checklist",
        label: "Application checklist",
        description: "Turn the guide into a local planning list.",
      },
      {
        href: "/resources/eligibility-glossary",
        label: "Eligibility glossary",
        description: "Decode common provider wording.",
      },
      {
        href: "/how-it-works",
        label: "How matching works",
        description: "Understand how ScholarMatch organizes the review.",
      },
    ],
  },
  "resources/application-checklist": {
    metaDescription:
      "Use a private, local-only scholarship application checklist for eligibility evidence, essays, references, transcripts, and deadline planning.",
    control: "application-checklist",
    sections: [
      {
        id: "before-you-check",
        title: "Use the provider instructions as the source of truth",
        paragraphs: [
          "This checklist is a planning aid. Add the exact items named by each provider, because evidence, document age, file format, certification, translation, and submission rules vary.",
          "Progress below lives only in this page's component state. It is not saved to an account, sent to ScholarMatch, or submitted to a scholarship provider.",
        ],
      },
      {
        id: "planning-order",
        title: "Work from slowest dependency to fastest",
        steps: [
          {
            title: "Confirm eligibility and admission dependencies",
            description:
              "Resolve hard requirements and whether a separate course or university application is required.",
          },
          {
            title: "Request third-party evidence",
            description:
              "Ask for references, official transcripts, certified copies, and translations before drafting around them.",
          },
          {
            title: "Draft and verify",
            description:
              "Write against the published criteria, check file rules, and leave time for a final review in the real submission portal.",
          },
        ],
      },
    ],
    related: [
      {
        href: "/resources/scholarship-guide",
        label: "Scholarship guide",
        description: "See the full process around this checklist.",
      },
      {
        href: "/deadline-tracking",
        label: "Deadline planning",
        description: "Plan backwards from the official closing time.",
      },
      {
        href: "/document-readiness",
        label: "Document readiness",
        description: "Distinguish an existing file from a ready document.",
      },
    ],
  },
  "resources/eligibility-glossary": {
    metaDescription:
      "Plain-language scholarship eligibility definitions for nationality, residency, study level, academic thresholds, field restrictions, funding, and closing dates.",
    sections: [
      {
        id: "identity-and-location",
        title: "Identity and location rules",
        definitions: [
          {
            term: "Nationality",
            description:
              "The citizenship or citizenships a provider recognizes for the award. Nationality is not the same as where a student currently lives, and rules may name countries, regions, or exclusions.",
          },
          {
            term: "Residency",
            description:
              "Where a person lives and, sometimes, the legal status or minimum period attached to that residence. A provider may require current, ordinary, permanent, or tax residency and define each differently.",
          },
        ],
      },
      {
        id: "study-and-academics",
        title: "Study and academic rules",
        definitions: [
          {
            term: "Study level",
            description:
              "The qualification stage an award supports, such as undergraduate, master's, doctoral, or another named level. Provider terminology and equivalent qualifications can differ by country.",
          },
          {
            term: "Academic threshold",
            description:
              "A minimum grade, classification, GPA, rank, or equivalent result. Confirm how the provider converts different grading systems and whether the threshold applies at application or enrolment.",
          },
          {
            term: "Field restriction",
            description:
              "A rule limiting eligible subjects, courses, departments, research topics, or occupations. A related interest is not enough when the enrolled programme falls outside the named field.",
          },
        ],
      },
      {
        id: "funding-and-time",
        title: "Funding and timing",
        definitions: [
          {
            term: "Funding coverage",
            description:
              "The costs an award says it will pay, which may include all or part of tuition, a stipend, travel, insurance, research costs, or other named items. “Full” should still be checked against exclusions and limits.",
          },
          {
            term: "Closing date",
            description:
              "The date and, when stated, time zone by which the provider must receive a complete application. A university nomination, admission application, or referee submission may have an earlier deadline.",
          },
        ],
        callout: {
          title: "Definitions help; official terms govern",
          body: "If the wording is unclear, keep the result marked unknown and ask the provider through its official contact route rather than guessing.",
        },
      },
    ],
    related: [
      {
        href: "/eligibility-checks",
        label: "Eligibility checks",
        description: "See how these terms become reviewable checks.",
      },
      {
        href: "/resources/scholarship-guide",
        label: "Scholarship guide",
        description: "Apply the definitions during a real search.",
      },
      {
        href: "/faq",
        label: "Frequently asked questions",
        description: "Read how uncertainty and data quality are handled.",
      },
    ],
  },
  faq: {
    metaDescription:
      "Answers about ScholarMatch products, scholarship data quality, eligibility, ranking, AI explanations, privacy, accessibility, cost, and support.",
    faqs: [
      {
        question: "What does ScholarMatch do?",
        answer:
          "It is being built to organize student-provided profile facts, check structured scholarship requirements, rank plausible opportunities, and explain why a result appears. It does not apply to providers or make funding decisions.",
      },
      {
        question: "Where does scholarship data come from?",
        answer:
          "Records should retain their source URL, source identity, review state, and verification time. Automated extraction may assist collection, but ambiguous requirements and material changes require review. The current official provider page remains authoritative.",
      },
      {
        question: "What does eligible mean?",
        answer:
          "It means the known profile facts appear to satisfy the structured requirements that were captured. It is not a guarantee: source wording can be incomplete, profile facts can change, and providers make the final decision.",
      },
      {
        question: "How are matches ranked?",
        answer:
          "Published hard requirements are checked first. Opportunities that remain plausible can then be ordered using relevance signals such as study goals, field, interests, experience, and readiness. The contributing reasons should remain visible.",
      },
      {
        question: "Does AI decide eligibility?",
        answer:
          "No. Deterministic checks should compare structured rules with known profile facts. AI may help produce a plain-language explanation grounded in those checks, but it should not invent rules or turn unknown information into a decision.",
      },
      {
        question: "How is my profile information used?",
        answer:
          "The intended use is matching, eligibility review, application organization, security, and features a student explicitly requests. Saving or matching should not publish profile facts or send them to a provider.",
      },
      {
        question: "Is ScholarMatch accessible?",
        answer:
          "The implemented interface includes semantic structure, keyboard-operable controls, visible focus, responsive layouts, text labels, and reduced-motion support. No accessibility certification is claimed, and barriers should be reported when a support address is configured.",
      },
      {
        question: "Does it cost anything?",
        answer:
          "This repository does not define public pricing or a paid plan. Do not infer a price or a promise of permanent free access from the development experience.",
      },
      {
        question: "How can I report incorrect scholarship data?",
        answer:
          "Use the contact page to see whether a public support address is configured. Keep the scholarship name, official source URL, disputed field, and date checked. Do not include passwords or unnecessary sensitive profile details.",
      },
    ],
    sections: [
      {
        id: "using-these-answers",
        title: "Read a match as a starting point",
        paragraphs: [
          "These answers describe the behavior and boundaries represented by the current project. They do not replace an official scholarship's terms, privacy notice, or application instructions.",
        ],
      },
    ],
    related: [
      {
        href: "/how-it-works",
        label: "How it works",
        description: "Follow the full matching sequence.",
      },
      {
        href: "/privacy",
        label: "Privacy approach",
        description: "Read the current data-handling boundaries.",
      },
      {
        href: "/contact",
        label: "Contact and support",
        description: "Find the currently configured contact route.",
      },
    ],
  },
  about: {
    metaDescription:
      "Learn ScholarMatch's mission, product principles, scholarship data-verification approach, and the current development stage of the project.",
    sections: [
      {
        id: "mission",
        title: "Mission",
        paragraphs: [
          "ScholarMatch is being built to make scholarship discovery easier to inspect. Students should be able to see why an opportunity appears, which published rules were checked, what information is missing, and what to verify next.",
          "The goal is a clearer decision process—not a promise of funding, admission, eligibility, or selection.",
        ],
      },
      {
        id: "principles",
        title: "Product principles",
        points: [
          "Check hard eligibility rules before using softer relevance signals.",
          "Keep evidence, uncertainty, source details, and next actions beside a result.",
          "Ask for student data with a clear purpose and keep unknown distinct from no.",
          "Never imply that saving, preparing, or matching submits an application.",
          "Design core tasks to work with a keyboard, reduced motion, and narrow screens.",
        ],
      },
      {
        id: "verification",
        title: "Data verification is a workflow, not a badge",
        paragraphs: [
          "Scholarship records should retain provenance, ingestion and verification times, publication state, and conflicts. Automated collection can help, while duplicates, ambiguous wording, and important changes need a bounded human review step.",
          "Even a reviewed record can become stale. Students should open the current official source before relying on a deadline, requirement, or funding detail.",
        ],
      },
      {
        id: "current-stage",
        title: "Current stage",
        paragraphs: [
          "This codebase represents a product under active development. Marketing examples are labelled examples unless backed by the application API, public pricing is not defined here, and final jurisdiction-specific legal notices still require approval before launch.",
          "The project does not claim provider partnerships, accreditation, funding outcomes, or accessibility and privacy certifications that are not documented in the repository.",
        ],
        callout: {
          title: "A transparent boundary",
          body: "A working interface can demonstrate intended behavior without proving that every scholarship record, operational support channel, or production policy is ready.",
        },
      },
    ],
    related: [
      {
        href: "/about/data-verification",
        label: "Data verification",
        description: "See how sources and review states remain visible.",
      },
      {
        href: "/accessibility",
        label: "Accessibility",
        description: "Review the behavior implemented today.",
      },
      {
        href: "/privacy",
        label: "Privacy approach",
        description: "Understand the current data-handling principles.",
      },
    ],
  },
  contact: {
    metaDescription:
      "Find ScholarMatch support and correction routes without a fake contact form or unconfigured submission promise.",
    control: "contact-options",
    sections: [
      {
        id: "prepare-request",
        title: "Prepare the smallest useful report",
        definitions: [
          {
            term: "Scholarship correction",
            description:
              "Keep the scholarship title, provider, official source URL, disputed field, expected wording, and date checked.",
          },
          {
            term: "Account or privacy request",
            description:
              "State the type of request, but do not include a password, identity document, transcript, or other unnecessary sensitive material in an initial message.",
          },
          {
            term: "Accessibility barrier",
            description:
              "Name the page, task, and observed problem. Browser and assistive-technology details are useful only when you are comfortable sharing them.",
          },
        ],
      },
    ],
    related: [
      {
        href: "/faq",
        label: "Frequently asked questions",
        description: "Check the product and matching answers first.",
      },
      {
        href: "/accessibility",
        label: "Accessibility approach",
        description: "Review current behavior and known boundaries.",
      },
      {
        href: "/privacy",
        label: "Privacy approach",
        description: "Understand how to limit sensitive information.",
      },
    ],
  },
  accessibility: {
    metaDescription:
      "Read the accessibility behavior implemented in ScholarMatch, current limitations, testing approach, and how to prepare a useful barrier report.",
    sections: [
      {
        id: "implemented-behavior",
        title: "What the interface implements",
        points: [
          "Semantic headings, landmarks, links, buttons, lists, fields, tabs, and disclosures where applicable",
          "Keyboard operation, visible focus, skip links, and focus restoration in modal navigation",
          "Text labels and status language that do not rely on color alone",
          "Responsive content from narrow mobile screens through large displays",
          "Reduced-motion handling for Motion and GSAP-enhanced experiences",
        ],
      },
      {
        id: "testing-and-limits",
        title: "Testing helps, but does not prove universal access",
        paragraphs: [
          "The repository includes automated accessibility checks and component tests for important keyboard and reduced-motion behavior. Automated tools cannot detect every barrier, and assistive technologies, browsers, devices, and individual needs vary.",
          "ScholarMatch does not claim an accessibility certification in this project. Content remains available without depending on animation, and core controls should remain operable when motion is reduced.",
        ],
      },
      {
        id: "reporting",
        title: "Reporting a barrier",
        paragraphs: [
          "Use the contact page to see whether a public support address is currently configured. Include the affected page and task, the behavior you expected, and the barrier you encountered.",
        ],
        callout: {
          title: "Share only what is comfortable",
          body: "Browser, device, and assistive-technology details can help reproduce an issue, but they are optional. Never send passwords or private documents in an accessibility report.",
        },
      },
    ],
    related: [
      {
        href: "/contact",
        label: "Contact and support",
        description: "Check the currently configured reporting route.",
      },
      {
        href: "/privacy",
        label: "Privacy approach",
        description: "Read how student information should be handled.",
      },
      {
        href: "/how-it-works",
        label: "How it works",
        description: "Review the product sequence in plain content.",
      },
    ],
  },
  privacy: {
    metaDescription:
      "Read ScholarMatch's current privacy approach, implemented data boundaries, account controls, third-party limitations, and pre-launch policy status.",
    sections: [
      {
        id: "scope",
        title: "What this statement is—and is not",
        paragraphs: [
          "This page accurately describes the behavior and product boundaries represented in the current project. It is not a final jurisdiction-specific privacy notice, and it does not claim a privacy certification.",
          "Before production launch, an approved notice must identify the responsible organization, lawful bases where relevant, retention periods, subprocessors, transfer arrangements, request channels, and regional rights that actually apply.",
        ],
      },
      {
        id: "current-use",
        title: "Current product boundaries",
        definitions: [
          {
            term: "Profile data",
            description:
              "Student-provided study plans, academic facts, location facts, interests, experience, and preferences are intended for matching, eligibility review, and requested product features.",
          },
          {
            term: "Authentication data",
            description:
              "Email-based account access is handled through the configured Supabase authentication service. Password handling belongs to that service flow rather than public marketing pages.",
          },
          {
            term: "Private documents",
            description:
              "The authenticated document workspace is separate from marketing content. Uploading or organizing a file must not submit it to a scholarship provider.",
          },
          {
            term: "Local-only checklist",
            description:
              "The public application checklist stores progress only in component memory and resets when the page session ends or reloads.",
          },
        ],
      },
      {
        id: "controls-and-sharing",
        title: "Control and sharing expectations",
        points: [
          "Students should be able to inspect and correct profile information.",
          "Unknown profile information should remain distinct from a negative answer.",
          "Saving, matching, or preparing should not publish data or contact a provider.",
          "Deletion and export behavior must be documented against the production API before launch.",
          "A support request should never ask for a password or unnecessary identity documents.",
        ],
        callout: {
          title: "Use the official provider site carefully",
          body: "Opening an external provider service places that visit under the provider's own privacy and security practices. Confirm the domain before entering personal information.",
          tone: "ink",
        },
      },
    ],
    related: [
      {
        href: "/data-controls",
        label: "Data controls",
        description:
          "Review intended correction, export, and deletion controls.",
      },
      {
        href: "/contact",
        label: "Contact and support",
        description: "Check whether a public request address is configured.",
      },
      {
        href: "/about",
        label: "About the project",
        description: "Understand the current development stage.",
      },
    ],
  },
} as const satisfies Record<string, EditorialPage>;

export function getEditorialPage(path: string): EditorialPage | undefined {
  return editorialPages[path as keyof typeof editorialPages];
}
