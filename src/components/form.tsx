import { ChevronDown } from "lucide-react";
import { type ComponentProps, useId } from "react";
import { noteError, pageErrorOf } from "@/lib/last-error";
import { isNavigation } from "@/lib/sentry";
import { cn } from "@/lib/utils";

// The form parts the screens share, in the design system's terms. Every
// field has the same hairline border; the focus ring marks the one in use.

// Every field's hairline turns ink under the pointer, as in Dropbox.
export const fieldClass =
  "h-11 rounded-md border border-line bg-background px-3 text-[16px] placeholder:text-subtle hover:border-ink";

export function Field({ label, className, ...input }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium">{label}</span>
      <input className={cn(fieldClass, className)} {...input} />
    </label>
  );
}

/**
 * An amount of money, with a "$" that stays ahead of what's typed. Only digits
 * and one decimal point, with at most two places after it, get in.
 */
export function PriceField({ label, className, onInput, ...input }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium">{label}</span>
      <span className="relative">
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[16px] text-subtle">
          $
        </span>
        <input
          inputMode="decimal"
          className={cn(fieldClass, "w-full pl-6", className)}
          onInput={(event) => {
            keepPriceIn(event.currentTarget);
            onInput?.(event);
          }}
          {...input}
        />
      </span>
    </label>
  );
}

// Strips what isn't a price, keeping the caret where it was among what's left.
function keepPriceIn(field: HTMLInputElement) {
  const kept = keepPrice(field.value);
  if (kept === field.value) return;
  const caret = keepPrice(field.value.slice(0, field.selectionStart ?? field.value.length)).length;
  field.value = kept;
  field.setSelectionRange(caret, caret);
}

/** What's typed or pasted, cut to a price: "$1,250.505" is "1250.50". */
export function keepPrice(typed: string) {
  let kept = "";
  let point = -1;
  for (const character of typed) {
    if (character >= "0" && character <= "9") {
      if (point === -1 || kept.length - point <= 2) kept += character;
    } else if (character === "." && point === -1) {
      point = kept.length;
      kept += character;
    }
  }
  return kept;
}

// Labelled by id rather than wrapped: a wrapping label would fold the chosen
// option's text into the select's name. The browser's own arrow sits too far
// right, so it's swapped for ours.
export function Select({ label, className, ...select }: ComponentProps<"select"> & { label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <div className="relative">
        <select id={id} className={cn(fieldClass, "w-full appearance-none pr-9", className)} {...select} />
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-subtle"
        />
      </div>
    </div>
  );
}

export function TextArea({ label, className, ...input }: ComponentProps<"textarea"> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium">{label}</span>
      <textarea className={cn(fieldClass, "h-auto min-h-28 py-2.5", className)} {...input} />
    </label>
  );
}

/** The day a Stock change happened: today unless it's recorded after the fact, never a day still to come. */
export function DayField({ today, typed }: { today: string; typed?: string }) {
  return <Field label="Day it happened" name="happenedOn" type="date" max={today} defaultValue={typed ?? today} required />;
}

const alertClass = "rounded-md bg-alert-surface px-3 py-2 text-alert";

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={alertClass}>
      {message}
    </p>
  );
}

/**
 * What a single action that failed says beside its form, rather than the
 * error page: "Something went wrong. Try again." A redirect still goes
 * through. The server reported the failure itself; it's kept here for a bug
 * report, known by its digest.
 */
export function inlineFailure(error: unknown, message = "Something went wrong. Try again.") {
  if (isNavigation(error)) throw error;
  noteError(pageErrorOf(error));
  return message;
}

/** A form's action whose failure shows inline, keeping what was typed. */
export function failsInline<State extends { error?: string }>(action: (state: State, form: FormData) => Promise<State>) {
  return async (state: State, form: FormData): Promise<State> => {
    try {
      return await action(state, form);
    } catch (error) {
      const typed = [...form].filter((entry): entry is [string, string] => typeof entry[1] === "string");
      return { ...state, error: inlineFailure(error), values: Object.fromEntries(typed) };
    }
  };
}
