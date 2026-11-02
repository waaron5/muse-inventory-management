"use client";

import { LogIn } from "lucide-react";
import { useActionState } from "react";
import { MainButton } from "@/components/button";
import { failsInline, Field, FormError } from "@/components/form";
import { signInStep } from "./actions";

export function SignInForm() {
  const [state, action, pending] = useActionState(failsInline(signInStep), { step: "email", email: "" });

  if (state.step === "email") {
    return (
      <form action={action} className="flex flex-col gap-4">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="name@museem.com"
          defaultValue={state.email}
          required
          autoFocus
        />
        <FormError message={state.error} />
        <MainButton icon={LogIn} name="intent" value="send" disabled={pending} className="w-full">
          Sign in
        </MainButton>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Says the same whether or not the address has been added. */}
      <p>
        A code has been sent to <strong className="font-medium [overflow-wrap:anywhere]">{state.email}</strong>.
      </p>
      <Field
        key={state.email}
        label="Code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        autoFocus
      />
      <FormError message={state.error} />
      <MainButton icon={LogIn} name="intent" value="sign-in" disabled={pending} className="w-full">
        Sign in
      </MainButton>
      <input type="hidden" name="email" value={state.email} />
      <p className="text-subtle">No code? Check your junk folder, or ask an Admin to add you.</p>
    </form>
  );
}
