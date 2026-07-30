export type MarketingNavLink = {
  label: string;
  href: string;
  description: string;
};

export type MarketingNavGroup = {
  id: "product" | "students" | "resources" | "about";
  label: string;
  description: string;
  links: readonly MarketingNavLink[];
};

export const marketingNavGroups = [
  {
    id: "product",
    label: "Product",
    description:
      "See how ScholarMatch turns profile facts into useful next steps.",
    links: [
      {
        label: "How matching works",
        href: "/how-it-works",
        description:
          "Follow the path from profile facts to ranked opportunities.",
      },
      {
        label: "Explainable matches",
        href: "/explainable-matches",
        description:
          "Inspect the reasons, limits, and missing facts behind a result.",
      },
      {
        label: "Eligibility checks",
        href: "/eligibility-checks",
        description: "Understand how published requirements are checked first.",
      },
      {
        label: "Deadline tracking",
        href: "/deadline-tracking",
        description: "Keep timing and application readiness in the same view.",
      },
      {
        label: "Document readiness",
        href: "/document-readiness",
        description:
          "See which requested materials are ready or still missing.",
      },
    ],
  },
  {
    id: "students",
    label: "For Students",
    description:
      "Explore how the matching explanation changes with your study path.",
    links: [
      {
        label: "Undergraduate",
        href: "/for-students/undergraduate",
        description: "Build a focused starting point for a first degree.",
      },
      {
        label: "Postgraduate",
        href: "/for-students/postgraduate",
        description: "Connect advanced study plans with specific requirements.",
      },
      {
        label: "International",
        href: "/for-students/international",
        description:
          "Surface nationality, residency, and destination rules early.",
      },
      {
        label: "STEM",
        href: "/for-students/stem",
        description: "Compare discipline requirements and technical interests.",
      },
      {
        label: "Research",
        href: "/for-students/research",
        description: "Review subject fit, experience, and research readiness.",
      },
      {
        label: "Community",
        href: "/for-students/community",
        description: "Make service and leadership evidence easier to assess.",
      },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    description:
      "Use practical guidance before you invest time in an application.",
    links: [
      {
        label: "Scholarship guide",
        href: "/resources/scholarship-guide",
        description: "A clear route from discovery to a final provider check.",
      },
      {
        label: "Application checklist",
        href: "/resources/application-checklist",
        description: "Organize evidence, writing, references, and deadlines.",
      },
      {
        label: "Eligibility glossary",
        href: "/resources/eligibility-glossary",
        description: "Decode common requirements in plain language.",
      },
      {
        label: "FAQ",
        href: "/faq",
        description: "Read answers about matching, data, privacy, and access.",
      },
      {
        label: "Contact & support",
        href: "/contact",
        description: "Find the right route for questions or corrections.",
      },
    ],
  },
  {
    id: "about",
    label: "About",
    description:
      "Learn what ScholarMatch is designed to do—and where its limits are.",
    links: [
      {
        label: "Mission",
        href: "/about",
        description: "Why clearer scholarship discovery matters.",
      },
      {
        label: "How data is verified",
        href: "/about/data-verification",
        description:
          "How source details, review dates, and changes stay visible.",
      },
      {
        label: "Privacy approach",
        href: "/privacy",
        description: "How student-provided information should be handled.",
      },
      {
        label: "Accessibility",
        href: "/accessibility",
        description: "Our approach to an inclusive product experience.",
      },
      {
        label: "Contact",
        href: "/contact",
        description: "Ask a question or report incorrect scholarship data.",
      },
    ],
  },
] as const satisfies readonly MarketingNavGroup[];

export const footerUtilityLinks = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Data controls", href: "/data-controls" },
] as const;

export function isMarketingHrefActive(pathname: string, href: string): boolean {
  const hrefPath = href.split(/[?#]/, 1)[0] || "/";
  if (hrefPath === "/") return pathname === "/";
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}
