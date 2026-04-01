"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "⊞" },
  { label: "Events", href: "/events", icon: "◇" },
  { label: "Inventory", href: "/inventory", icon: "◇" },
  { label: "Gifting", href: "/gifting", icon: "◇" },
];

interface NavbarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <header className="navbar">
        <div className="navbar-left">
          <Link href="/dashboard" className="navbar-logo">
            <Image
              src="/muse-logo.png"
              alt="Muse"
              width={72}
              height={28}
              style={{ objectFit: "contain" }}
              priority
            />
          </Link>

          <nav className="navbar-nav">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive(item.href) ? "nav-link--active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="navbar-right">
          <div className="navbar-user">
            <span className="navbar-user-email">{user.email}</span>
            <span className="navbar-user-role">
              {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
            </span>
          </div>
          <button
            className="btn-logout"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Log Out
          </button>
        </div>
      </header>

      <style jsx>{`
        .navbar {
          height: 52px;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .navbar-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .navbar-logo {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .navbar-nav {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          transition: background 0.12s, color 0.12s;
          text-decoration: none;
        }
        .nav-link:hover {
          background: #f3f4f6;
          color: #111827;
        }
        .nav-link--active {
          background: #111827;
          color: white;
        }
        .nav-link--active:hover {
          background: #1f2937;
          color: white;
        }
        .navbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .navbar-user {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 1px;
        }
        .navbar-user-email {
          font-size: 13px;
          font-weight: 500;
          color: #111827;
        }
        .navbar-user-role {
          font-size: 11px;
          color: #6b7280;
        }
        .btn-logout {
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s;
        }
        .btn-logout:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
      `}</style>
    </>
  );
}
