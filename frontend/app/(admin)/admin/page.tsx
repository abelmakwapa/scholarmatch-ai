import {
  BookCheck,
  Files,
  GraduationCap,
  History,
  Network,
} from "lucide-react";
import Link from "next/link";

import { requireAdminSession } from "@/app/lib/auth/server-session";

const AREAS = [
  {
    href: "/admin/scholarships",
    title: "Scholarship quality",
    description:
      "Create, review, publish, and maintain structured requirements.",
    icon: GraduationCap,
  },
  {
    href: "/admin/ingestion",
    title: "Ingestion runs",
    description: "Inspect safe run summaries, counters, and linked retries.",
    icon: Network,
  },
  {
    href: "/admin/duplicates",
    title: "Duplicate resolution",
    description: "Choose canonical records while preserving source history.",
    icon: Files,
  },
  {
    href: "/admin/verification",
    title: "Verification queue",
    description:
      "Review freshness and changed fields against constrained sources.",
    icon: BookCheck,
  },
  {
    href: "/admin/audit",
    title: "Audit history",
    description: "Read append-only administrative action records.",
    icon: History,
  },
] as const;

export default async function AdminOverviewPage() {
  await requireAdminSession("/admin");
  return (
    <div className="workspace-page admin-page">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Role-protected operations</p>
          <h1>Data quality, with a trail.</h1>
          <p>
            Review scholarship sources and editorial changes without exposing
            imported payloads, tokens, or credentials.
          </p>
        </div>
      </header>
      <section className="admin-overview" aria-label="Administration areas">
        {AREAS.map(({ href, title, description, icon: Icon }) => (
          <Link href={href} key={href}>
            <Icon aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
          </Link>
        ))}
      </section>
      <aside className="admin-security-note">
        <strong>Authorization boundary</strong>
        <p>
          This navigation is rendered only after an admin role check. Every page
          repeats that check before fetching, and the API must independently
          return 403 for non-admin tokens on every mutation.
        </p>
      </aside>
    </div>
  );
}
