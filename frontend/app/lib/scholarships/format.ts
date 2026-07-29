import type { ScholarshipResponse } from "@/app/lib/api/client";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(value: string | null): string {
  if (!value) return "No deadline published";
  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : DATE_FORMAT.format(date);
}

export function deadlineState(
  deadline: string | null,
  status: ScholarshipResponse["status"],
  now = new Date(),
): "open" | "expired" | "unknown" {
  if (status === "closed") return "expired";
  if (!deadline) return "unknown";
  const endOfDeadline = new Date(`${deadline}T23:59:59.999Z`);
  if (Number.isNaN(endOfDeadline.valueOf())) return "unknown";
  return endOfDeadline < now ? "expired" : "open";
}

export function formatFunding(scholarship: ScholarshipResponse): string {
  if (scholarship.funding_summary) return scholarship.funding_summary;
  if (scholarship.amount != null && scholarship.currency) {
    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: scholarship.currency.toUpperCase(),
        maximumFractionDigits: 0,
      }).format(scholarship.amount);
    } catch {
      return `${scholarship.amount.toLocaleString("en")} ${scholarship.currency.toUpperCase()}`;
    }
  }
  return `${titleCase(scholarship.funding_type)} funding`;
}

export function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function idempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
