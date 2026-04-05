"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import styles from "./Navbar.module.css";

type Theme = "light" | "dark";

const NAV_ITEMS = [
  { label: "Events", href: "/events", iconClass: "eventsIcon" },
  { label: "Inventory", href: "/inventory", iconClass: "inventoryIcon" },
  { label: "Gifting", href: "/gifting", iconClass: "giftingIcon" },
  { label: "Reservations", href: "/reservations", iconClass: "reservationsIcon" },
] as const;

const THEME_STORAGE_KEY = "muse-theme";
const RESERVATIONS_SEEN_STORAGE_KEY_PREFIX = "muse-reservations-seen";

interface NavbarProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  reservationsHasAttention?: boolean;
  reservationNotificationAt?: string | null;
}

export function Navbar({
  user,
  reservationsHasAttention = false,
  reservationNotificationAt = null,
}: NavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [reservationsSeenAt, setReservationsSeenAt] = useState<string | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const displayName = user.name.trim() || user.email;
  const initials = getInitials(displayName);
  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const reservationsSeenStorageKey = `${RESERVATIONS_SEEN_STORAGE_KEY_PREFIX}:${user.id}`;
  const hasUnseenReservationUpdate =
    parseTimestamp(reservationNotificationAt) > parseTimestamp(reservationsSeenAt);
  const showReservationsIndicator =
    reservationsHasAttention || hasUnseenReservationUpdate;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const initialTheme = readTheme();
    applyTheme(initialTheme);
    setTheme(initialTheme);

    function handleStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return;
      const storedTheme = event.newValue;
      if (storedTheme !== "light" && storedTheme !== "dark") return;

      applyTheme(storedTheme);
      setTheme(storedTheme);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    try {
      setReservationsSeenAt(
        window.localStorage.getItem(reservationsSeenStorageKey)
      );
    } catch {
      setReservationsSeenAt(null);
    }
  }, [reservationsSeenStorageKey]);

  useEffect(() => {
    if (!pathname.startsWith("/reservations")) return;
    if (!reservationNotificationAt) return;

    try {
      window.localStorage.setItem(
        reservationsSeenStorageKey,
        reservationNotificationAt
      );
    } catch {}

    setReservationsSeenAt(reservationNotificationAt);
  }, [pathname, reservationNotificationAt, reservationsSeenStorageKey]);

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

  function handleThemeToggle() {
    applyTheme(nextTheme);
    setTheme(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {}
  }

  return (
    <header className={styles.navbar}>
      <div className={styles.navbarLeft}>
        <Link href="/dashboard" className={styles.navbarLogo} aria-label="Go to dashboard">
          <Image
            src="/muse-logo.png"
            alt="Muse"
            width={124}
            height={30}
            style={{ width: "auto", height: 21, objectFit: "contain" }}
            priority
          />
        </Link>

        <nav className={styles.navbarNav} aria-label="Primary navigation">
          {NAV_ITEMS.map(({ href, label, iconClass }) => {
            const active = isActive(href);
            const isEventsIcon = iconClass === "eventsIcon";
            const isInventoryIcon = iconClass === "inventoryIcon";
            const isReservationsIcon = iconClass === "reservationsIcon";
            const isGiftingIcon = iconClass === "giftingIcon";
            const showIndicator =
              isReservationsIcon && showReservationsIndicator;

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              >
                {isEventsIcon ? (
                  <EventsIcon className={styles.navIcon} />
                ) : isInventoryIcon ? (
                  <InventoryIcon className={styles.navIcon} />
                ) : isReservationsIcon ? (
                  <ReservationsIcon className={styles.navIcon} />
                ) : isGiftingIcon ? (
                  <GiftingIcon className={styles.navIcon} />
                ) : (
                  <span className={`${styles.navIcon} ${styles[iconClass]}`} aria-hidden="true" />
                )}
                <span className={styles.navLinkLabelWrap}>
                  <span className={styles.navLinkLabel}>{label}</span>
                  {showIndicator && (
                    <span className={styles.navIndicatorDot} aria-hidden="true" />
                  )}
                </span>
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
              aria-label={`Switch to ${nextTheme} mode`}
              onClick={handleThemeToggle}
            >
              <ThemeIcon className={styles.accountMenuIcon} theme={nextTheme} />
              <span>{nextTheme === "dark" ? "Dark mode" : "Light mode"}</span>
            </button>
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

function readTheme(): Theme {
  if (typeof document !== "undefined") {
    const documentTheme = document.documentElement.dataset.theme;
    if (documentTheme === "light" || documentTheme === "dark") {
      return documentTheme;
    }
  }

  if (typeof window !== "undefined") {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === "light" || storedTheme === "dark") {
        return storedTheme;
      }
    } catch {}

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  }

  return "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function ThemeIcon({ className, theme }: { className?: string; theme: Theme }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
    </svg>
  );
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

function EventsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-68-76a12,12,0,1,1-12-12A12,12,0,0,1,140,132Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,132ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,140,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z" />
    </svg>
  );
}

function InventoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,80H136V56h64ZM120,56v64H56V56ZM56,136h64v64H56Zm144,64H136V136h64v64Z" />
    </svg>
  );
}

function GiftingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M216,72H180.92c.39-.33.79-.65,1.17-1A29.53,29.53,0,0,0,192,49.57,32.62,32.62,0,0,0,158.44,16,29.53,29.53,0,0,0,137,25.91a54.94,54.94,0,0,0-9,14.48,54.94,54.94,0,0,0-9-14.48A29.53,29.53,0,0,0,97.56,16,32.62,32.62,0,0,0,64,49.57,29.53,29.53,0,0,0,73.91,71c.38.33.78.65,1.17,1H40A16,16,0,0,0,24,88v32a16,16,0,0,0,16,16v64a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V136a16,16,0,0,0,16-16V88A16,16,0,0,0,216,72ZM149,36.51a13.69,13.69,0,0,1,10-4.5h.49A16.62,16.62,0,0,1,176,49.08a13.69,13.69,0,0,1-4.5,10c-9.49,8.4-25.24,11.36-35,12.4C137.7,60.89,141,45.5,149,36.51Zm-64.09.36A16.63,16.63,0,0,1,96.59,32h.49a13.69,13.69,0,0,1,10,4.5c8.39,9.48,11.35,25.2,12.39,34.92-9.72-1-25.44-4-34.92-12.39a13.69,13.69,0,0,1-4.5-10A16.6,16.6,0,0,1,84.87,36.87ZM40,88h80v32H40Zm16,48h64v64H56Zm144,64H136V136h64Zm16-80H136V88h80v32Z" />
    </svg>
  );
}

function ReservationsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M208,40H48A16,16,0,0,0,32,56V200a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V56A16,16,0,0,0,208,40ZM48,56H208V88H48Zm160,144H48V104H208v96ZM88,136a8,8,0,0,1,8-8h72a8,8,0,0,1,0,16H96A8,8,0,0,1,88,136Zm0,40a8,8,0,0,1,8-8h40a8,8,0,0,1,0,16H96A8,8,0,0,1,88,176Z" />
    </svg>
  );
}
