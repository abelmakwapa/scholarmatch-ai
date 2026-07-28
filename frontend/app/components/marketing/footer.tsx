import { ArrowUpRight, Sparkles } from "lucide-react";

const footerGroups = [
  {
    title: "Product",
    links: [
      ["How matching works", "#how-it-works"],
      ["For students", "#students"],
      ["Features", "#resources"],
      ["Sign in", "/sign-in"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Scholarship guide", "/resources/scholarship-guide"],
      ["Profile checklist", "/resources/profile-checklist"],
      ["Application planning", "/resources/application-planning"],
      ["Help center", "/help"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "#about"],
      ["Contact", "/contact"],
      ["Accessibility", "/accessibility"],
      ["System status", "/status"],
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="site-footer" id="about">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <a
            aria-label="ScholarMatch home"
            className="wordmark wordmark--footer"
            href="#top"
          >
            <span className="wordmark__mark" aria-hidden="true">
              <Sparkles size={16} strokeWidth={2.4} />
            </span>
            <span>ScholarMatch</span>
          </a>
          <p>
            Explainable scholarship discovery built around verified eligibility
            and the facts students choose to share.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="site-footer__links">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h2>{group.title}</h2>
              {group.links.map(([label, href]) => (
                <a href={href} key={label}>
                  {label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} ScholarMatch AI</p>
        <div>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/data-controls">Data controls</a>
        </div>
        <a className="site-footer__top-link" href="#top">
          Top <ArrowUpRight aria-hidden="true" size={16} />
        </a>
      </div>
    </footer>
  );
}
