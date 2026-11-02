"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import type { ComponentProps } from "react";
import { Confirm, type Settled } from "./confirm";
import { MenuItem, menuIcon } from "./menu";
import { Sheet } from "./sheet";

// Archiving an item or a Client, and unarchiving one that is.

type Action = (state: Settled, form: FormData) => Promise<Settled>;

/** A "⋯" menu's Archive, or Unarchive for one that's Archived. */
export function ArchiveMenuItem({ archived, ...item }: ComponentProps<typeof MenuItem> & { archived: boolean }) {
  return (
    <MenuItem {...item}>
      {archived ? <ArchiveRestore {...menuIcon} /> : <Archive {...menuIcon} />}
      {archived ? "Unarchive" : "Archive"}
    </MenuItem>
  );
}

/** The sheet that archives it, or unarchives it: its question, its words and its one main button. */
export function ArchiveSheet({
  name,
  archived,
  open,
  onOpenChange,
  fields,
  archive,
  unarchive,
  explain,
}: {
  name: string;
  archived: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: Record<string, string>;
  archive: Action;
  unarchive: Action;
  explain: { archive: string; unarchive: string };
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={archived ? `Unarchive ${name}?` : `Archive ${name}?`}>
      <Confirm
        action={archived ? unarchive : archive}
        fields={fields}
        onDone={() => onOpenChange(false)}
        explain={archived ? explain.unarchive : explain.archive}
        button={archived ? { icon: ArchiveRestore, label: "Unarchive" } : { icon: Archive, label: "Archive" }}
      />
    </Sheet>
  );
}
