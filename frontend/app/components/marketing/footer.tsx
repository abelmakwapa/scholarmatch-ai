import { ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { footerUtilityLinks, marketingNavGroups } from "./navigation-data";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <Link
            aria-label="ScholarMatch home"
            className="wordmark wordmark--footer"
            href="/"
          >
            <span className="wordmark__mark" aria-hidden="true">
              <Sparkles size={16} strokeWidth={2.4} />
            </span>
            <span>ScholarMatch</span>
          </Link>
          <p>
            Explainable scholarship discovery built around verified eligibility
            and the facts students choose to share.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="site-footer__links">
          {marketingNavGroups.map((group) => (
            <div key={group.id}>
              <h2>{group.label}</h2>
              {group.links.map((link) => (
                <Link href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} ScholarMatch AI</p>
        <div>
          {footerUtilityLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
        <a className="site-footer__top-link" href="#page-top">
          Top <ArrowUpRight aria-hidden="true" size={16} />
        </a>
      </div>
    </footer>
  );
}
