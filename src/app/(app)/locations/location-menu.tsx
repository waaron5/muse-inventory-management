"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { MainButton } from "@/components/button";
import { Confirm } from "@/components/confirm";
import { Field } from "@/components/form";
import { MenuContent, MenuItem, menuIcon, MoreTrigger } from "@/components/menu";
import { RenameForm } from "@/components/rename-form";
import { Sheet } from "@/components/sheet";
import { addLocation, deleteLocation, renameLocation } from "./actions";

type Location = { id: string; name: string; holds: number };

/** An Admin can rename or delete a Location. */
export function LocationMenu({ location }: { location: Location }) {
  const [asking, setAsking] = useState<"rename" | "delete" | null>(null);
  const sheetProps = (which: NonNullable<typeof asking>) => ({
    open: asking === which,
    onOpenChange: (open: boolean) => setAsking(open ? which : null),
  });
  const done = () => setAsking(null);
  const fields = { locationId: location.id };
  return (
    <>
      <DropdownMenu.Root>
        <MoreTrigger label={`More for ${location.name}`} />
        <MenuContent align="end">
          <MenuItem onSelect={() => setAsking("rename")}>
            <Pencil {...menuIcon} />
            Rename
          </MenuItem>
          <MenuItem onSelect={() => setAsking("delete")}><Trash2 {...menuIcon} />Delete Location</MenuItem>
        </MenuContent>
      </DropdownMenu.Root>

      <Sheet {...sheetProps("delete")} title={`Delete ${location.name}?`}>
        <Confirm action={deleteLocation} fields={fields} onDone={done}
          explain={location.holds > 0 ? `Its ${location.holds} items will be orphaned and shown as Unassigned. Counts stay the same. This can't be undone.` : "This can't be undone. Its historical name is kept."}
          button={{ icon: Trash2, label: "Delete Location" }} />
      </Sheet>

      <Sheet {...sheetProps("rename")} title={`Rename ${location.name}`}>
        <RenameForm action={renameLocation} fields={fields} name={location.name} onDone={done} />
      </Sheet>
    </>
  );
}

/** The Locations screen's main button, and the sheet that adds one. */
export function AddLocationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MainButton icon={Plus} onClick={() => setOpen(true)}>
        Add Location
      </MainButton>
      <Sheet open={open} onOpenChange={setOpen} title="Add a Location">
        <AddLocationForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

// What was typed stays through a refusal.
function AddLocationForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  return (
    <Confirm action={addLocation} fields={{}} onDone={onDone} button={{ icon: Check, label: "Add Location" }}>
      <Field
        label="Name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Warehouse, storage unit, someone's garage"
        autoComplete="off"
        required
        autoFocus
      />
    </Confirm>
  );
}
