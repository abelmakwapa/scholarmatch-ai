import { Clock3, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "./button-link";
import { useCases } from "./data";
import { HeroMatcher } from "./hero-matcher";
import { MatchingWorkspace } from "./matching-workspace";
import {
  faqItems,
  matchAnatomyTabs,
  opportunityExamples,
  readinessItems,
} from "./product-story-data";
import { SectionHeading } from "./section-heading";

export function HeroSection({
  authenticated = false,
}: {
  authenticated?: boolean;
}) {
  const findScholarshipsHref = authenticated
    ? "/matches"
    : "/sign-up?next=/onboarding";

  return (
    <section aria-labelledby="hero-heading" className="hero-section" id="top">
      <div className="hero-section__copy">
        <p className="eyebrow">Scholarships, matched with reasons</p>
        <h1 id="hero-heading">
          Don&apos;t hunt,
          <em> just match.</em>
        </h1>
        <p className="hero-section__lede">
          One student profile becomes ranked scholarship matches with visible
          reasons for every eligibility result.
        </p>
        <div className="hero-section__actions">
          <ButtonLink href={findScholarshipsHref}>
            Find my scholarships
          </ButtonLink>
          <ButtonLink href="#how-it-works" tone="light">
            See how matching works
          </ButtonLink>
        </div>
        <p className="hero-section__note">
          <ShieldCheck aria-hidden="true" size={16} />
          Your facts stay visible, and uncertain eligibility stays marked for
          review.
        </p>
      </div>
      <HeroMatcher />
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="product-demo-section"
      data-story-motion-root
      id="how-it-works"
    >
      <div className="section-shell">
        <SectionHeading
          align="center"
          description="Build a profile from facts you control, compare those facts with published rules, then review ranked opportunities with the reasoning attached. Unknown information remains visible for review."
          eyebrow="How it works"
          inverse
          title={
            <>
              Profile. Verify. <em>Match.</em>
            </>
          }
        />
        <MatchingWorkspace />
        <p className="section-disclaimer section-disclaimer--inverse">
          This example demonstrates the workflow. Eligibility and deadlines must
          still be confirmed with the official scholarship provider.
        </p>
      </div>
    </section>
  );
}

export function MatchAnatomySection() {
  return (
    <section
      aria-labelledby="match-anatomy-heading"
      className="match-anatomy-section"
      id="match-anatomy"
    >
      <div className="section-shell">
        <SectionHeading
          description="Open each layer of an illustrative result to see what is deterministic, what is ranked for relevance, and what still needs confirmation."
          eyebrow="Match anatomy"
          title={
            <>
              Inspect the result, <em>not just its position.</em>
            </>
          }
        />
        <MatchAnatomyStatic />
      </div>
    </section>
  );
}

export function OpportunityExplorerSection() {
  return (
    <section
      aria-labelledby="opportunity-explorer-heading"
      className="opportunity-explorer-section"
      id="opportunity-explorer"
    >
      <div className="section-shell">
        <SectionHeading
          align="center"
          description="Change the filters to see how a catalog can narrow without hiding why an example remains. These are fictional categories, not current scholarship listings."
          eyebrow="Opportunity explorer"
          inverse
          title={
            <>
              Explore the shape of <em>a useful shortlist.</em>
            </>
          }
        />
        <OpportunityExplorerStatic />
      </div>
    </section>
  );
}

export function ReadinessSection() {
  return (
    <section
      aria-labelledby="application-readiness-heading"
      className="application-readiness-section"
      id="application-readiness"
    >
      <div className="section-shell">
        <SectionHeading
          description="A relevant match is only actionable when the required evidence, writing, people, and timing are ready. Try the local checklist below."
          eyebrow="Application readiness"
          title={
            <>
              Turn interest into <em>a preparation plan.</em>
            </>
          }
        />
        <ReadinessStatic />
      </div>
    </section>
  );
}

export function UseCasesSection() {
  return (
    <section
      aria-labelledby="use-cases-heading"
      className="use-cases-section"
      id="use-cases"
    >
      <div className="section-shell">
        <SectionHeading
          description="Choose a path to see distinct profile facts, an example explanation, and the most useful next guide."
          eyebrow="Use cases"
          inverse
          title={
            <>
              Your plans change. <em>The logic should keep up.</em>
            </>
          }
        />
        <UseCasesStatic />
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section aria-labelledby="faq-heading" className="faq-section" id="faq">
      <div className="section-shell faq-section__shell">
        <SectionHeading
          description="Straight answers about rules, ranking, AI explanations, uncertainty, privacy, and correcting source data."
          eyebrow="Frequently asked questions"
          title={
            <>
              Know what the product does—<em>and what it does not.</em>
            </>
          }
        />
        <FaqStatic />
      </div>
    </section>
  );
}

function MatchAnatomyStatic() {
  return (
    <div className="match-anatomy">
      <article className="anatomy-card">
        <div className="anatomy-card__meta">
          <span>Illustrative example</span>
          <span>Not a live listing</span>
        </div>
        <p className="anatomy-card__type">Example education opportunity</p>
        <h3>Academic pathway opportunity</h3>
        <p>
          A sample-safe card showing how a student can inspect a result without
          treating the ranking as a guarantee.
        </p>
        <dl>
          <div>
            <dt>Eligibility status</dt>
            <dd>Review one detail</dd>
          </div>
          <div>
            <dt>Source status</dt>
            <dd>Example only</dd>
          </div>
        </dl>
        <a href="#application-readiness">Prepare an example checklist</a>
      </article>
      <div className="anatomy-inspector">
        <div
          aria-label="Scholarship match details"
          className="anatomy-tabs"
          data-product-tabs
          role="tablist"
        >
          {matchAnatomyTabs.map((tab, index) => (
            <button
              aria-controls={`anatomy-panel-${tab.id}`}
              aria-selected={index === 0}
              data-tab
              id={`anatomy-tab-${tab.id}`}
              key={tab.id}
              role="tab"
              tabIndex={index === 0 ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        {matchAnatomyTabs.map((tab, index) => (
          <div
            aria-labelledby={`anatomy-tab-${tab.id}`}
            className="anatomy-panel"
            data-panel
            hidden={index !== 0}
            id={`anatomy-panel-${tab.id}`}
            key={tab.id}
            role="tabpanel"
          >
            <p className="eyebrow">{tab.eyebrow}</p>
            <h3>{tab.title}</h3>
            <p>{tab.body}</p>
            <ul>
              {tab.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpportunityExplorerStatic() {
  return (
    <div className="opportunity-explorer" data-explorer>
      <div className="explorer-filters">
        <label>
          Study level
          <select data-filter="studyLevel" defaultValue="">
            <option value="">All examples</option>
            <option>Undergraduate</option>
            <option>Postgraduate</option>
          </select>
        </label>
        <label>
          Destination type
          <select data-filter="destination" defaultValue="">
            <option value="">All examples</option>
            <option>Home country</option>
            <option>International</option>
            <option>Regional</option>
          </select>
        </label>
        <label>
          Funding type
          <select data-filter="funding" defaultValue="">
            <option value="">All examples</option>
            <option>Study support</option>
            <option>Tuition support</option>
            <option>Project support</option>
          </select>
        </label>
        <label>
          Field
          <select data-filter="field" defaultValue="">
            <option value="">All examples</option>
            <option>Computing</option>
            <option>Health</option>
            <option>Public service</option>
            <option>Research</option>
          </select>
        </label>
        <button data-clear-filters disabled type="button">
          Clear filters
        </button>
      </div>
      <div className="explorer-results__meta">
        <strong aria-live="polite" data-result-count>
          {opportunityExamples.length} illustrative results
        </strong>
        <span>Examples are not live scholarships or provider offers.</span>
      </div>
      <div className="explorer-results">
        {opportunityExamples.map((opportunity) => (
          <article
            className="explorer-card"
            data-destination={opportunity.destination}
            data-example-card
            data-field={opportunity.field}
            data-funding={opportunity.funding}
            data-study-level={opportunity.studyLevel}
            key={opportunity.id}
          >
            <span>Illustrative example</span>
            <h3>{opportunity.title}</h3>
            <dl>
              <div>
                <dt>Level</dt>
                <dd>{opportunity.studyLevel}</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd>{opportunity.destination}</dd>
              </div>
              <div>
                <dt>Support type</dt>
                <dd>{opportunity.funding}</dd>
              </div>
              <div>
                <dt>Field</dt>
                <dd>{opportunity.field}</dd>
              </div>
            </dl>
            <p>{opportunity.reason}</p>
          </article>
        ))}
      </div>
      <div className="explorer-empty" data-explorer-empty hidden role="status">
        <h3>No examples match every selected filter.</h3>
        <p>
          Broaden one filter to compare another example. A real catalog would
          need current, source-backed scholarship records.
        </p>
        <button data-clear-filters type="button">
          Show all examples
        </button>
      </div>
    </div>
  );
}

function ReadinessStatic() {
  return (
    <div className="readiness-demo" data-readiness>
      <div className="readiness-demo__summary">
        <p className="eyebrow">Local planning demo</p>
        <h3 data-readiness-count>
          0 of {readinessItems.length} areas reviewed
        </h3>
        <p>
          Use this checklist to understand the preparation work around a match.
          Ticking an item does not verify a document or submit anything.
        </p>
        <div
          aria-label={`0 of ${readinessItems.length} readiness areas reviewed`}
          aria-valuemax={readinessItems.length}
          aria-valuemin={0}
          aria-valuenow={0}
          className="readiness-progress"
          role="progressbar"
        >
          <span data-readiness-bar />
        </div>
        <p className="readiness-demo__privacy">
          Progress stays only in this page&apos;s component state and resets
          when the page reloads.
        </p>
        <button data-readiness-reset disabled type="button">
          Reset checklist
        </button>
      </div>
      <ul className="readiness-list">
        {readinessItems.map((item, index) => (
          <li data-complete="false" key={item.id}>
            <label>
              <input type="checkbox" />
              <span aria-hidden="true">{index + 1}</span>
              <strong>{item.label}</strong>
            </label>
            <p>{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FaqStatic() {
  return (
    <div className="faq-list">
      {faqItems.map((item) => (
        <details className="faq-item" data-faq-item key={item.id}>
          <summary>
            <span>{item.question}</span>
            <i aria-hidden="true">+</i>
          </summary>
          <div data-faq-answer>
            <p>{item.answer}</p>
            {item.id === "corrections" ? (
              <Link href="/contact">Report data for review</Link>
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}

function UseCasesStatic() {
  return (
    <div className="use-case-tabs">
      <div
        aria-label="Student use cases"
        className="use-case-tabs__list"
        data-product-tabs
        role="tablist"
      >
        {useCases.map((useCase, index) => (
          <button
            aria-controls={`panel-${useCase.id}`}
            aria-selected={index === 0}
            data-tab
            id={`tab-${useCase.id}`}
            key={useCase.id}
            role="tab"
            tabIndex={index === 0 ? 0 : -1}
            type="button"
          >
            {useCase.label}
          </button>
        ))}
      </div>
      <div className="use-case-tabs__viewport">
        {useCases.map((useCase, index) => (
          <div
            aria-labelledby={`tab-${useCase.id}`}
            className="use-case-panel"
            data-panel
            hidden={index !== 0}
            id={`panel-${useCase.id}`}
            key={useCase.id}
            role="tabpanel"
          >
            <div className="use-case-panel__copy">
              <p className="eyebrow">{useCase.signal}</p>
              <h3>{useCase.title}</h3>
              <p>{useCase.description}</p>
              <div className="use-case-panel__explanation">
                <span>Why this example appears</span>
                <p>{useCase.explanation}</p>
              </div>
              <Link href={useCase.cta.href}>{useCase.cta.label}</Link>
            </div>
            <div
              aria-label={`${useCase.label} profile signals`}
              className="use-case-panel__visual"
            >
              <span className="use-case-panel__visual-label">
                Profile signals
              </span>
              {useCase.facts.map((fact, factIndex) => (
                <div className="use-case-panel__fact" key={fact}>
                  <span>{String(factIndex + 1).padStart(2, "0")}</span>
                  <strong>{fact}</strong>
                  <i aria-hidden="true">✓</i>
                </div>
              ))}
              <div className="use-case-panel__match">
                <span>Ready to compare</span>
                <strong>{useCase.signal}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClosingSection() {
  return (
    <section
      aria-labelledby="closing-heading"
      className="closing-section"
      id="start"
    >
      <div
        className="closing-section__orb closing-section__orb--one"
        aria-hidden="true"
      />
      <div
        className="closing-section__orb closing-section__orb--two"
        aria-hidden="true"
      />
      <div className="closing-section__content">
        <p className="eyebrow">A clearer place to begin</p>
        <h2 id="closing-heading">
          Your next opportunity
          <em> could already fit.</em>
        </h2>
        <p>
          Bring your goals and the facts you know. ScholarMatch will help
          organize the questions that matter before you invest in an
          application.
        </p>
        <div className="closing-section__actions">
          <ButtonLink href="/sign-up?next=/onboarding" tone="ink">
            Create my profile
          </ButtonLink>
          <a href="#top">Back to the top</a>
        </div>
        <div className="closing-section__trust">
          <span>
            <LockKeyhole aria-hidden="true" size={15} /> Private profile data
          </span>
          <span>
            <FileText aria-hidden="true" size={15} /> Explainable results
          </span>
          <span>
            <Clock3 aria-hidden="true" size={15} /> Deadline context
          </span>
        </div>
      </div>
    </section>
  );
}
