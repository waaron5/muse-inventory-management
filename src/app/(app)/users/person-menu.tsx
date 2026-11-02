"use client";

import { Trash2, UserCheck, UserCog, UserX } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { Confirm } from "@/components/confirm";
import { MenuContent, MenuItem, menuIcon, MoreTrigger } from "@/components/menu";
import { Sheet } from "@/components/sheet";
import type { Role } from "@/server/commands";
import { changeRole, deactivate, deleteUser, reactivate } from "./actions";

type Person = { id: string; shown: string; role: Role; active: boolean };

/** One person's "⋯" on the Users screen, for an Admin: their role, and their access. */
export function PersonMenu({ person }: { person: Person }) {
  const [asking, setAsking] = useState<"role" | "access" | "delete" | null>(null);
  const sheetProps = (which: NonNullable<typeof asking>) => ({
    open: asking === which,
    onOpenChange: (open: boolean) => setAsking(open ? which : null),
  });
  const done = () => setAsking(null);
  const toAdmin = person.role === "user";
  return (
    <>
      <DropdownMenu.Root>
        <MoreTrigger label={`More for ${person.shown}`} />
        <MenuContent align="end">
          <MenuItem onSelect={() => setAsking("role")}>
            <UserCog {...menuIcon} />
            {toAdmin ? "Make Admin" : "Make User"}
          </MenuItem>
          <MenuItem onSelect={() => setAsking("access")}>
            {person.active ? <UserX {...menuIcon} /> : <UserCheck {...menuIcon} />}
            {person.active ? "Deactivate" : "Reactivate"}
          </MenuItem>
          <MenuItem onSelect={() => setAsking("delete")}><Trash2 {...menuIcon} />Delete user</MenuItem>
        </MenuContent>
      </DropdownMenu.Root>

      <Sheet {...sheetProps("delete")} title={`Delete ${person.shown}?`}>
        <Confirm action={deleteUser} fields={{ userId: person.id }} onDone={done}
          explain="Their access is removed permanently. Their historical name stays on past changes. This can't be undone."
          button={{ icon: Trash2, label: "Delete user" }} />
      </Sheet>

      <Sheet {...sheetProps("role")} title={toAdmin ? `Make ${person.shown} an Admin?` : `Make ${person.shown} a User?`}>
        <Confirm
          action={changeRole}
          fields={{ userId: person.id, role: toAdmin ? "admin" : "user" }}
          onDone={done}
          explain={
            toAdmin
              ? "Beyond what a User can do, they can keep the catalog, correct counts, acknowledge Shortages, merge Clients, delete Events, manage Locations and manage who has access."
              : "They can still see everything, plan Events, and load and return, but no longer keep the catalog, correct counts or manage who has access."
          }
          button={{ icon: UserCog, label: toAdmin ? "Make Admin" : "Make User" }}
        />
      </Sheet>
      <Sheet {...sheetProps("access")} title={person.active ? `Deactivate ${person.shown}?` : `Reactivate ${person.shown}?`}>
        {person.active ? (
          <Confirm
            action={deactivate}
            fields={{ userId: person.id }}
            onDone={done}
            explain="They're signed out of every phone and computer at once, and can't sign in again until they're reactivated. Their name stays on everything they did."
            button={{ icon: UserX, label: "Deactivate" }}
          />
        ) : (
          <Confirm
            action={reactivate}
            fields={{ userId: person.id }}
            onDone={done}
            explain={`They can sign in again by emailed code, as ${person.role === "admin" ? "an Admin" : "a User"}.`}
            button={{ icon: UserCheck, label: "Reactivate" }}
          />
        )}
      </Sheet>
    </>
  );
}
