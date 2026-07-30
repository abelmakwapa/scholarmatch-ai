"use client";

import {
  BookCheck,
  Files,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/scholarships", label: "Scholarships", icon: GraduationCap },
  { href: "/admin/ingestion", label: "Ingestion", icon: Network },
  { href: "/admin/duplicates", label: "Duplicates", icon: Files },
  { href: "/admin/verification", label: "Verification", icon: BookCheck },
  { href: "/admin/audit", label: "Audit history", icon: History },
] as const;

export function AdminNavigation({
  displayName,
  email,
}: {
  displayName: string;
  email: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const id = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus)
      requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    };
    const main = document.getElementById("admin-main");
    if (main) main.inert = true;
    closeButtonRef.current?.focus();
    document.addEventListener("keydown", close);
    return () => {
      if (main) main.inert = false;
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <>
      <header className="workspace-mobile-header admin-mobile-header">
        <AdminBrand />
        <button
          type="button"
          className="workspace-menu-button"
          aria-controls={id}
          aria-expanded={open}
          aria-label={
            open ? "Close administration menu" : "Open administration menu"
          }
          onClick={() => setOpen((current) => !current)}
          ref={menuButtonRef}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>
      <aside
        className="workspace-sidebar admin-sidebar"
        id={id}
        data-open={open || undefined}
      >
        <div className="workspace-sidebar__brand">
          <AdminBrand />
          <button
            type="button"
            className="workspace-sidebar__close"
            aria-label="Close administration menu"
            onClick={() => closeMenu(true)}
            ref={closeButtonRef}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <p className="admin-nav-label">Data operations</p>
        <nav className="workspace-nav" aria-label="Administration">
          <ul>
            {ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/admin"
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => closeMenu()}
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="workspace-account">
          <span className="workspace-account__avatar" aria-hidden="true">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="workspace-account__copy">
            <strong>{displayName}</strong>
            {email ? <small>{email}</small> : null}
          </span>
          <form action="/auth/signout" method="post">
            <button type="submit" aria-label="Sign out">
              <LogOut aria-hidden="true" size={17} />
            </button>
          </form>
        </div>
      </aside>
      {open ? (
        <button
          className="workspace-scrim"
          type="button"
          aria-label="Close administration menu"
          onClick={() => closeMenu(true)}
        />
      ) : null}
    </>
  );
}

function AdminBrand() {
  return (
    <Link
      className="workspace-brand"
      href="/admin"
      aria-label="ScholarMatch administration"
    >
      <span className="workspace-brand__mark" aria-hidden="true">
        <ShieldCheck size={16} />
      </span>
      <span>
        ScholarMatch <small>Admin</small>
      </span>
    </Link>
  );
}
