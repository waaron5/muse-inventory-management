"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";
import { ButtonLink, FormActions, MainButton } from "@/components/button";
import { failsInline, Field, FormError, PriceField, Select, TextArea } from "@/components/form";
import type { ItemFormState } from "./actions";
import { catalogs, type Kind } from "./kind";
import { ItemPhotoField } from "./photos";
import { CountStepper } from "@/components/count-stepper";

type Location = { id: string; name: string };
type Item = { id: string; name: string; sku: string; unitPrice: string; description: string; categoryId: string };

/**
 * An Admin's form for an Inventory Item or Gift, with its one Location and its
 * Count (ADR 0014). Adding one takes its Starting Stock; after that a new Count
 * is a Recount, and a new Location moves all of it.
 */
export function ItemForm({
  kind,
  action,
  item,
  locations,
  categories = [],
  stock,
  cancelHref,
  back,
}: {
  kind: Kind;
  action: (state: ItemFormState, form: FormData) => Promise<ItemFormState>;
  item?: Item;
  locations?: Location[];
  categories?: { id: string; name: string }[];
  stock?: { location: Location | null; count: number };
  cancelHref: string;
  /** Where saving returns to, when not the page itself. */
  back?: string;
}) {
  const [state, formAction, pending] = useActionState(failsInline(action), {});
  const typed = (key: keyof Item) => state.values?.[key] ?? item?.[key] ?? "";
  // Adding an item takes its Item Photo too, uploaded as soon as it's chosen.
  const [photo, setPhoto] = useState(state.values?.photo || null);
  return (
    <form action={formAction} className="flex max-w-[560px] flex-col gap-5">
      {item && <input type="hidden" name="id" value={item.id} />}
      {back && <input type="hidden" name="back" value={back} />}
      {!item && (
        <>
          <ItemPhotoField photo={photo} save={async (uploaded) => setPhoto(uploaded)} />
          <input type="hidden" name="photo" value={photo ?? ""} />
        </>
      )}
      <Field label="Name" name="name" defaultValue={typed("name")} required autoFocus={!item} />
      {kind === "inventory" && <>
        <Select label="Category" name="categoryId" defaultValue={typed("categoryId")} required>
          <option value="">Select a category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </Select>
        {categories.length === 0 && <p className="text-subtle">Add a category in <a href="/settings#categories" className="text-cyan-ink underline">Settings</a> before adding an item.</p>}
      </>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="SKU" name="sku" defaultValue={typed("sku")} autoComplete="off" />
        <PriceField label="Unit Price" name="unitPrice" defaultValue={typed("unitPrice")} autoComplete="off" />
      </div>
      <TextArea
        label="Description"
        name="description"
        defaultValue={typed("description")}
      />
      {locations && <StockFields locations={locations} stock={stock} typed={state.values} />}
      <FormError message={state.error} />
      <FormActions>
        <ButtonLink look="plain" href={cancelHref}>
          Cancel
        </ButtonLink>
        <MainButton icon={Check} disabled={pending || (kind === "inventory" && categories.length === 0)}>
          {item ? "Save" : `Add ${catalogs[kind].noun}`}
        </MainButton>
      </FormActions>
    </form>
  );
}

// Where it sits and how many. Unassigned is offered only to an item already there.
function StockFields({ locations: initial, stock, typed }: {
  locations: Location[];
  stock?: { location: Location | null; count: number };
  typed?: Record<string, string>;
}) {
  const here = stock?.location;
  const current = here?.id;
  const locations = here && !initial.some((l) => l.id === here.id) ? [here, ...initial] : initial;
  const only = locations.length === 1 ? locations[0].id : "";
  const [locationId, setLocationId] = useState(typed?.locationId ?? current ?? only);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Location and Count</legend>
      <Select label="Location" name="locationId" value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
        <option value="">Select a Location</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </Select>
      {stock && <input type="hidden" name="expectedCount" value={stock.count} />}
      <CountStepper label="Count" name="count" defaultValue={typed?.count ?? stock?.count ?? 0} />
    </fieldset>
  );
}
