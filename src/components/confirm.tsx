"use client";

import type { LucideIcon } from "lucide-react";
import { type ReactNode, useActionState } from "react";
import { FormActions, MainButton, SecondaryButton } from "./button";
import { failsInline, FormError } from "./form";

/** What a confirming sheet's action gives back: a refusal, or done. */
export type Settled = { error?: string; done?: boolean };

/**
 * A confirming sheet's words, anything it asks for, and its one main button.
 * `fields` ride along as hidden inputs; once the action is done, `onDone`
 * closes the sheet.
 */
export function Confirm({
  action,
  fields,
  onDone,
  explain,
  children,
  button,
}: {
  action: (state: Settled, form: FormData) => Promise<Settled>;
  fields: Record<string, string>;
  onDone: () => void;
  explain?: string;
  children?: ReactNode;
  button: { icon: LucideIcon; label: string };
}) {
  const [state, formAction, pending] = useActionState(
    failsInline(async (s: Settled, form: FormData) => {
      const result = await action(s, form);
      if (result.done) onDone();
      return result;
    }),
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-5">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {explain && <p>{explain}</p>}
      {children}
      <FormError message={state.error} />
      <FormActions>
        <SecondaryButton type="button" onClick={onDone} disabled={pending}>Cancel</SecondaryButton>
        <MainButton icon={button.icon} disabled={pending}>{button.label}</MainButton>
      </FormActions>
    </form>
  );
}
