"use client";

import {
  FileCheck2,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Sparkles },
  { href: "/scholarships", label: "Scholarships", icon: GraduationCap },
  { href: "/applications", label: "Applications", icon: FileCheck2 },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type AppNavigationProps = {
  displayName: string;
  email: string | null;
};

export function AppNavigation({ displayName, email }: AppNavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navigationId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <header className="workspace-mobile-header">
        <Brand />
        <button
          type="button"
          className="workspace-menu-button"
          aria-controls={navigationId}
          aria-expanded={open}
          aria-label={open ? "Close application menu" : "Open application menu"}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <aside
        className="workspace-sidebar"
        id={navigationId}
        data-open={open || undefined}
      >
        <div className="workspace-sidebar__brand">
          <Brand />
          <button
            type="button"
            className="workspace-sidebar__close"
            aria-label="Close application menu"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <nav className="workspace-nav" aria-label="Application">
          <ul>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/dashboard" && pathname.startsWith(`${href}/`));
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
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
          aria-label="Close application menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function Brand() {
  return (
    <Link
      className="workspace-brand"
      href="/dashboard"
      aria-label="ScholarMatch dashboard"
    >
      <span className="workspace-brand__mark" aria-hidden="true">
        <FileText size={16} strokeWidth={2.2} />
      </span>
      <span>ScholarMatch</span>
    </Link>
  );
}
