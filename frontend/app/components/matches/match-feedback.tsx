"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { FormEvent, useState } from "react";

import type { MatchFeedbackCreate } from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import { matchIdempotencyKey } from "@/app/lib/matches/presentation";

export function MatchFeedback({
  scholarshipId,
  submitFeedback,
}: {
  scholarshipId: string;
  submitFeedback?: (body: MatchFeedbackCreate) => Promise<void>;
}) {
  const [useful, setUseful] = useState<boolean | null>(null);
  const [reason, setReason] = useState<MatchFeedbackCreate["reason"] | "">("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (useful === null || !reason) {
      setStatus(
        "Choose whether the explanation was useful and select a reason.",
      );
      return;
    }
    const form = new FormData(event.currentTarget);
    const body: MatchFeedbackCreate = {
      useful,
      reason,
      details: String(form.get("details") || "").trim() || null,
    };
    setPending(true);
    setStatus("");
    try {
      if (submitFeedback) await submitFeedback(body);
      else
        await createBrowserApiClient().createMatchFeedback(
          scholarshipId,
          body,
          matchIdempotencyKey("match-feedback"),
        );
      setStatus("Thanks. Your feedback was recorded for review.");
    } catch {
      setStatus("Feedback could not be submitted. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="match-feedback" aria-labelledby="match-feedback-title">
      <div>
        <p className="product-eyebrow">Help us evaluate explanations</p>
        <h2 id="match-feedback-title">Was this explanation useful?</h2>
        <p>
          Feedback is reviewed and evaluated. It does not instantly retrain or
          change the matching model.
        </p>
      </div>
      <form onSubmit={submit}>
        <fieldset>
          <legend className="sr-only">Explanation usefulness</legend>
          <button
            type="button"
            aria-pressed={useful === true}
            onClick={() => setUseful(true)}
          >
            <ThumbsUp aria-hidden="true" />
            Useful
          </button>
          <button
            type="button"
            aria-pressed={useful === false}
            onClick={() => setUseful(false)}
          >
            <ThumbsDown aria-hidden="true" />
            Not useful
          </button>
        </fieldset>
        <label>
          <span>Reason</span>
          <select
            value={reason}
            onChange={(event) =>
              setReason(event.target.value as MatchFeedbackCreate["reason"])
            }
            required
          >
            <option value="">Select a reason</option>
            <option value="accurate">Accurate and clear</option>
            <option value="unclear">Unclear explanation</option>
            <option value="missing_context">Missing context</option>
            <option value="incorrect">Something is incorrect</option>
            <option value="not_relevant">Not relevant to me</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span>
            Details <small>(optional)</small>
          </span>
          <textarea name="details" rows={3} maxLength={2000} />
        </label>
        <button
          className="product-button product-button--ink"
          type="submit"
          disabled={pending}
        >
          {pending ? "Submitting…" : "Submit feedback"}
        </button>
        {status ? (
          <p className="match-feedback__status" role="status">
            {status}
          </p>
        ) : null}
      </form>
    </section>
  );
}
