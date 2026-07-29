"use client";

import {
  Bookmark,
  BookmarkCheck,
  Flag,
  LoaderCircle,
  Send,
} from "lucide-react";
import { useState } from "react";

import type {
  ScholarshipResponse,
  ScholarshipReportCreate,
} from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import { idempotencyKey } from "@/app/lib/scholarships/format";

type Actions = {
  save?: (saved: boolean) => Promise<void>;
  start?: () => Promise<void>;
  report?: (body: ScholarshipReportCreate) => Promise<void>;
};

export function ScholarshipActions({
  scholarship,
  actionable,
  actions = {},
}: {
  scholarship: ScholarshipResponse;
  actionable: boolean;
  actions?: Actions;
}) {
  const [saved, setSaved] = useState(scholarship.saved);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  async function run(
    kind: string,
    action: () => Promise<void>,
    success: string,
  ) {
    setPending(kind);
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch {
      setNotice("That action could not be completed. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function toggleSave() {
    const next = !saved;
    await run(
      "save",
      async () => {
        if (actions.save) await actions.save(next);
        else
          await createBrowserApiClient().setScholarshipSaved(
            scholarship.id,
            next,
          );
        setSaved(next);
      },
      next ? "Scholarship saved." : "Scholarship removed from saved items.",
    );
  }

  async function startApplication() {
    await run(
      "start",
      async () => {
        if (actions.start) await actions.start();
        else
          await createBrowserApiClient().createApplication(
            { scholarship_id: scholarship.id, status: "preparing" },
            idempotencyKey("application"),
          );
      },
      "Application added to your tracker.",
    );
  }

  async function submitReport(formData: FormData) {
    const body: ScholarshipReportCreate = {
      reason: formData.get("reason") as ScholarshipReportCreate["reason"],
      details: String(formData.get("details") || "").trim() || null,
    };
    await run(
      "report",
      async () => {
        if (actions.report) await actions.report(body);
        else
          await createBrowserApiClient().reportScholarship(
            scholarship.id,
            body,
            idempotencyKey("report"),
          );
        setReportOpen(false);
      },
      "Thanks. Your accuracy report was received.",
    );
  }

  return (
    <section
      className="scholarship-actions"
      aria-labelledby="scholarship-actions-title"
    >
      <h2 className="sr-only" id="scholarship-actions-title">
        Scholarship actions
      </h2>
      <div className="scholarship-actions__buttons">
        <button
          className="product-button product-button--quiet"
          type="button"
          aria-pressed={saved}
          disabled={pending !== null}
          onClick={toggleSave}
        >
          {pending === "save" ? (
            <LoaderCircle className="data-state__spinner" aria-hidden="true" />
          ) : saved ? (
            <BookmarkCheck aria-hidden="true" />
          ) : (
            <Bookmark aria-hidden="true" />
          )}
          {saved ? "Saved" : "Save"}
        </button>
        <button
          className="product-button product-button--accent"
          type="button"
          disabled={!actionable || pending !== null}
          onClick={startApplication}
        >
          <Send aria-hidden="true" />
          {actionable
            ? pending === "start"
              ? "Starting…"
              : "Start application"
            : "Applications closed"}
        </button>
        <button
          className="product-button product-button--quiet"
          type="button"
          aria-expanded={reportOpen}
          aria-controls="scholarship-report"
          onClick={() => setReportOpen((open) => !open)}
        >
          <Flag aria-hidden="true" />
          Report inaccurate information
        </button>
      </div>
      {!actionable ? (
        <p className="scholarship-actions__closed">
          This scholarship is closed or its deadline has passed. Source
          information remains available below.
        </p>
      ) : null}
      {reportOpen ? (
        <form
          id="scholarship-report"
          className="scholarship-report"
          action={submitReport}
        >
          <label>
            <span>What looks inaccurate?</span>
            <select name="reason" required defaultValue="">
              <option value="" disabled>
                Select a reason
              </option>
              <option value="expired">Expired status</option>
              <option value="incorrect_deadline">Incorrect deadline</option>
              <option value="incorrect_eligibility">
                Incorrect eligibility
              </option>
              <option value="broken_source">Broken source link</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            <span>
              Details <small>(optional)</small>
            </span>
            <textarea name="details" maxLength={2000} rows={3} />
          </label>
          <button
            className="product-button product-button--ink"
            type="submit"
            disabled={pending !== null}
          >
            {pending === "report" ? "Sending…" : "Send report"}
          </button>
        </form>
      ) : null}
      {notice ? (
        <p className="scholarship-actions__notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
