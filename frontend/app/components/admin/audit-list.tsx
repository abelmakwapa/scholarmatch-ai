import type { AdminAuditEventPage } from "@/app/lib/api/client";
import { DataState } from "@/app/components/product/data-state";

export function AuditList({ page }: { page: AdminAuditEventPage }) {
  if (!page.data.length)
    return (
      <DataState
        kind="empty"
        title="No administrative audit events"
        description="Actions will appear here as append-only records."
        compact
      />
    );
  return (
    <ol className="audit-list">
      {page.data.map((event) => (
        <li key={event.id}>
          <span className="audit-list__line" aria-hidden="true" />
          <div>
            <p className="product-eyebrow">
              {label(event.target_type)} · {event.action}
            </p>
            <h2>{event.target_name}</h2>
            <p>{event.summary}</p>
            <dl>
              <div>
                <dt>Actor ID</dt>
                <dd>
                  <code>{event.actor_id}</code>
                </dd>
              </div>
              <div>
                <dt>Recorded</dt>
                <dd>
                  <time dateTime={event.created_at}>
                    {format(event.created_at)}
                  </time>
                </dd>
              </div>
            </dl>
          </div>
        </li>
      ))}
    </ol>
  );
}

function format(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
function label(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (item) => item.toUpperCase());
}
