import type { ScholarshipListOptions } from "@/app/lib/api/client";

export const SCHOLARSHIP_SORTS = [
  "relevance",
  "deadline",
  "recently_verified",
  "funding_amount",
] as const;
export const STUDY_LEVELS = [
  "undergraduate",
  "postgraduate",
  "doctoral",
  "other",
] as const;
export const FUNDING_TYPES = [
  "full",
  "partial",
  "tuition",
  "stipend",
  "research",
  "other",
] as const;

export type ScholarshipFilters = Omit<
  ScholarshipListOptions,
  "cursor" | "signal"
>;
export type SearchParamValue = string | string[] | undefined;

const TEXT_KEYS = [
  "q",
  "field",
  "destination",
  "nationality",
  "residency",
  "deadline_from",
  "deadline_to",
] as const;

export function parseScholarshipFilters(
  params: Record<string, SearchParamValue>,
): ScholarshipFilters {
  const filters: ScholarshipFilters = { limit: 12 };
  for (const key of TEXT_KEYS) {
    const value = first(params[key])?.trim();
    if (value) filters[key] = value;
  }

  const studyLevel = first(params.study_level);
  if (isOneOf(studyLevel, STUDY_LEVELS)) filters.study_level = studyLevel;
  const fundingType = first(params.funding_type);
  if (isOneOf(fundingType, FUNDING_TYPES)) filters.funding_type = fundingType;
  const sort = first(params.sort);
  filters.sort = isOneOf(sort, SCHOLARSHIP_SORTS) ? sort : "relevance";
  if (first(params.verified) === "true") filters.verified = true;
  return filters;
}

export function serializeScholarshipFilters(
  filters: ScholarshipFilters,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== "limit" && value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

function first(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isOneOf<const T extends readonly string[]>(
  value: string | undefined,
  options: T,
): value is T[number] {
  return value !== undefined && options.includes(value as T[number]);
}
