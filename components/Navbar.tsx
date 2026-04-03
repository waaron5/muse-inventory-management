"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import styles from "./Navbar.module.css";

const NAV_ITEMS = [
  { label: "Events", href: "/events", iconClass: "eventsIcon" },
  { label: "Inventory", href: "/inventory", iconClass: "inventoryIcon" },
  { label: "Gifting", href: "/gifting", iconClass: "giftingIcon" },
] as const;

interface NavbarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const displayName = user.name.trim() || user.email;
  const initials = getInitials(displayName);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className={styles.navbar}>
      <div className={styles.navbarLeft}>
        <Link href="/dashboard" className={styles.navbarLogo} aria-label="Go to dashboard">
          <Image
            src="/muse-logo.png"
            alt="Muse"
            width={84}
            height={30}
            style={{ objectFit: "contain" }}
            priority
          />
        </Link>

        <nav className={styles.navbarNav} aria-label="Primary navigation">
          {NAV_ITEMS.map(({ href, label, iconClass }) => {
            const active = isActive(href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              >
                <span className={`${styles.navIcon} ${styles[iconClass]}`} aria-hidden="true" />
                <span className={styles.navLinkLabel}>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.navbarRight} ref={accountRef}>
        <span className={styles.navbarUserName}>{displayName}</span>
        <button
          type="button"
          className={`${styles.accountTrigger} ${menuOpen ? styles.accountTriggerOpen : ""}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Open account menu for ${displayName}`}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={styles.accountAvatar}>{initials}</span>
        </button>

        {menuOpen && (
          <div className={styles.accountMenu} aria-label="Account menu">
            <button
              type="button"
              className={styles.accountMenuItem}
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogoutIcon className={styles.accountMenuIcon} />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "ME";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M10 17.5H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h4" />
      <path d="M14 16.5 19 12l-5-4.5" />
      <path d="M9 12h10" />
    </svg>
  );
}
