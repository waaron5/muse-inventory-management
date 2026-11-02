"use client";

import { Check, Merge, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { ArchiveMenuItem, ArchiveSheet } from "@/components/archive";
import { Confirm } from "@/components/confirm";
import { Field, Select } from "@/components/form";
import { MainButton } from "@/components/button";
import { MenuContent, MenuItem, menuIcon, MoreTrigger } from "@/components/menu";
import { RenameForm } from "@/components/rename-form";
import { Sheet } from "@/components/sheet";
import { type ClientColour, clientColours } from "@/lib/client-colour";
import { addClient, archiveClient, deleteClient, mergeClients, renameClient, saveClientColour, unarchiveClient } from "./actions";

type Client = { id: string; name: string; colour: ClientColour; archived: boolean; events: number };

/** Everyone chooses a colour; Admins also rename, merge, archive and delete. */
export function ClientMenu({ client, others, isAdmin }: { client: Client; others: { id: string; name: string }[]; isAdmin: boolean }) {
  const [asking, setAsking] = useState<"colour" | "rename" | "merge" | "archive" | "delete" | null>(null);
  const sheetProps = (which: NonNullable<typeof asking>) => ({
    open: asking === which,
    onOpenChange: (open: boolean) => setAsking(open ? which : null),
  });
  const done = () => setAsking(null);
  const fields = { clientId: client.id };
  return (
    <>
      <DropdownMenu.Root>
        <MoreTrigger label={`More for ${client.name}`} />
        <MenuContent align="end">
          <MenuItem onSelect={() => setAsking("colour")}>
            <Palette {...menuIcon} />
            Change colour
          </MenuItem>
          {isAdmin && (
            <>
              <MenuItem onSelect={() => setAsking("rename")}>
                <Pencil {...menuIcon} />
                Rename
              </MenuItem>
              <MenuItem
                disabled={others.length === 0}
                hint={others.length === 0 ? "No other Client" : undefined}
                onSelect={() => setAsking("merge")}
              >
                <Merge {...menuIcon} />
                Merge into…
              </MenuItem>
              <ArchiveMenuItem archived={client.archived} onSelect={() => setAsking("archive")} />
              <MenuItem onSelect={() => setAsking("delete")}><Trash2 {...menuIcon} />Delete Client</MenuItem>
            </>
          )}
        </MenuContent>
      </DropdownMenu.Root>

      <Sheet {...sheetProps("colour")} title={`Colour for ${client.name}`}>
        <Confirm action={saveClientColour} fields={fields} onDone={done} button={{ icon: Check, label: "Save" }}>
          <fieldset>
            <legend className="sr-only">Client colour</legend>
            <div className="flex flex-wrap gap-2">
              {clientColours.map((colour) => (
                <label key={colour} title={colour[0].toUpperCase() + colour.slice(1)} className="cursor-pointer">
                  <input type="radio" name="colour" value={colour} aria-label={colour[0].toUpperCase() + colour.slice(1)}
                    defaultChecked={client.colour === colour} className="peer sr-only" />
                  <span className="flex size-11 items-center justify-center rounded-full border-2 border-transparent hover:bg-hover peer-checked:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-ink">
                    <span aria-hidden className={`client-${colour} size-8 rounded-full bg-(--client-accent)`} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Confirm>
      </Sheet>

      <Sheet {...sheetProps("delete")} title={`Delete ${client.name}?`}>
        <Confirm action={deleteClient} fields={fields} onDone={done}
          explain="This can't be undone. Its Events keep the Client's historical name."
          button={{ icon: Trash2, label: "Delete Client" }} />
      </Sheet>

      <Sheet {...sheetProps("rename")} title={`Rename ${client.name}`}>
        <RenameForm action={renameClient} fields={fields} name={client.name} onDone={done} />
      </Sheet>
      <Sheet {...sheetProps("merge")} title={`Merge ${client.name}`}>
        <Confirm
          action={mergeClients}
          fields={fields}
          onDone={done}
          explain={mergeExplained(client)}
          button={{ icon: Merge, label: "Merge" }}
        >
          <Select label="Merge into" name="intoClientId" required>
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
              </option>
            ))}
          </Select>
        </Confirm>
      </Sheet>
      <ArchiveSheet
        {...sheetProps("archive")}
        name={client.name}
        archived={client.archived}
        fields={fields}
        archive={archiveClient}
        unarchive={unarchiveClient}
        explain={{
          archive: "It drops out of the Events list's Client filter. Its Events stay as they are.",
          unarchive: "It's back in the Events list's Client filter.",
        }}
      />
    </>
  );
}

export function AddClientButton() {
  const [open, setOpen] = useState(false);
  return <>
    <MainButton icon={Plus} onClick={() => setOpen(true)}>Add Client</MainButton>
    <Sheet open={open} onOpenChange={setOpen} title="Add a Client">
      <Confirm action={addClient} fields={{}} onDone={() => setOpen(false)} button={{ icon: Check, label: "Add Client" }}>
        <Field label="Name" name="name" required autoFocus />
      </Confirm>
    </Sheet>
  </>;
}

function mergeExplained({ name, events }: Client) {
  const moving =
    events === 0 ? `${name} has no Events` : `${events === 1 ? "Its 1 Event moves" : `Its ${events} Events move`} to the Client you pick`;
  return `${moving}, and ${name} is gone. This can't be undone.`;
}
