import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <Suspense
      fallback={<div className="auth-card__loading" aria-hidden="true" />}
    >
      <SignInForm />
    </Suspense>
  );
}
