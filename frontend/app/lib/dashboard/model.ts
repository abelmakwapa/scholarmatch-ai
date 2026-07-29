import type {
  ApplicationResponse,
  MatchResponse,
  ProfileResponse,
} from "@/app/lib/api/client";
import {
  profileCompleteness,
  type ProfileCompleteness,
} from "@/app/lib/profile/completeness";

const DAY_MS = 86_400_000;

export type DashboardSource = "matches" | "applications";

export type DashboardDeadline = {
  scholarshipId: string;
  title: string;
  provider: string;
  deadline: string;
  daysRemaining: number;
  applicationStatus: ApplicationResponse["status"] | null;
};

export type DashboardNextAction = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  label: string;
};

export type DashboardViewModel = {
  profile: ProfileResponse;
  completeness: ProfileCompleteness;
  urgentDeadlines: DashboardDeadline[];
  recentMatches: MatchResponse[];
  activeApplications: ApplicationResponse[];
  applicationCounts: Record<ApplicationResponse["status"], number>;
  nextAction: DashboardNextAction;
  unavailableSources: DashboardSource[];
};

export function buildDashboardViewModel(input: {
  profile: ProfileResponse;
  matches: MatchResponse[];
  applications: ApplicationResponse[];
  unavailableSources?: DashboardSource[];
  now?: Date;
}): DashboardViewModel {
  const now = input.now ?? new Date();
  const completeness = profileCompleteness(input.profile);
  const applicationsByScholarship = new Map(
    input.applications.map((application) => [
      application.scholarship_id,
      application,
    ]),
  );

  const urgentDeadlines = input.matches
    .flatMap<DashboardDeadline>((match) => {
      const { scholarship } = match;
      if (!scholarship.deadline || scholarship.status !== "published")
        return [];
      const deadline = parseDateOnly(scholarship.deadline);
      const daysRemaining = Math.ceil(
        (deadline.getTime() - startOfUtcDay(now).getTime()) / DAY_MS,
      );
      const application = applicationsByScholarship.get(scholarship.id);
      const finished =
        application?.status === "submitted" ||
        application?.status === "awarded" ||
        application?.status === "rejected" ||
        application?.status === "withdrawn";
      if (daysRemaining < 0 || daysRemaining > 30 || finished) return [];
      return [
        {
          scholarshipId: scholarship.id,
          title: scholarship.title,
          provider: scholarship.provider,
          deadline: scholarship.deadline,
          daysRemaining,
          applicationStatus: application?.status ?? null,
        },
      ];
    })
    .sort((left, right) => left.daysRemaining - right.daysRemaining);

  const recentMatches = input.matches
    .filter((match) => {
      const calculatedAt = new Date(match.calculated_at).getTime();
      return (
        Number.isFinite(calculatedAt) &&
        now.getTime() - calculatedAt <= 14 * DAY_MS &&
        calculatedAt <= now.getTime()
      );
    })
    .sort(
      (left, right) =>
        new Date(right.calculated_at).getTime() -
        new Date(left.calculated_at).getTime(),
    );

  const activeApplications = input.applications.filter(
    (application) =>
      application.status === "saved" || application.status === "preparing",
  );
  const applicationCounts = countApplications(input.applications);
  const unavailableSources = input.unavailableSources ?? [];

  return {
    profile: input.profile,
    completeness,
    urgentDeadlines,
    recentMatches,
    activeApplications,
    applicationCounts,
    unavailableSources,
    nextAction: chooseNextAction({
      completeness,
      urgentDeadlines,
      recentMatches,
      activeApplications,
      unavailableSources,
    }),
  };
}

function chooseNextAction(input: {
  completeness: ProfileCompleteness;
  urgentDeadlines: DashboardDeadline[];
  recentMatches: MatchResponse[];
  activeApplications: ApplicationResponse[];
  unavailableSources: DashboardSource[];
}): DashboardNextAction {
  if (input.completeness.percent < 100) {
    const missing = input.completeness.missing[0]?.label.toLowerCase();
    return {
      eyebrow: "Best next step",
      title: missing ? `Add your ${missing}` : "Complete your profile",
      description:
        "More current profile facts can improve match confidence and reduce unknown eligibility checks. They do not guarantee eligibility.",
      href: "/profile?edit=1",
      label: "Complete profile",
    };
  }

  const deadline = input.urgentDeadlines[0];
  if (deadline) {
    return {
      eyebrow: deadline.daysRemaining === 0 ? "Due today" : "Deadline priority",
      title: deadline.title,
      description:
        deadline.applicationStatus === "preparing"
          ? "Continue the application with the nearest confirmed deadline."
          : "Review the nearest confirmed deadline before starting an application.",
      href:
        deadline.applicationStatus === "preparing"
          ? "/applications"
          : `/scholarships?focus=${deadline.scholarshipId}`,
      label:
        deadline.applicationStatus === "preparing"
          ? "Continue application"
          : "Review scholarship",
    };
  }

  if (input.activeApplications.length > 0) {
    return {
      eyebrow: "Keep moving",
      title: "Continue an application in progress",
      description:
        "Pick up your most recently updated application and check its remaining tasks.",
      href: "/applications",
      label: "View applications",
    };
  }

  if (input.recentMatches.length > 0) {
    return {
      eyebrow: "New match activity",
      title: "Review your latest matches",
      description:
        "See the profile facts behind each result and confirm any information marked unknown.",
      href: "/matches",
      label: "Review matches",
    };
  }

  if (input.unavailableSources.includes("matches")) {
    return {
      eyebrow: "Data needs attention",
      title: "Refresh your match activity",
      description:
        "Match data is temporarily unavailable. Your saved profile has not been changed.",
      href: "/dashboard",
      label: "Try again",
    };
  }

  return {
    eyebrow: "Ready when you are",
    title: "Explore published scholarships",
    description:
      "Browse available opportunities while ScholarMatch prepares profile-based recommendations.",
    href: "/scholarships",
    label: "Browse scholarships",
  };
}

function countApplications(
  applications: ApplicationResponse[],
): Record<ApplicationResponse["status"], number> {
  const counts: Record<ApplicationResponse["status"], number> = {
    saved: 0,
    preparing: 0,
    submitted: 0,
    awarded: 0,
    rejected: 0,
    withdrawn: 0,
  };
  for (const application of applications) counts[application.status] += 1;
  return counts;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
