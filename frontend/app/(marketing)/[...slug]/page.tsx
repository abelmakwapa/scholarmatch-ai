import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getMarketingContentPage,
  marketingContentPages,
} from "@/app/lib/marketing/content";

type MarketingPageProps = {
  params: Promise<{ slug: string[] }>;
};

export function generateStaticParams() {
  return marketingContentPages.map((page) => ({ slug: page.path.split("/") }));
}

export async function generateMetadata({
  params,
}: MarketingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getMarketingContentPage(slug);
  if (!page) return {};

  return {
    title: page.title,
    description: page.introduction,
    alternates: { canonical: `/${page.path}` },
  };
}

export default async function MarketingContentPage({
  params,
}: MarketingPageProps) {
  const { slug } = await params;
  const page = getMarketingContentPage(slug);
  if (!page) notFound();

  return (
    <article className="marketing-content-page">
      <header className="marketing-content-hero">
        <p className="eyebrow">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p>{page.introduction}</p>
      </header>

      <div className="marketing-content-sections">
        {page.sections.map((section, index) => (
          <section key={section.title}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              {section.points ? (
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <aside className="marketing-content-next" aria-label="Next step">
        <div>
          <p className="eyebrow">Continue exploring</p>
          <h2>Take the next useful step.</h2>
        </div>
        <Link className="button-link button-link--accent" href={page.nextHref}>
          {page.nextLabel}
        </Link>
      </aside>
    </article>
  );
}
