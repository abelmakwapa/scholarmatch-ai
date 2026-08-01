"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";

const checklistGroups = [
  {
    title: "Eligibility evidence",
    items: [
      "Official requirements and current cycle checked",
      "Nationality, residency, and study-level evidence identified",
      "Academic threshold and field restriction confirmed",
      "Funding coverage and exclusions recorded",
    ],
  },
  {
    title: "Essays and statements",
    items: [
      "Every prompt and word limit copied from the provider",
      "Examples mapped to the published selection criteria",
      "Final draft checked for accuracy and required format",
    ],
  },
  {
    title: "References",
    items: [
      "Referees meet the provider's relationship rules",
      "Referees have the criteria and enough lead time",
      "Reference submission route and deadline confirmed",
    ],
  },
  {
    title: "Transcripts and documents",
    items: [
      "Official transcript or accepted equivalent requested",
      "Certification, translation, date, and file rules checked",
      "Identity and admission evidence prepared only if required",
    ],
  },
  {
    title: "Deadline planning",
    items: [
      "Closing date, time, and time zone recorded",
      "Earlier admission or nomination deadline checked",
      "Personal review deadline set before provider closing time",
      "Submission confirmation will be retained",
    ],
  },
] as const;

const itemIds = checklistGroups.flatMap((group, groupIndex) =>
  group.items.map((_, itemIndex) => `${groupIndex}-${itemIndex}`),
);

export function ApplicationPlanner() {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const completed = checked.size;
  const total = itemIds.length;

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="article-planner" aria-labelledby="planner-heading">
      <header>
        <div>
          <p className="eyebrow">Local planning tool</p>
          <h2 id="planner-heading">Application readiness checklist</h2>
          <p>
            Checked items remain only until this page reloads. Nothing here is
            saved to an account or sent to a provider.
          </p>
        </div>
        <div className="article-planner__progress">
          <strong>
            {completed} of {total}
          </strong>
          <span>planning checks complete</span>
          <progress
            aria-label="Checklist progress"
            max={total}
            value={completed}
          >
            {completed} of {total}
          </progress>
        </div>
      </header>

      <div className="article-planner__groups">
        {checklistGroups.map((group, groupIndex) => (
          <fieldset key={group.title}>
            <legend>{group.title}</legend>
            {group.items.map((item, itemIndex) => {
              const id = `${groupIndex}-${itemIndex}`;
              return (
                <label key={item}>
                  <input
                    checked={checked.has(id)}
                    onChange={() => toggle(id)}
                    type="checkbox"
                  />
                  <span>{item}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>

      <button
        disabled={completed === 0}
        onClick={() => setChecked(new Set())}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={16} /> Reset local checklist
      </button>
    </section>
  );
}
