import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Shell for authenticated app routes: a slim header and a sign-out control. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-main">
        Skip to main content
      </a>
      <header className="app-shell__header">
        <Link aria-label="ScholarMatch home" className="wordmark" href="/">
          <span className="wordmark__mark" aria-hidden="true">
            <Sparkles size={16} strokeWidth={2.4} />
          </span>
          <span>ScholarMatch</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button className="app-shell__signout" type="submit">
            Sign out
          </button>
        </form>
      </header>
      <main className="app-shell__main" id="app-main">
        {children}
      </main>
    </div>
  );
}
