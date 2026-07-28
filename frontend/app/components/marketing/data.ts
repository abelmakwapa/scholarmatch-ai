import {
  BookOpenCheck,
  CalendarClock,
  FileCheck2,
  ListChecks,
  Microscope,
  School,
  Sprout,
  UsersRound,
} from "lucide-react";

export const navItems = [
  { label: "Product", href: "#product" },
  { label: "For Students", href: "#students" },
  { label: "Resources", href: "#resources" },
  { label: "About", href: "#about" },
] as const;

export const categories = [
  "Undergraduate",
  "Postgraduate",
  "Research",
  "STEM",
  "Leadership",
  "Community",
  "International study",
  "Public service",
] as const;

export const useCases = [
  {
    id: "undergraduate",
    label: "Undergraduate",
    icon: School,
    title: "Turn a first profile into a focused starting point.",
    description:
      "See which opportunities fit your study level, academic record, interests, and location before you spend time on an application.",
    facts: ["Study level", "Academic fit", "Location rules"],
    signal: "Foundational profile",
  },
  {
    id: "postgraduate",
    label: "Postgraduate",
    icon: BookOpenCheck,
    title: "Match advanced study plans with specific requirements.",
    description:
      "Connect your intended degree, field, prior study, and goals to opportunities whose published requirements align.",
    facts: ["Degree intent", "Prior study", "Career goals"],
    signal: "Advanced study fit",
  },
  {
    id: "international",
    label: "International",
    icon: Sprout,
    title: "Make country and residency constraints visible early.",
    description:
      "Separate confirmed eligibility, missing profile facts, and destination-specific conditions before ranking the remaining options.",
    facts: ["Nationality", "Destination", "Residency"],
    signal: "Mobility-aware match",
  },
  {
    id: "stem",
    label: "STEM",
    icon: ListChecks,
    title: "Bring academic focus and technical interests together.",
    description:
      "Use verified discipline requirements first, then consider how closely an opportunity’s purpose relates to your profile.",
    facts: ["Discipline", "Coursework", "Interests"],
    signal: "Field-specific fit",
  },
  {
    id: "research",
    label: "Research",
    icon: Microscope,
    title: "Surface the evidence behind a research match.",
    description:
      "Compare study level, subject area, research readiness, and document gaps in one explainable recommendation.",
    facts: ["Research area", "Experience", "Documents"],
    signal: "Research readiness",
  },
  {
    id: "community",
    label: "Community",
    icon: UsersRound,
    title: "Recognize service and leadership without guessing.",
    description:
      "Use only the experiences you choose to share, and distinguish explicit scholarship requirements from softer relevance signals.",
    facts: ["Service", "Leadership", "Impact themes"],
    signal: "Experience alignment",
  },
] as const;

export const features = [
  {
    number: "01",
    icon: ListChecks,
    title: "Eligibility first",
    description:
      "Published hard requirements are checked before semantic relevance. Unknown facts stay unknown instead of becoming automatic rejection.",
    visualLabel: "Confirmed before ranked",
  },
  {
    number: "02",
    icon: BookOpenCheck,
    title: "Scores you can inspect",
    description:
      "Academic fit, eligibility fit, interests, experience, and readiness remain visible as separate parts of the recommendation.",
    visualLabel: "Five visible score signals",
  },
  {
    number: "03",
    icon: CalendarClock,
    title: "Deadlines in context",
    description:
      "Readiness and time remaining sit beside the match so a promising opportunity does not hide an unrealistic application window.",
    visualLabel: "Timing stays attached",
  },
  {
    number: "04",
    icon: FileCheck2,
    title: "Documents with purpose",
    description:
      "Track which materials appear ready, missing, or still processing without exposing private document contents in public interfaces.",
    visualLabel: "Private by design",
  },
] as const;

export type StudentStory = {
  id: string;
  quote: string;
  name: string;
  context: string;
};

// Production intentionally ships without unapproved testimonials.
export const approvedStudentStories: StudentStory[] = [];
