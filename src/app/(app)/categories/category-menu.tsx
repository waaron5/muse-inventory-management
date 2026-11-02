"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { MainButton } from "@/components/button";
import { Confirm } from "@/components/confirm";
import { Field } from "@/components/form";
import { MenuContent, MenuItem, menuIcon, MoreTrigger } from "@/components/menu";
import { RenameForm } from "@/components/rename-form";
import { Sheet } from "@/components/sheet";
import { addCategory, deleteCategory, renameCategory } from "./actions";

type Category = { id: string; name: string; items: number };

/** An Admin can rename or delete a Category. */
export function CategoryMenu({ category }: { category: Category }) {
  const [asking, setAsking] = useState<"rename" | "delete" | null>(null);
  const sheetProps = (which: NonNullable<typeof asking>) => ({
    open: asking === which,
    onOpenChange: (open: boolean) => setAsking(open ? which : null),
  });
  const done = () => setAsking(null);
  const fields = { categoryId: category.id };
  return (
    <>
      <DropdownMenu.Root>
        <MoreTrigger label={`More for ${category.name}`} />
        <MenuContent align="end">
          <MenuItem onSelect={() => setAsking("rename")}>
            <Pencil {...menuIcon} />
            Rename
          </MenuItem>
          <MenuItem onSelect={() => setAsking("delete")}><Trash2 {...menuIcon} />Delete Category</MenuItem>
        </MenuContent>
      </DropdownMenu.Root>

      <Sheet {...sheetProps("delete")} title={`Delete ${category.name}?`}>
        <Confirm action={deleteCategory} fields={fields} onDone={done}
          explain={category.items > 0 ? `Its ${category.items} Inventory Items will be shown as Unassigned until given another category. This can't be undone.` : "This can't be undone."}
          button={{ icon: Trash2, label: "Delete Category" }} />
      </Sheet>

      <Sheet {...sheetProps("rename")} title={`Rename ${category.name}`}>
        <RenameForm action={renameCategory} fields={fields} name={category.name} onDone={done} />
      </Sheet>
    </>
  );
}

/** The Categories screen's main button, and the sheet that adds one. */
export function AddCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MainButton icon={Plus} onClick={() => setOpen(true)}>
        Add Category
      </MainButton>
      <Sheet open={open} onOpenChange={setOpen} title="Add a Category">
        <AddCategoryForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

// What was typed stays through a refusal.
function AddCategoryForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  return (
    <Confirm action={addCategory} fields={{}} onDone={onDone} button={{ icon: Plus, label: "Add Category" }}>
      <Field
        label="Name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Furniture, Vases, Lighting"
        autoComplete="off"
        required
        autoFocus
      />
    </Confirm>
  );
}
