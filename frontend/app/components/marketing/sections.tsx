import {
  ArrowRight,
  Check,
  CircleAlert,
  Clock3,
  FileText,
  Fingerprint,
  ListFilter,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ButtonLink } from "./button-link";
import { approvedStudentStories, categories, features } from "./data";
import { HeroMatcher } from "./hero-matcher";
import { SectionHeading } from "./section-heading";
import { StudentStories } from "./student-stories";
import { UseCaseTabs } from "./use-case-tabs";

export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="hero-section" id="top">
      <div className="hero-section__copy">
        <p className="eyebrow">Scholarships, matched with reasons</p>
        <h1 id="hero-heading">
          Don&apos;t hunt,
          <em> just match.</em>
        </h1>
        <p className="hero-section__lede">
          Build one profile. See opportunities shaped by verified eligibility,
          your goals, and what you are ready to submit.
        </p>
        <div className="hero-section__actions">
          <ButtonLink href="#start">Find my scholarships</ButtonLink>
          <ButtonLink href="#how-it-works" tone="light">
            See how matching works
          </ButtonLink>
        </div>
        <p className="hero-section__note">
          <ShieldCheck aria-hidden="true" size={16} />
          AI explains matches. Published rules decide eligibility.
        </p>
      </div>
      <HeroMatcher />
    </section>
  );
}

export function ProductDemoSection() {
  const profileFacts = [
    ["Study level", "Undergraduate"],
    ["Field", "Computer science"],
    ["Location", "Botswana"],
  ];

  return (
    <section
      aria-labelledby="product-demo-heading"
      className="product-demo-section"
      id="product"
    >
      <div className="section-shell">
        <SectionHeading
          align="center"
          description="A visible path from the facts you provide to a ranked, explainable result. This interface is illustrative and contains no live student data."
          eyebrow="The matching path"
          inverse
          title={
            <>
              Facts in. <em>Fit made clear.</em>
            </>
          }
        />

        <div className="matching-workbench" id="how-it-works">
          <div className="matching-workbench__topbar">
            <div>
              <span className="status-dot" />
              <strong>ScholarMatch workspace</strong>
            </div>
            <span>Illustrative interface</span>
          </div>

          <div className="matching-workbench__grid">
            <article className="workbench-panel workbench-profile">
              <div className="workbench-panel__heading">
                <span className="workbench-icon">
                  <Fingerprint aria-hidden="true" size={18} />
                </span>
                <div>
                  <p>Step 01</p>
                  <h3>Profile facts</h3>
                </div>
              </div>
              <div className="profile-fact-list">
                {profileFacts.map(([label, value]) => (
                  <div className="profile-fact" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <Check aria-hidden="true" size={15} />
                  </div>
                ))}
              </div>
              <p className="workbench-caption">
                You control the facts. Missing information stays visible.
              </p>
            </article>

            <article className="workbench-panel workbench-rules">
              <div className="workbench-panel__heading">
                <span className="workbench-icon">
                  <ListFilter aria-hidden="true" size={18} />
                </span>
                <div>
                  <p>Step 02</p>
                  <h3>Eligibility checks</h3>
                </div>
              </div>
              <div
                className="rule-path"
                aria-label="Eligibility check sequence"
              >
                <div className="rule-path__item rule-path__item--pass">
                  <Check aria-hidden="true" size={15} />
                  <span>Study level</span>
                  <strong>Confirmed</strong>
                </div>
                <div className="rule-path__line" aria-hidden="true" />
                <div className="rule-path__item rule-path__item--pass">
                  <Check aria-hidden="true" size={15} />
                  <span>Location rule</span>
                  <strong>Confirmed</strong>
                </div>
                <div className="rule-path__line" aria-hidden="true" />
                <div className="rule-path__item rule-path__item--unknown">
                  <CircleAlert aria-hidden="true" size={15} />
                  <span>Document detail</span>
                  <strong>Unknown</strong>
                </div>
              </div>
              <p className="workbench-caption">
                Hard rules filter first. Unknown never silently means
                ineligible.
              </p>
            </article>

            <article className="workbench-panel workbench-matches">
              <div className="workbench-panel__heading">
                <span className="workbench-icon workbench-icon--accent">
                  <Sparkles aria-hidden="true" size={18} />
                </span>
                <div>
                  <p>Step 03</p>
                  <h3>Ranked matches</h3>
                </div>
              </div>
              <div className="match-result-card">
                <div>
                  <span>01</span>
                  <p>Strong eligibility fit</p>
                </div>
                <strong>Ready to review</strong>
                <ul>
                  <li>Academic requirements align</li>
                  <li>Relevant interests detected</li>
                  <li>One detail still needed</li>
                </ul>
              </div>
              <div
                className="match-result-card match-result-card--muted"
                aria-hidden="true"
              >
                <div>
                  <span>02</span>
                  <p>Promising fit</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProofBand() {
  return (
    <section aria-labelledby="category-heading" className="proof-band">
      <div className="proof-band__intro">
        <p className="eyebrow">Built to explore many paths</p>
        <h2 id="category-heading">Start with your goals, not a search box.</h2>
      </div>
      <div className="category-marquee" data-testid="category-marquee">
        <div className="category-marquee__track">
          {[0, 1].map((setIndex) => (
            <ul aria-hidden={setIndex === 1} key={setIndex}>
              {categories.map((category, index) => (
                <li key={category}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {category}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OutcomeSection() {
  return (
    <section aria-labelledby="outcome-heading" className="outcome-section">
      <div className="section-shell">
        <SectionHeading
          align="center"
          description="ScholarMatch is designed to move the difficult questions—eligibility, evidence, timing, and missing information—closer to the start."
          eyebrow="A more useful starting point"
          title={
            <>
              One profile. <em>Better matches.</em>
            </>
          }
        />

        <div className="comparison-visual">
          <article className="comparison-card comparison-card--search">
            <div className="comparison-card__header">
              <Search aria-hidden="true" size={20} />
              <div>
                <p>Search-first</p>
                <h3>Open every door yourself</h3>
              </div>
            </div>
            <div className="search-window" aria-hidden="true">
              <span>scholarship for...</span>
              <Search size={15} />
            </div>
            <div className="search-lines" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
            <p>Requirements, relevance, and timing live in different places.</p>
          </article>

          <div className="comparison-arrow" aria-hidden="true">
            <ArrowRight size={28} strokeWidth={1.6} />
          </div>

          <article className="comparison-card comparison-card--match">
            <div className="comparison-card__header">
              <Sparkles aria-hidden="true" size={20} />
              <div>
                <p>Match-first</p>
                <h3>Start with evidence of fit</h3>
              </div>
            </div>
            <div className="fit-stack">
              <div>
                <span>Eligibility</span>
                <strong>Checked</strong>
              </div>
              <div>
                <span>Why it fits</span>
                <strong>Explained</strong>
              </div>
              <div>
                <span>What is missing</span>
                <strong>Visible</strong>
              </div>
            </div>
            <p>
              Review the strongest candidates with the decision trail attached.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

export function UseCasesSection() {
  return (
    <section
      aria-labelledby="use-cases-heading"
      className="use-cases-section"
      id="students"
    >
      <div className="section-shell">
        <SectionHeading
          description="Choose a path to see which facts matter and how the explanation changes."
          eyebrow="Made for different study paths"
          inverse
          title={
            <>
              Your plans change. <em>The logic should keep up.</em>
            </>
          }
        />
        <UseCaseTabs />
      </div>
    </section>
  );
}

export function FeaturesSection() {
  return (
    <section
      aria-labelledby="features-heading"
      className="features-section"
      id="resources"
    >
      <div className="section-shell">
        <SectionHeading
          description="A recommendation is useful when you can see its limits, inspect its reasons, and act on what comes next."
          eyebrow="Clarity at every step"
          title={
            <>
              Matching is more than <em>a score.</em>
            </>
          }
        />

        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.number}>
              <div className="feature-card__meta">
                <span>{feature.number}</span>
                <feature.icon aria-hidden="true" size={22} strokeWidth={1.7} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <div className="feature-card__signal">
                <span>{feature.visualLabel}</span>
                <i aria-hidden="true" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StoriesSection() {
  return (
    <section aria-labelledby="stories-heading" className="stories-section">
      <div className="section-shell stories-section__shell">
        <SectionHeading
          description="No fabricated quotes, no borrowed endorsements. Only approved, attributable experiences belong here."
          eyebrow="Student stories"
          title={
            <>
              Real voices, <em>when they&apos;re ready.</em>
            </>
          }
        />
        <StudentStories stories={approvedStudentStories} />
      </div>
    </section>
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
          <ButtonLink href="/sign-up" tone="ink">
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
