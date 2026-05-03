"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { TopBarProvider } from "@/components/TopBarContext";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  notificationsHasAttention?: boolean;
  notificationAt?: string | null;
}

export function AppShell({
  children,
  user,
  notificationsHasAttention = false,
  notificationAt = null,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <TopBarProvider>
      <div
        className={`app-shell${sidebarCollapsed ? " app-shell-collapsed" : ""}`}
      >
        <Navbar
          user={user}
          notificationsHasAttention={notificationsHasAttention}
          notificationAt={notificationAt}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((collapsed) => !collapsed)}
        />
        <main className="app-main">{children}</main>
      </div>
    </TopBarProvider>
  );
}
