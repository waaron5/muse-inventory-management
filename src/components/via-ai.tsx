import { HoverLabel } from "./hover-label";

/**
 * Marks an Activity entry made through an AI Connection (ADR 0017): "via AI"
 * after the person's name, its hover label naming the app. Only Activity shows it.
 */
export function ViaAi({ person, app }: { person: string; app: string }) {
  const label = `Done through ${person}'s ${app}`;
  return (
    <HoverLabel label={label} tap>
      <button type="button" aria-label={label} className="rounded-sm text-[13px] text-subtle">
        via AI
      </button>
    </HoverLabel>
  );
}
