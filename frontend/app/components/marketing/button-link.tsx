import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  children: ReactNode;
  href: string;
  tone?: "accent" | "ink" | "light";
  showArrow?: boolean;
};

export function ButtonLink({
  children,
  href,
  tone = "accent",
  showArrow = true,
}: ButtonLinkProps) {
  return (
    <a className={`button-link button-link--${tone}`} href={href}>
      <span>{children}</span>
      {showArrow ? (
        <ArrowUpRight aria-hidden="true" size={17} strokeWidth={2.2} />
      ) : null}
    </a>
  );
}
