"use client";

import { ArrowRight, Check, Pencil } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { type NameState, saveName } from "@/app/(app)/settings/actions";
import { cn } from "@/lib/utils";
import { FormActions, MainButton } from "./button";
import { failsInline, Field, fieldClass, FormError } from "./form";

/** Your name, asked at first sign-in before carrying on to Events. */
export function NameForm() {
  const [state, action, pending] = useActionState(failsInline(saveName), {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Your name" name="name" autoComplete="name" required autoFocus />
      <input type="hidden" name="then" value="events" />
      <FormError message={state.error} />
      <FormActions>
        <MainButton icon={ArrowRight} disabled={pending}>
          Continue
        </MainButton>
      </FormActions>
    </form>
  );
}

/**
 * Your name in Settings: shown in its field, with a pencil at its end to edit
 * it. Enter or the check saves it, with a snackbar; Escape puts it back.
 */
export function NameSetting({ name }: { name: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    failsInline(async (s: NameState, form: FormData) => {
      const result = await saveName(s, form);
      if (result.saved) setEditing(false);
      return result;
    }),
    {},
  );

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  const iconButton = "absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md hover:bg-hover";
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        Your name
      </label>
      <div className="relative">
        <input
          // A fresh field each time, so Escape or a save shows the name as it stands.
          key={editing ? "editing" : name}
          ref={input}
          id={id}
          name="name"
          autoComplete="name"
          defaultValue={name}
          readOnly={!editing}
          required
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
            // Nothing to save until it's being edited.
            if (e.key === "Enter" && !editing) e.preventDefault();
          }}
          className={cn(fieldClass, "w-full pr-12", !editing && "cursor-default")}
        />
        {/* Keyed apart, so the pencil's click can't finish as the check's submit. */}
        {editing ? (
          <button key="save" type="submit" aria-label="Save name" disabled={pending} className={iconButton}>
            <Check size={18} strokeWidth={1.75} aria-hidden />
          </button>
        ) : (
          <button key="edit" type="button" aria-label="Edit name" onClick={() => setEditing(true)} className={iconButton}>
            <Pencil size={18} strokeWidth={1.75} aria-hidden className="text-subtle" />
          </button>
        )}
      </div>
      {editing && <FormError message={state.error} />}
    </form>
  );
}
