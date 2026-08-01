import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplicationPlanner } from "@/app/components/marketing/application-planner";
import { ContactOptions } from "@/app/components/marketing/contact-options";
import {
  ArticleLayout,
  Callout,
  DefinitionList,
  RelatedResources,
  Steps,
} from "@/app/components/marketing/editorial";
import {
  getMarketingContentPage,
  marketingContentPages,
} from "@/app/lib/marketing/content";
import { getEditorialPage } from "@/app/lib/marketing/editorial-content";

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
  const editorial = getEditorialPage(page.path);

  return {
    title: page.title,
    description: editorial?.metaDescription ?? page.introduction,
    alternates: { canonical: `/${page.path}` },
    openGraph: {
      type: "article",
      url: `/${page.path}`,
      title: page.title,
      description: editorial?.metaDescription ?? page.introduction,
    },
  };
}

export default async function MarketingContentPage({
  params,
}: MarketingPageProps) {
  const { slug } = await params;
  const page = getMarketingContentPage(slug);
  if (!page) notFound();
  const editorial = getEditorialPage(page.path);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

  return (
    <ArticleLayout
      eyebrow={page.eyebrow}
      introduction={page.introduction}
      path={page.path}
      title={page.title}
    >
      {editorial ? (
        <div className="article-body">
          {editorial.sections.map((section) => (
            <section id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.points ? (
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
              {section.definitions ? (
                <DefinitionList definitions={section.definitions} />
              ) : null}
              {section.steps ? <Steps steps={section.steps} /> : null}
              {section.callout ? <Callout {...section.callout} /> : null}
            </section>
          ))}

          {editorial.faqs ? (
            <section className="article-faq" id="questions">
              <h2>Frequently asked questions</h2>
              <div>
                {editorial.faqs.map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          {editorial.control === "application-checklist" ? (
            <ApplicationPlanner />
          ) : null}
          {editorial.control === "contact-options" ? (
            <ContactOptions supportEmail={supportEmail || undefined} />
          ) : null}
        </div>
      ) : (
        <div className="marketing-content-sections">
          {page.sections.map((section, index) => (
            <section key={section.title}>
              <span aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
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
      )}

      {editorial ? (
        <RelatedResources resources={editorial.related} />
      ) : (
        <aside className="marketing-content-next" aria-label="Next step">
          <div>
            <p className="eyebrow">Continue exploring</p>
            <h2>Take the next useful step.</h2>
          </div>
          <Link
            className="button-link button-link--accent"
            href={page.nextHref}
          >
            {page.nextLabel}
          </Link>
        </aside>
      )}
    </ArticleLayout>
  );
}
