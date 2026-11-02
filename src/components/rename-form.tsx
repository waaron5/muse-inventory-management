"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Confirm, type Settled } from "./confirm";
import { Field } from "./form";

/** A rename sheet's one field and its Save. What was typed stays through a refusal. */
export function RenameForm({
  action,
  fields,
  name,
  onDone,
}: {
  action: (state: Settled, form: FormData) => Promise<Settled>;
  fields: Record<string, string>;
  name: string;
  onDone: () => void;
}) {
  const [typed, setTyped] = useState(name);
  return (
    <Confirm action={action} fields={fields} onDone={onDone} button={{ icon: Check, label: "Save" }}>
      <Field
        label="Name"
        name="name"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        required
        autoFocus
      />
    </Confirm>
  );
}
