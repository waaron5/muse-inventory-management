"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";
import { saveAvatarColour } from "@/app/(app)/settings/actions";
import { profileColourChoices } from "@/lib/avatar-colours";
import { Avatar } from "./avatar";
import { failsInline, FormError } from "./form";
import { iconAction } from "./icon-action";

/** A saved profile preference, shared by the account, team and Users avatars. */
export function AvatarColourSetting({ name, automaticColour, choice }: {
  name: string;
  automaticColour: number;
  choice: number | null;
}) {
  const saved = choice ?? automaticColour;
  const [selected, setSelected] = useState(saved);
  const [state, action, pending] = useActionState(failsInline(saveAvatarColour), {});
  return (
    <form action={action} className="flex flex-col items-start gap-4">
      <fieldset disabled={pending} className="w-full">
        <legend className="sr-only">Profile colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          {profileColourChoices.map((option) => (
            <label key={option.colour} title={option.label} className="cursor-pointer">
              <input
                type="radio"
                name="colour"
                value={option.colour}
                aria-label={option.label}
                checked={selected === option.colour}
                onChange={() => setSelected(option.colour)}
                className="peer sr-only"
              />
              <span className="flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-transparent p-1 hover:bg-hover peer-checked:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-ink">
                <Avatar name={name} colour={option.colour} />
              </span>
            </label>
          ))}
          {selected !== saved && (
            <button type="submit" aria-label="Confirm colour" title="Confirm colour" disabled={pending} className={iconAction()}>
              <Check size={18} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>
      </fieldset>
      <FormError message={state.error} />
    </form>
  );
}
