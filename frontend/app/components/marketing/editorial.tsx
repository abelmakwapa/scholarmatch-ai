import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type {
  EditorialCallout,
  EditorialDefinition,
  EditorialStep,
  RelatedResource,
} from "@/app/lib/marketing/editorial-content";

export function Breadcrumbs({ path, title }: { path: string; title: string }) {
  const segments = path.split("/");
  const parentLabels: Record<string, string> = {
    about: "About",
    "for-students": "For students",
    resources: "Resources",
  };
  return (
    <nav aria-label="Breadcrumb" className="article-breadcrumbs">
      <ol>
        <li>
          <Link href="/">Home</Link>
        </li>
        {segments.length > 1 ? (
          <li>
            <span>{parentLabels[segments[0]] ?? segments[0]}</span>
          </li>
        ) : null}
        <li aria-current="page">{title}</li>
      </ol>
    </nav>
  );
}

export function ArticleLayout({
  path,
  eyebrow,
  title,
  introduction,
  children,
}: {
  path: string;
  eyebrow: string;
  title: string;
  introduction: string;
  children: ReactNode;
}) {
  return (
    <article className="marketing-content-page">
      <Breadcrumbs path={path} title={title} />
      <header className="marketing-content-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{introduction}</p>
      </header>
      {children}
    </article>
  );
}

export function Callout({ title, body, tone = "lavender" }: EditorialCallout) {
  return (
    <aside className="article-callout" data-tone={tone}>
      <Info aria-hidden="true" size={19} />
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </aside>
  );
}

export function DefinitionList({
  definitions,
}: {
  definitions: readonly EditorialDefinition[];
}) {
  return (
    <dl className="article-definitions">
      {definitions.map((definition) => (
        <div key={definition.term}>
          <dt>{definition.term}</dt>
          <dd>{definition.description}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Steps({ steps }: { steps: readonly EditorialStep[] }) {
  return (
    <ol className="article-steps">
      {steps.map((step, index) => (
        <li key={step.title}>
          <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function RelatedResources({
  resources,
}: {
  resources: readonly RelatedResource[];
}) {
  return (
    <aside className="related-resources" aria-labelledby="related-heading">
      <div>
        <p className="eyebrow">Continue exploring</p>
        <h2 id="related-heading">Related resources</h2>
      </div>
      <ul>
        {resources.map((resource) => (
          <li key={resource.href}>
            <Link href={resource.href}>
              <span>
                <strong>{resource.label}</strong>
                <small>{resource.description}</small>
              </span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
