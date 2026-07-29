import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="standalone-state">
      <div className="standalone-state__panel">
        <span className="standalone-state__icon" aria-hidden="true">
          <ShieldAlert />
        </span>
        <p className="eyebrow">Access restricted</p>
        <h1>This workspace is for student accounts.</h1>
        <p>
          Your account is signed in, but its assigned role cannot access
          student-owned profile data.
        </p>
        <Link className="product-button product-button--accent" href="/">
          <ArrowLeft aria-hidden="true" size={16} />
          Return home
        </Link>
      </div>
    </main>
  );
}
