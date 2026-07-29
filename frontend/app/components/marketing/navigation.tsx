"use client";

import { Menu, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { navItems } from "./data";

export function Navigation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="site-header" data-testid="site-header">
      <nav aria-label="Main navigation" className="site-nav">
        <a aria-label="ScholarMatch home" className="wordmark" href="#top">
          <span className="wordmark__mark" aria-hidden="true">
            <Sparkles size={16} strokeWidth={2.4} />
          </span>
          <span>ScholarMatch</span>
        </a>

        <div className="site-nav__desktop-links">
          {navItems.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <div className="site-nav__actions">
          <a className="site-nav__signin" href="/sign-in">
            Sign in
          </a>
          <a className="site-nav__cta" href="/sign-up">
            Find scholarships
          </a>
          <button
            aria-controls="mobile-navigation"
            aria-expanded={open}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            className="site-nav__menu-button"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            {open ? (
              <X aria-hidden="true" size={22} />
            ) : (
              <Menu aria-hidden="true" size={22} />
            )}
          </button>
        </div>
      </nav>

      <div
        className="mobile-navigation"
        data-open={open}
        hidden={!open}
        id="mobile-navigation"
      >
        {navItems.map((item) => (
          <a href={item.href} key={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </a>
        ))}
        <a href="/sign-in" onClick={() => setOpen(false)}>
          Sign in
        </a>
        <a
          className="mobile-navigation__cta"
          href="/sign-up"
          onClick={() => setOpen(false)}
        >
          Find scholarships
        </a>
      </div>
    </header>
  );
}
