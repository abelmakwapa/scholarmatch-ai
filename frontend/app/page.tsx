import { Footer } from "./components/marketing/footer";
import { Navigation } from "./components/marketing/navigation";
import { getOptionalAuthenticatedSession } from "./lib/auth/server-session";
import {
  ClosingSection,
  FeaturesSection,
  HeroSection,
  OutcomeSection,
  ProductDemoSection,
  ProofBand,
  StoriesSection,
  UseCasesSection,
} from "./components/marketing/sections";

export default async function Home() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const session = await getOptionalAuthenticatedSession();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ScholarMatch AI",
    url: siteUrl,
    description:
      "Explainable scholarship discovery built around verified eligibility and student-provided profile facts.",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Navigation authenticated={Boolean(session)} />
      <main id="main-content">
        <HeroSection />
        <ProductDemoSection />
        <ProofBand />
        <OutcomeSection />
        <UseCasesSection />
        <FeaturesSection />
        <StoriesSection />
        <ClosingSection />
      </main>
      <Footer />
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />
    </>
  );
}
