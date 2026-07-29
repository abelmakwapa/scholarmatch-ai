import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shell for the authentication routes. It carries the ivory/ink/lavender
 * identity but strips marketing motion in favour of a calm, single-column
 * layout that keeps the form the clear focus.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <a className="skip-link" href="#auth-main">
        Skip to main content
      </a>
      <header className="auth-shell__header">
        <Link aria-label="ScholarMatch home" className="wordmark" href="/">
          <span className="wordmark__mark" aria-hidden="true">
            <Sparkles size={16} strokeWidth={2.4} />
          </span>
          <span>ScholarMatch</span>
        </Link>
      </header>
      <main className="auth-shell__main" id="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
