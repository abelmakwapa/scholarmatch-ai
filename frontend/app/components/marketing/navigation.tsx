"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Menu, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  isMarketingHrefActive,
  marketingNavGroups,
  type MarketingNavGroup,
} from "./navigation-data";

type GroupId = MarketingNavGroup["id"];

type NavigationProps = {
  authenticated?: boolean;
};

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Navigation({ authenticated = false }: NavigationProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [desktopOpen, setDesktopOpen] = useState<GroupId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<GroupId | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const previousPathnameRef = useRef(pathname);
  const desktopTriggerRefs = useRef<
    Partial<Record<GroupId, HTMLButtonElement | null>>
  >({});
  const duration = reduceMotion ? 0 : 0.2;
  const findScholarshipsHref = authenticated
    ? "/matches"
    : "/sign-up?next=/onboarding";

  const closeMobile = (restoreFocus = false) => {
    setMobileOpen(false);
    setMobileGroup(null);
    if (restoreFocus) {
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    const frame = requestAnimationFrame(() => {
      setDesktopOpen(null);
      setMobileOpen(false);
      setMobileGroup(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!desktopOpen && !mobileOpen) return;

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (
        !headerRef.current?.contains(target) &&
        !mobilePanelRef.current?.contains(target)
      ) {
        setDesktopOpen(null);
        closeMobile(mobileOpen);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [desktopOpen, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const backgroundElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        !element.matches(".mobile-navigation, .mobile-navigation__backdrop"),
    );
    const backgroundState = backgroundElements.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    document.body.style.overflow = "hidden";
    for (const element of backgroundElements) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
    requestAnimationFrame(() => mobileCloseRef.current?.focus());

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile(true);
        return;
      }

      if (event.key !== "Tab" || !mobilePanelRef.current) return;
      const focusable = Array.from(
        mobilePanelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      for (const { element, inert, ariaHidden } of backgroundState) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!desktopOpen || mobileOpen) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const openId = desktopOpen;
      setDesktopOpen(null);
      requestAnimationFrame(() => desktopTriggerRefs.current[openId]?.focus());
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [desktopOpen, mobileOpen]);

  const handleDesktopPointerEnter = (
    event: PointerEvent<HTMLDivElement>,
    groupId: GroupId,
  ) => {
    if (event.pointerType === "mouse") setDesktopOpen(groupId);
  };

  const handleDesktopBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDesktopOpen(null);
    }
  };

  const handleDesktopTriggerKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    groupId: GroupId,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setDesktopOpen(groupId);
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`#desktop-panel-${groupId} a`)
          ?.focus();
      });
    }
  };

  return (
    <header
      className="site-header"
      data-testid="site-header"
      id="page-top"
      ref={headerRef}
    >
      <nav aria-label="Main navigation" className="site-nav">
        <Link
          aria-current={pathname === "/" ? "page" : undefined}
          aria-label="ScholarMatch home"
          className="wordmark"
          href="/"
        >
          <span className="wordmark__mark" aria-hidden="true">
            <Sparkles size={16} strokeWidth={2.4} />
          </span>
          <span>ScholarMatch</span>
        </Link>

        <div
          className="site-nav__desktop-links"
          onPointerLeave={() => setDesktopOpen(null)}
        >
          {marketingNavGroups.map((group) => {
            const expanded = desktopOpen === group.id;
            const active = group.links.some((link) =>
              isMarketingHrefActive(pathname, link.href),
            );

            return (
              <div
                className="site-nav__group"
                data-active={active || undefined}
                key={group.id}
                onBlur={handleDesktopBlur}
                onPointerEnter={(event) =>
                  handleDesktopPointerEnter(event, group.id)
                }
              >
                <button
                  aria-controls={`desktop-panel-${group.id}`}
                  aria-expanded={expanded}
                  className="site-nav__trigger"
                  onClick={() => setDesktopOpen(group.id)}
                  onKeyDown={(event) =>
                    handleDesktopTriggerKeyDown(event, group.id)
                  }
                  ref={(node) => {
                    desktopTriggerRefs.current[group.id] = node;
                  }}
                  type="button"
                >
                  {group.label}
                  <ChevronDown aria-hidden="true" size={14} strokeWidth={2} />
                  {active ? (
                    <motion.span
                      className="site-nav__active-indicator"
                      layoutId="marketing-nav-active"
                    />
                  ) : null}
                </button>

                <AnimatePresence>
                  {expanded ? (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className="site-nav__dropdown"
                      exit={{ opacity: 0, y: -6 }}
                      id={`desktop-panel-${group.id}`}
                      initial={{ opacity: 0, y: -6 }}
                      transition={{ duration }}
                    >
                      <div className="site-nav__dropdown-intro">
                        <span>{group.label}</span>
                        <p>{group.description}</p>
                      </div>
                      <ul>
                        {group.links.map((link) => {
                          const current = isMarketingHrefActive(
                            pathname,
                            link.href,
                          );
                          return (
                            <li key={link.href}>
                              <Link
                                aria-current={current ? "page" : undefined}
                                href={link.href}
                                onNavigate={() => setDesktopOpen(null)}
                              >
                                <strong>{link.label}</strong>
                                <span>{link.description}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="site-nav__actions">
          <Link className="site-nav__signin" href="/sign-in">
            Sign in
          </Link>
          <Link className="site-nav__cta" href={findScholarshipsHref}>
            Find scholarships
          </Link>
          <button
            aria-controls="mobile-navigation"
            aria-expanded={mobileOpen}
            aria-label="Open navigation menu"
            className="site-nav__menu-button"
            onClick={() => setMobileOpen(true)}
            ref={menuButtonRef}
            type="button"
          >
            <Menu aria-hidden="true" size={22} />
          </button>
        </div>
      </nav>

      {typeof document === "undefined"
        ? null
        : createPortal(
            <AnimatePresence>
              {mobileOpen ? (
                <>
                  <motion.button
                    animate={{ opacity: 1 }}
                    aria-hidden="true"
                    className="mobile-navigation__backdrop"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    onClick={() => closeMobile(true)}
                    tabIndex={-1}
                    transition={{ duration }}
                    type="button"
                  />
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    aria-label="Mobile navigation"
                    aria-modal="true"
                    className="mobile-navigation"
                    exit={{ opacity: 0, x: 24 }}
                    id="mobile-navigation"
                    initial={{ opacity: 0, x: 24 }}
                    ref={mobilePanelRef}
                    role="dialog"
                    transition={{ duration }}
                  >
                    <div className="mobile-navigation__header">
                      <div>
                        <span>Explore ScholarMatch</span>
                        <p>Find the right information for your next step.</p>
                      </div>
                      <button
                        aria-label="Close navigation menu"
                        className="site-nav__menu-button"
                        onClick={() => closeMobile(true)}
                        ref={mobileCloseRef}
                        type="button"
                      >
                        <X aria-hidden="true" size={22} />
                      </button>
                    </div>

                    <div className="mobile-navigation__groups">
                      {marketingNavGroups.map((group) => {
                        const expanded = mobileGroup === group.id;
                        return (
                          <div
                            className="mobile-navigation__group"
                            key={group.id}
                          >
                            <button
                              aria-controls={`mobile-panel-${group.id}`}
                              aria-expanded={expanded}
                              onClick={() =>
                                setMobileGroup((current) =>
                                  current === group.id ? null : group.id,
                                )
                              }
                              type="button"
                            >
                              <span>{group.label}</span>
                              <ChevronDown aria-hidden="true" size={18} />
                            </button>
                            <AnimatePresence initial={false}>
                              {expanded ? (
                                <motion.div
                                  animate={{ height: "auto", opacity: 1 }}
                                  className="mobile-navigation__panel"
                                  exit={{ height: 0, opacity: 0 }}
                                  id={`mobile-panel-${group.id}`}
                                  initial={{ height: 0, opacity: 0 }}
                                  transition={{ duration }}
                                >
                                  <p>{group.description}</p>
                                  <ul>
                                    {group.links.map((link) => (
                                      <li key={link.href}>
                                        <Link
                                          aria-current={
                                            isMarketingHrefActive(
                                              pathname,
                                              link.href,
                                            )
                                              ? "page"
                                              : undefined
                                          }
                                          href={link.href}
                                          onNavigate={() => closeMobile(false)}
                                        >
                                          <strong>{link.label}</strong>
                                          <span>{link.description}</span>
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mobile-navigation__actions">
                      <Link
                        href="/sign-in"
                        onNavigate={() => closeMobile(false)}
                      >
                        Sign in
                      </Link>
                      <Link
                        className="mobile-navigation__cta"
                        href={findScholarshipsHref}
                        onNavigate={() => closeMobile(false)}
                      >
                        Find scholarships
                      </Link>
                    </div>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>,
            document.body,
          )}
    </header>
  );
}
