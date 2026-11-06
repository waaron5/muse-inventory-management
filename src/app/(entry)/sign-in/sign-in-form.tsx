"use client";

import { useActionState, useRef } from "react";
import { EntryButton, EntryCard, EntryField, EntryLink } from "@/components/entry";
import { failsInline, FormError } from "@/components/form";
import { type SignInState, signInStep, signInToDemo } from "./actions";

const CODE_LENGTH = 6;

/** `toOutbox`: this copy has no Resend key, so codes go to the local outbox, not email. */
export function SignInForm({ toOutbox = false }: { toOutbox?: boolean }) {
  const [state, action, pending] = useActionState(failsInline(withConnecting), { step: "email", email: "" });
  const signIn = useRef<HTMLButtonElement>(null);

  if (state.step === "email") {
    return (
      <EntryCard>
        <form action={action} className="flex flex-col gap-4">
          <EntryField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={state.email}
            required
            autoFocus
          />
          <FormError message={state.error} />
          <EntryButton name="intent" value="send" disabled={pending}>
            {pending ? "Sending code…" : "Sign in"}
          </EntryButton>
        </form>
        <p className="mt-5 text-center font-heading text-[14px] font-semibold">No account? Ask an Admin to add you.</p>
      </EntryCard>
    );
  }

  return (
    <EntryCard>
      <form action={action} className="flex flex-col gap-4">
        {/* Says the same whether or not the address has been added. */}
        <p className="text-balance" aria-live="polite">
          {state.resent ? "A new code has been sent to " : "A code has been sent to "}
          <strong className="font-semibold [overflow-wrap:anywhere]">{state.email}</strong>.
        </p>
        <EntryField
          key={state.email}
          label="Code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          className="tracking-[0.18em]"
          // A full code signs in at once, typed, pasted or filled in from the email.
          onInput={(event) => {
            const digits = event.currentTarget.value.replace(/\D/g, "");
            if (digits.length === CODE_LENGTH && !pending) event.currentTarget.form?.requestSubmit(signIn.current);
          }}
        />
        <FormError message={state.error} />
        <EntryButton ref={signIn} name="intent" value="sign-in" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </EntryButton>
        <div className="mt-1 flex flex-col items-center gap-2">
          <EntryLink type="submit" name="intent" value="resend" formNoValidate disabled={pending}>
            Send a new code
          </EntryLink>
          <EntryLink type="submit" name="intent" value="change" formNoValidate disabled={pending}>
            Use a different email
          </EntryLink>
        </div>
      </form>
      <p className="mt-5 text-center text-[14px] text-subtle">
        {toOutbox
          ? "This copy can't send email: the code is in .outbox/mail.jsonl."
          : "No code? Check your junk folder, or ask an Admin to add you."}
      </p>
    </EntryCard>
  );
}

/**
 * Sign-in reached while connecting an AI app carries the app's signed request
 * in its address; it goes along, so signing in carries on to the Allow screen.
 * Read when sent, so the page itself stays the same for everyone.
 */
function withConnecting(state: SignInState, form: FormData) {
  form.set("connecting", window.location.search);
  return signInStep(state, form);
}

/** The demo's sign-in (ADR 0016): no email, one button, as its fictional Admin. */
export function DemoSignInForm() {
  const [state, action, pending] = useActionState(failsInline(signInToDemo), {});
  return (
    <EntryCard>
      <form action={action} className="flex flex-col gap-4">
        <p>A working demo of Muse Inventory, with made-up clients, events and stock. You sign in as an Admin, and everything resets each night.</p>
        <FormError message={state.error} />
        <EntryButton disabled={pending}>{pending ? "Signing in…" : "Sign in to the demo"}</EntryButton>
      </form>
    </EntryCard>
  );
}
