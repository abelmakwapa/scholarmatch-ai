export type HeroScenarioId = "undergraduate" | "postgraduate" | "international";

export type HeroScenario = {
  id: HeroScenarioId;
  label: string;
  facts: readonly { label: string; value: string }[];
  gates: readonly {
    label: string;
    result: string;
    state: "confirmed" | "review";
  }[];
  matches: readonly {
    id: "academic" | "research" | "community";
    title: string;
    reasons: readonly [string, string];
  }[];
  summary: string;
};

export const heroScenarios: readonly HeroScenario[] = [
  {
    id: "undergraduate",
    label: "Undergraduate",
    facts: [
      { label: "Study level", value: "Undergraduate" },
      { label: "Field", value: "Computer science" },
      { label: "Location", value: "Botswana" },
    ],
    gates: [
      { label: "Study level", result: "Confirmed", state: "confirmed" },
      { label: "Location rule", result: "Confirmed", state: "confirmed" },
      { label: "Transcript", result: "Review needed", state: "review" },
    ],
    matches: [
      {
        id: "academic",
        title: "Academic pathway opportunity",
        reasons: ["Undergraduate level aligns", "Computing focus is relevant"],
      },
      {
        id: "community",
        title: "Community impact opportunity",
        reasons: ["Location rule aligns", "Open to early-stage students"],
      },
      {
        id: "research",
        title: "Research potential opportunity",
        reasons: ["Field is relevant", "Transcript detail still needed"],
      },
    ],
    summary:
      "Undergraduate profile selected. The academic pathway ranks first because the study level and computing focus align; one transcript detail still needs review.",
  },
  {
    id: "postgraduate",
    label: "Postgraduate",
    facts: [
      { label: "Study level", value: "Postgraduate" },
      { label: "Field", value: "Public health" },
      { label: "Focus", value: "Applied research" },
    ],
    gates: [
      { label: "Study level", result: "Confirmed", state: "confirmed" },
      { label: "Research focus", result: "Confirmed", state: "confirmed" },
      { label: "Proposal", result: "Review needed", state: "review" },
    ],
    matches: [
      {
        id: "research",
        title: "Research potential opportunity",
        reasons: ["Postgraduate level aligns", "Research focus is relevant"],
      },
      {
        id: "academic",
        title: "Academic pathway opportunity",
        reasons: ["Public health is relevant", "Proposal review is required"],
      },
      {
        id: "community",
        title: "Community impact opportunity",
        reasons: [
          "Applied focus aligns",
          "Community context could strengthen fit",
        ],
      },
    ],
    summary:
      "Postgraduate profile selected. The research pathway ranks first because the study level and applied research focus align; the proposal still needs review.",
  },
  {
    id: "international",
    label: "International",
    facts: [
      { label: "Study level", value: "Undergraduate" },
      { label: "Destination", value: "International study" },
      { label: "Citizenship", value: "Botswana" },
    ],
    gates: [
      { label: "Study level", result: "Confirmed", state: "confirmed" },
      { label: "Citizenship", result: "Confirmed", state: "confirmed" },
      { label: "Language evidence", result: "Review needed", state: "review" },
    ],
    matches: [
      {
        id: "community",
        title: "Community impact opportunity",
        reasons: [
          "Citizenship rule aligns",
          "International study is supported",
        ],
      },
      {
        id: "academic",
        title: "Academic pathway opportunity",
        reasons: ["Study level aligns", "Language evidence still needs review"],
      },
      {
        id: "research",
        title: "Research potential opportunity",
        reasons: [
          "International applicants considered",
          "Research focus is optional",
        ],
      },
    ],
    summary:
      "International profile selected. The community pathway ranks first because the citizenship rule and international-study goal align; language evidence still needs review.",
  },
] as const;
