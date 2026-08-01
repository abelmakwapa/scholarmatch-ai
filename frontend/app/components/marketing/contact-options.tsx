import { Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function ContactOptions({ supportEmail }: { supportEmail?: string }) {
  return (
    <section
      className="contact-options"
      aria-labelledby="contact-route-heading"
    >
      <div>
        <p className="eyebrow">Available contact route</p>
        <h2 id="contact-route-heading">
          {supportEmail
            ? "Send a focused support email."
            : "No public support inbox is configured yet."}
        </h2>
        <p>
          {supportEmail
            ? "Use the configured address below. Include only the details needed to understand the request."
            : "This repository has no contact endpoint or public support address, so the page does not display a form that cannot submit. The self-service resources below remain available."}
        </p>
      </div>

      {supportEmail ? (
        <a
          className="button-link button-link--accent"
          href={`mailto:${supportEmail}`}
        >
          <Mail aria-hidden="true" size={17} /> Email {supportEmail}
        </a>
      ) : (
        <div className="contact-options__self-service">
          <ShieldCheck aria-hidden="true" size={20} />
          <p>
            Check the <Link href="/faq">FAQ</Link>, read the{" "}
            <Link href="/privacy">privacy approach</Link>, or review the{" "}
            <Link href="/accessibility">accessibility statement</Link>.
          </p>
        </div>
      )}
    </section>
  );
}
