"use client";

import { Bug, ChevronsUpDown, History, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { signOut } from "@/app/(app)/settings/actions";
import { AppearancePicker } from "@/components/appearance";
import { Avatar } from "@/components/avatar";
import { BugReportSheet } from "@/components/bug-report";
import { MenuContent, MenuItem, MenuSeparator, menuIcon } from "@/components/menu";

export type AccountUser = { name: string; role: "admin" | "user"; avatarColour?: number };

/**
 * The account menu: the sidebar's bottom row from 800px, the avatar at the
 * top right on phone. Its groups: screens, Appearance, then actions.
 */
export function AccountMenu({ user, compact }: { user: AccountUser; compact?: boolean }) {
  const role = user.role === "admin" ? "Admin" : "User";
  const [reporting, setReporting] = useState(false);
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`Account: ${user.name}`}
          className={
            compact
              ? "rounded-full"
              : "account-trigger flex w-full items-center justify-center gap-2.5 rounded-md p-1.5 text-left hover:bg-hover data-[state=open]:bg-hover lg:justify-start lg:p-2"
          }
        >
          <Avatar name={user.name} small={compact} colour={user.avatarColour} />
          {!compact && (
            <span className="hidden min-w-0 flex-1 flex-col lg:flex">
              <span className="truncate font-medium">{user.name}</span>
              <span className="text-[13px] leading-[18px] text-subtle">{role}</span>
            </span>
          )}
          {/* Says it opens a menu; the rail is too narrow for it. */}
          {!compact && (
            <ChevronsUpDown size={16} strokeWidth={1.75} aria-hidden className="account-chevrons hidden shrink-0 text-subtle lg:block" />
          )}
        </DropdownMenu.Trigger>
        <MenuContent side={compact ? "bottom" : "top"} align={compact ? "end" : "start"}>
          <MenuItem asChild>
            <Link href="/settings">
              <Settings {...menuIcon} />
              Settings
            </Link>
          </MenuItem>
          <MenuItem asChild>
            <Link href="/activity">
              <History {...menuIcon} />
              Activity
            </Link>
          </MenuItem>
          <MenuSeparator />
          <AppearancePicker />
          <MenuSeparator />
          <MenuItem onSelect={() => setReporting(true)}>
            <Bug {...menuIcon} />
            Report a bug
          </MenuItem>
          <MenuItem onSelect={() => signOut()}>
            <LogOut {...menuIcon} />
            Sign out
          </MenuItem>
        </MenuContent>
      </DropdownMenu.Root>
      <BugReportSheet open={reporting} onOpenChange={setReporting} />
    </>
  );
}
