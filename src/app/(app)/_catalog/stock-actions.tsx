"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";
import { FormActions, MainButton, SecondaryButton } from "@/components/button";
import { DayField, failsInline, Field, FormError } from "@/components/form";
import { Sheet } from "@/components/sheet";
import { reasonLabel } from "@/lib/format";
import { adjustCount, type StockFormState } from "./actions";
import type { Kind } from "./kind";

type Props = {
  kind: Kind;
  itemId: string;
  // What it holds at its one Location (ADR 0014).
  count: number;
  locationName: string;
  isAdmin: boolean;
  today: string;
};

/** Adjust count on the item page, in a sheet. */
export function StockActions(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-3">
      <SecondaryButton onClick={() => setOpen(true)}>Adjust count</SecondaryButton>
      <Sheet open={open} onOpenChange={setOpen} title="Adjust count">
        <AdjustForm {...props} onDone={() => setOpen(false)} />
      </Sheet>
    </div>
  );
}

// Only a Gift is given away; anyone may record that or Found.
const reasons = {
  inventory: ["purchased", "found", "lost", "damaged", "recount"],
  gift: ["purchased", "found", "given-away", "lost", "damaged", "recount"],
} as const;
const anyone: readonly string[] = ["found", "given-away"];

// The sheet closes once the command has gone through; a refusal stays open with
// what was typed.
function AdjustForm({ kind, itemId, count: held, locationName, isAdmin, today, onDone }: Props & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    failsInline(async (state: StockFormState, form: FormData) => {
      const result = await adjustCount(state, form);
      if (result.done) onDone();
      return result;
    }),
    {},
  );
  // A User with one reason open to them starts on it.
  const only = reasons[kind].filter((r) => anyone.includes(r));
  const [reason, setReason] = useState(state.values?.reason ?? (!isAdmin && only.length === 1 ? only[0] : ""));
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="itemId" value={itemId} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">Reason</legend>
        {reasons[kind].map((r) => {
          const allowed = isAdmin || anyone.includes(r);
          return (
            <label key={r} className={`flex h-11 items-center gap-3 ${allowed ? "" : "text-subtle"}`}>
              <input
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                disabled={!allowed}
                required
                className="size-5"
              />
              <span className="flex-1">{reasonLabel[r]}</span>
              {!allowed && <span className="text-[13px]">Ask an Admin</span>}
            </label>
          );
        })}
      </fieldset>
      <Field
        key={reason === "recount" ? "counted" : "change"}
        label={reason === "recount" ? "Counted" : "How many"}
        name="count"
        type="number"
        min={reason === "recount" ? 0 : 1}
        max={reason === "lost" || reason === "damaged" || reason === "given-away" ? held : undefined}
        step={1}
        inputMode="numeric"
        defaultValue={state.values?.count ?? ""}
        required
      />
      {reason === "recount" && (
        <p className="-mt-3 text-subtle">
          {locationName} has {held} now.
        </p>
      )}
      {reason === "given-away" ? (
        <Field
          key="to-whom"
          label="Who it went to"
          name="note"
          defaultValue={state.values?.note ?? ""}
          autoComplete="off"
          required
        />
      ) : (
        <Field key="note" label="Note" name="note" defaultValue={state.values?.note ?? ""} placeholder="Optional" autoComplete="off" />
      )}
      <DayField today={today} typed={state.values?.happenedOn} />
      <FormError message={state.error} />
      <FormActions>
        <MainButton icon={Check} disabled={pending}>
          Save
        </MainButton>
      </FormActions>
    </form>
  );
}
