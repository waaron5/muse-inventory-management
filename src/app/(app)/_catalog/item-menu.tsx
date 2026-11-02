"use client";

import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { ArchiveMenuItem, ArchiveSheet } from "@/components/archive";
import { Confirm } from "@/components/confirm";
import { iconAction } from "@/components/icon-action";
import { Sheet } from "@/components/sheet";
import { MenuContent, MenuItem, menuIcon, MoreTrigger } from "@/components/menu";
import { archiveItem, deleteItem, unarchiveItem } from "./actions";
import { catalogs, type Kind } from "./kind";

/**
 * An item's "⋯" menu, on its page or its row in the list: an Admin's Edit and
 * Archive. `blocked` says why it can't be Archived yet ("4 in storage"). From
 * a row, `back` is the list, where Edit returns to.
 */
export function ItemMenu({
  kind,
  item,
  isAdmin,
  blocked,
  back,
}: {
  kind: Kind;
  item: { id: string; name: string; archived: boolean };
  isAdmin: boolean;
  blocked?: string;
  back?: string;
}) {
  const [asking, setAsking] = useState<"archive" | "delete" | null>(null);
  const { path, title } = catalogs[kind];
  const adminOnly = isAdmin ? undefined : "Ask an Admin";
  // Unarchiving is never blocked.
  const notYet = item.archived ? undefined : blocked;
  return (
    <>
      {!back ? <div className="flex flex-wrap gap-1">
        {isAdmin ? <Link href={`${path}/${item.id}/edit`} aria-label="Edit" title="Edit" className={iconAction()}><Pencil size={20} aria-hidden /></Link>
          : <button disabled aria-label="Edit" title="Ask an Admin" className={iconAction()}><Pencil size={20} aria-hidden /></button>}
        <button aria-label={item.archived ? "Unarchive" : "Archive"} title={adminOnly ?? notYet ?? (item.archived ? "Unarchive" : "Archive")}
          disabled={!isAdmin || Boolean(notYet)} onClick={() => setAsking("archive")} className={iconAction(!item.archived)}>
          {item.archived ? <ArchiveRestore size={20} aria-hidden /> : <Archive size={20} aria-hidden />}
        </button>
        <button aria-label="Delete item" title={adminOnly ?? "Delete item"} disabled={!isAdmin} onClick={() => setAsking("delete")} className={iconAction(true)}><Trash2 size={20} aria-hidden /></button>
      </div> : <DropdownMenu.Root>
        <MoreTrigger label={`More for ${item.name}`} onRow={Boolean(back)} />
        <MenuContent align="end">
          {isAdmin ? (
            <MenuItem asChild>
              <Link href={`${path}/${item.id}/edit${back ? `?back=${encodeURIComponent(back)}` : ""}`}>
                <Pencil {...menuIcon} />
                Edit
              </Link>
            </MenuItem>
          ) : (
            <MenuItem disabled hint={adminOnly}>
              <Pencil {...menuIcon} />
              Edit
            </MenuItem>
          )}
          <ArchiveMenuItem
            archived={item.archived}
            disabled={!isAdmin || notYet !== undefined}
            hint={adminOnly ?? notYet}
            onSelect={() => setAsking("archive")}
          />
          <MenuItem disabled={!isAdmin} hint={adminOnly} onSelect={() => setAsking("delete")}><Trash2 {...menuIcon} />Delete item</MenuItem>
        </MenuContent>
      </DropdownMenu.Root>}

      <ArchiveSheet
        open={asking === "archive"}
        onOpenChange={(open) => setAsking(open ? "archive" : null)}
        name={item.name}
        archived={item.archived}
        fields={{ id: item.id }}
        archive={archiveItem}
        unarchive={unarchiveItem}
        explain={{
          archive: `It drops out of ${title} and can't be reserved. Its History is kept, and the Archived filter still shows it.`,
          unarchive: `It's back in ${title}, and can be reserved again.`,
        }}
      />
      <Sheet open={asking === "delete"} onOpenChange={(open) => setAsking(open ? "delete" : null)} title={`Delete ${item.name}?`}>
        <Confirm action={deleteItem} fields={{ id: item.id, kind, ...(back && { back }) }} onDone={() => setAsking(null)}
          explain="This can't be undone. The catalog entry and its Stock are removed; past records and Event lines keep its name and counts."
          button={{ icon: Trash2, label: "Delete item" }} />
      </Sheet>
    </>
  );
}
