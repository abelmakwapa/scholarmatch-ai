"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import {
  reportMarketingCta,
  type MarketingCtaId,
} from "@/app/lib/observability/client";

type TrackedLinkProps = Omit<ComponentProps<typeof Link>, "children"> & {
  children: ReactNode;
  trackingId: MarketingCtaId;
};

export function TrackedLink({
  children,
  href,
  onClick,
  trackingId,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        reportMarketingCta(trackingId, String(href));
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
