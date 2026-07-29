"use client";

import {
  CalendarClock,
  Check,
  ExternalLink,
  History,
  LayoutGrid,
  List,
} from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";

import { DataState } from "@/app/components/product/data-state";
import type {
  ApplicationDeadlinePage,
  ApplicationPage,
  ApplicationReminderWrite,
  ApplicationResponse,
  ApplicationStatus,
  ApplicationUpdate,
  ChecklistItemUpdate,
} from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";

export type ApplicationApi = {
  updateApplication: (
    id: string,
    body: ApplicationUpdate,
    key: string,
  ) => Promise<ApplicationResponse>;
  updateApplicationChecklistItem: (
    id: string,
    itemId: string,
    body: ChecklistItemUpdate,
    key: string,
  ) => Promise<ApplicationResponse>;
  setApplicationReminder: (
    id: string,
    body: ApplicationReminderWrite,
    key: string,
  ) => Promise<ApplicationResponse>;
  deleteApplicationReminder: (
    id: string,
    key: string,
  ) => Promise<ApplicationResponse>;
};

const STATUSES: ApplicationStatus[] = [
  "saved",
  "preparing",
  "ready",
  "submitted",
  "interview",
  "awarded",
  "unsuccessful",
  "withdrawn",
];

export function ApplicationWorkspace({
  initialPage,
  deadlines,
  api = createBrowserApiClient(),
}: {
  initialPage: ApplicationPage;
  deadlines: ApplicationDeadlinePage;
  api?: ApplicationApi;
}) {
  const [applications, setApplications] = useState(initialPage.data);
  const [view, setView] = useState<"board" | "list">("board");
  const timezone = useSyncExternalStore(
    subscribeToTimezone,
    browserTimezone,
    serverTimezone,
  );

  function replaceApplication(next: ApplicationResponse) {
    setApplications((current) =>
      current.map((application) =>
        application.id === next.id ? next : application,
      ),
    );
  }

  if (applications.length === 0) {
    return (
      <>
        <DeadlineList page={deadlines} timezone={timezone} />
        <DataState
          kind="empty"
          title="No applications tracked yet"
          description="Start from a scholarship detail page. Tracking stays private and never submits anything to a provider."
          compact
        />
      </>
    );
  }

  return (
    <div className="application-workspace">
      <DeadlineList page={deadlines} timezone={timezone} />
      <div className="application-toolbar">
        <div>
          <h2>Application workspace</h2>
          <p>{applications.length} privately tracked applications</p>
        </div>
        <div className="view-switch" aria-label="Application view">
          <button
            type="button"
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            <LayoutGrid aria-hidden="true" /> Board
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List aria-hidden="true" /> List
          </button>
        </div>
      </div>

      {view === "board" ? (
        <div className="application-board" data-testid="application-board">
          {STATUSES.map((status) => {
            const items = applications.filter((item) => item.status === status);
            return (
              <section className="application-column" key={status}>
                <header>
                  <h3>{statusLabel(status)}</h3>
                  <span>{items.length}</span>
                </header>
                {items.length ? (
                  <ul>
                    {items.map((application) => (
                      <li key={application.id}>
                        <ApplicationCard
                          application={application}
                          api={api}
                          timezone={timezone}
                          onChange={replaceApplication}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="application-column__empty">Nothing here</p>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="application-table-wrap" data-testid="application-list">
          <table className="application-table">
            <caption>
              Applications and the same controls available on the board
            </caption>
            <thead>
              <tr>
                <th scope="col">Scholarship</th>
                <th scope="col">Deadline</th>
                <th scope="col">Status and details</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <th scope="row">
                    {application.scholarship.title}
                    <span>{application.scholarship.provider}</span>
                    <a
                      href={application.scholarship.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source <ExternalLink aria-hidden="true" />
                    </a>
                  </th>
                  <td>{formatApplicationDeadline(application, timezone)}</td>
                  <td>
                    <ApplicationActions
                      application={application}
                      api={api}
                      timezone={timezone}
                      onChange={replaceApplication}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="application-privacy-note">
        ScholarMatch tracks your progress only. It does not send applications or
        documents to scholarship providers.
      </p>
    </div>
  );
}

function ApplicationCard(props: ApplicationActionProps) {
  const { application, timezone } = props;
  return (
    <article className="application-card">
      <div className="application-card__heading">
        <div>
          <p>{application.scholarship.provider}</p>
          <h4>{application.scholarship.title}</h4>
        </div>
        <a
          href={application.scholarship.source_url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open source for ${application.scholarship.title}`}
        >
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
      <p className="application-card__deadline">
        <CalendarClock aria-hidden="true" />
        {formatApplicationDeadline(application, timezone)}
      </p>
      <ApplicationActions {...props} />
    </article>
  );
}

type ApplicationActionProps = {
  application: ApplicationResponse;
  api: ApplicationApi;
  timezone: string;
  onChange: (application: ApplicationResponse) => void;
};

function ApplicationActions({
  application,
  api,
  timezone,
  onChange,
}: ApplicationActionProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(application.notes ?? "");
  const retryKeys = useRef(new Map<string, string>());

  async function mutate(
    operationId: string,
    label: string,
    request: (key: string) => Promise<ApplicationResponse>,
  ) {
    if (pending) return;
    setPending(label);
    setError(null);
    const key = retryKeys.current.get(operationId) ?? idempotencyKey();
    retryKeys.current.set(operationId, key);
    try {
      onChange(await request(key));
      retryKeys.current.delete(operationId);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(null);
    }
  }

  const checklistDone = application.checklist.filter(
    (item) => item.completed,
  ).length;

  return (
    <div className="application-actions">
      <label>
        <span>Status</span>
        <select
          value={application.status}
          disabled={
            pending !== null || application.allowed_transitions.length === 0
          }
          onChange={(event) => {
            const status = event.target.value as ApplicationStatus;
            if (!application.allowed_transitions.includes(status)) return;
            void mutate(`status-${status}`, "status", (key) =>
              api.updateApplication(application.id, { status }, key),
            );
          }}
          aria-label={`Status for ${application.scholarship.title}`}
        >
          <option value={application.status}>
            {statusLabel(application.status)}
          </option>
          {application.allowed_transitions.map((status) => (
            <option value={status} key={status}>
              Move to {statusLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>
          Checklist {checklistDone}/{application.checklist.length}
        </summary>
        <fieldset disabled={pending !== null}>
          <legend className="sr-only">Application checklist</legend>
          {application.checklist.length ? (
            application.checklist.map((item) => (
              <label className="application-check" key={item.id}>
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() =>
                    void mutate(
                      `check-${item.id}-${String(!item.completed)}`,
                      "checklist",
                      (key) =>
                        api.updateApplicationChecklistItem(
                          application.id,
                          item.id,
                          { completed: !item.completed },
                          key,
                        ),
                    )
                  }
                />
                <span>{item.label}</span>
                {item.required ? <small>Required</small> : null}
              </label>
            ))
          ) : (
            <p>No checklist items are available yet.</p>
          )}
        </fieldset>
      </details>
      <details>
        <summary>Notes and reminder</summary>
        <label>
          <span>Private notes</span>
          <textarea
            value={notes}
            maxLength={10000}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <button
          className="text-action"
          type="button"
          disabled={pending !== null || notes === (application.notes ?? "")}
          onClick={() =>
            void mutate(`notes-${notes}`, "notes", (key) =>
              api.updateApplication(
                application.id,
                { notes: notes || null },
                key,
              ),
            )
          }
        >
          Save notes
        </button>
        <ReminderControl
          application={application}
          timezone={timezone}
          pending={pending !== null}
          onSet={(body) =>
            mutate(
              `reminder-${body.remind_at}-${body.timezone}`,
              "reminder",
              (key) => api.setApplicationReminder(application.id, body, key),
            )
          }
          onDelete={() =>
            mutate("reminder-delete", "reminder", (key) =>
              api.deleteApplicationReminder(application.id, key),
            )
          }
        />
      </details>
      <details>
        <summary>
          <History aria-hidden="true" /> Status history
        </summary>
        <ol className="status-history">
          {application.status_history.map((entry) => (
            <li key={entry.id}>
              <Check aria-hidden="true" />
              <span>
                {entry.from_status
                  ? `${statusLabel(entry.from_status)} → `
                  : ""}
                {statusLabel(entry.to_status)}
                <time dateTime={entry.changed_at}>
                  {formatTimestamp(entry.changed_at, timezone)}
                </time>
              </span>
            </li>
          ))}
        </ol>
      </details>
      {pending ? <p role="status">Saving {pending}…</p> : null}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ReminderControl({
  application,
  timezone,
  pending,
  onSet,
  onDelete,
}: {
  application: ApplicationResponse;
  timezone: string;
  pending: boolean;
  onSet: (body: ApplicationReminderWrite) => void;
  onDelete: () => void;
}) {
  const reminderSource = application.reminder?.remind_at;
  const [draft, setDraft] = useState<{
    source: string | undefined;
    value: string;
  } | null>(null);
  const value =
    draft && draft.source === reminderSource
      ? draft.value
      : isoToLocalInput(reminderSource, timezone);
  return (
    <div className="reminder-control">
      <label>
        <span>Reminder ({timezone})</span>
        <input
          type="datetime-local"
          value={value}
          onChange={(event) =>
            setDraft({ source: reminderSource, value: event.target.value })
          }
        />
      </label>
      <div>
        <button
          type="button"
          className="text-action"
          disabled={pending || !value}
          onClick={() =>
            onSet({ remind_at: new Date(value).toISOString(), timezone })
          }
        >
          Set reminder
        </button>
        {application.reminder ? (
          <button
            type="button"
            className="text-action"
            disabled={pending}
            onClick={onDelete}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DeadlineList({
  page,
  timezone,
}: {
  page: ApplicationDeadlinePage;
  timezone: string;
}) {
  return (
    <section
      className="application-deadlines"
      aria-labelledby="deadline-heading"
    >
      <div className="product-section__head">
        <div>
          <p className="product-eyebrow">Calendar-friendly</p>
          <h2 id="deadline-heading">Upcoming deadlines</h2>
        </div>
        <span>Shown in {timezone}</span>
      </div>
      {page.data.length ? (
        <ol>
          {page.data.map((item) => (
            <li key={item.application_id}>
              <time
                dateTime={item.deadline_at ?? item.deadline_date ?? undefined}
              >
                {item.deadline_at
                  ? formatTimestamp(item.deadline_at, timezone)
                  : item.deadline_date
                    ? formatDateOnly(item.deadline_date)
                    : "Deadline not published"}
              </time>
              <span>
                <strong>{item.title}</strong>
                {item.provider}
              </span>
              <a href={item.source_url} target="_blank" rel="noreferrer">
                Source <ExternalLink aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p>No dated application deadlines are available yet.</p>
      )}
    </section>
  );
}

export function statusLabel(status: ApplicationStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatTimestamp(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatApplicationDeadline(
  application: ApplicationResponse,
  timezone: string,
) {
  if (application.deadline_at)
    return formatTimestamp(application.deadline_at, timezone);
  if (application.scholarship.deadline)
    return formatDateOnly(application.scholarship.deadline);
  return "Deadline not published";
}

function isoToLocalInput(value: string | undefined, timezone: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function subscribeToTimezone() {
  return () => undefined;
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function serverTimezone() {
  return "UTC";
}

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "That change could not be saved. Try again.";
}
