"use client";

import { useReportWebVitals } from "next/web-vitals";

import { reportWebVital } from "@/app/lib/observability/client";

/** A deliberately tiny client boundary for aggregate, non-identifying metrics. */
export function WebVitals() {
  useReportWebVitals((metric) => {
    reportWebVital(metric.name, metric.value, metric.rating);
  });
  return null;
}
