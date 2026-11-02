"use client";

import { UserPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { FormActions, MainButton, SecondaryButton } from "@/components/button";
import { failsInline, Field, FormError } from "@/components/form";
import { Sheet } from "@/components/sheet";
import { HoverLabel } from "@/components/hover-label";
import { invite, type UsersFormState } from "./actions";

/** The Users screen's main button, and the sheet that invites someone by email. */
export function Invite({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {compact ? (
        <HoverLabel label="Invite">
          <button type="button" onClick={() => setOpen(true)} aria-label="Invite team member" className="flex size-9 items-center justify-center rounded-full border border-line hover:bg-hover"><UserPlus size={18} aria-hidden /></button>
        </HoverLabel>
      ) : <MainButton icon={UserPlus} onClick={() => setOpen(true)}>
        Invite
      </MainButton>}
      <Sheet open={open} onOpenChange={setOpen} title="Invite someone">
        <InviteForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState(
    failsInline(async (s: UsersFormState, form: FormData) => {
      const result = await invite(s, form);
      if (result.done && !result.notEmailed) onDone();
      return result;
    }),
    {},
  );

  if (state.notEmailed) {
    return (
      <div className="flex flex-col gap-5">
        <p role="status">
          {state.notEmailed.email} is invited, but the email to them didn&apos;t go out. Tell them to sign in at{" "}
          {state.notEmailed.appURL} with that address.
        </p>
        <FormActions><SecondaryButton onClick={onDone}>Done</SecondaryButton></FormActions>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <p>Add any email that ends in @museem.com</p>
      <div className="flex flex-col gap-1.5">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="off"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <FormError message={state.error} />
      <FormActions>
        <SecondaryButton type="button" onClick={onDone} disabled={pending}>Cancel</SecondaryButton>
        <MainButton icon={UserPlus} disabled={pending}>Invite</MainButton>
      </FormActions>
    </form>
  );
}
