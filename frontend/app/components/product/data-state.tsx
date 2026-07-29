import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

type DataStateProps = {
  kind: "loading" | "empty" | "error";
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
};

const ICONS = {
  loading: LoaderCircle,
  empty: Inbox,
  error: AlertCircle,
};

/** Shared, honest query state for full pages and individual data regions. */
export function DataState({
  kind,
  title,
  description,
  action,
  compact = false,
}: DataStateProps) {
  const Icon = ICONS[kind];
  return (
    <section
      className="data-state"
      data-kind={kind}
      data-compact={compact || undefined}
      aria-live={kind === "loading" ? "polite" : undefined}
      role={
        kind === "error" ? "alert" : kind === "loading" ? "status" : undefined
      }
    >
      <span className="data-state__icon" aria-hidden="true">
        <Icon
          className={kind === "loading" ? "data-state__spinner" : undefined}
        />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className="data-state__action">{action}</div> : null}
    </section>
  );
}
