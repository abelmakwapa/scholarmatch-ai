import type { ReactNode } from "react";

import "./editorial.css";

import { Footer } from "@/app/components/marketing/footer";
import { MarketingPagePresence } from "@/app/components/marketing/marketing-page-presence";
import { Navigation } from "@/app/components/marketing/navigation";
import { getOptionalAuthenticatedSession } from "@/app/lib/auth/server-session";

export default async function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getOptionalAuthenticatedSession();

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Navigation authenticated={Boolean(session)} />
      <MarketingPagePresence>
        <main className="marketing-content-main" id="main-content">
          {children}
        </main>
      </MarketingPagePresence>
      <Footer />
    </>
  );
}
