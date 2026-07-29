import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

type WorkspacePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

/** Honest boundary for destination screens outside this implementation slice. */
export function WorkspacePlaceholder({
  eyebrow,
  title,
  description,
  icon: Icon,
}: WorkspacePlaceholderProps) {
  return (
    <div className="workspace-page">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      <section className="feature-boundary">
        <span aria-hidden="true">
          <Icon />
        </span>
        <div>
          <h2>Overview available on your dashboard</h2>
          <p>
            This focused workspace is not connected in the current application
            slice. No sample records are being shown as if they were yours.
          </p>
          <Link href="/dashboard">
            Return to dashboard <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
