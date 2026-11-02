import type { ClientColour } from "@/lib/client-colour";
import { cn } from "@/lib/utils";

/** A Client's name on its colour's wash, so its Events are easy to tell apart (build note 6). */
export function ClientTag({ client, className }: { client: { name: string; colour: ClientColour }; className?: string }) {
  return (
    <span
      className={cn(
        `client-${client.colour}`,
        "inline-flex max-w-full items-center rounded-full bg-(--client-wash) px-2.5 py-0.5 text-[14px]",
        className,
      )}
    >
      <span className="truncate">{client.name}</span>
    </span>
  );
}
