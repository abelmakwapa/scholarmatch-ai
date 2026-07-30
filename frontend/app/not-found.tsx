import Link from "next/link";

export default function NotFound() {
  return (
    <main className="system-page" id="main-content">
      <p className="product-eyebrow">404 · Not found</p>
      <h1>This opportunity isn&rsquo;t here.</h1>
      <p>
        The page may have moved, expired, or never existed. No profile or
        application information was changed.
      </p>
      <div className="system-page__actions">
        <Link
          className="product-button product-button--accent"
          href="/scholarships"
        >
          Explore scholarships
        </Link>
        <Link className="product-button product-button--quiet" href="/">
          ScholarMatch home
        </Link>
      </div>
    </main>
  );
}
