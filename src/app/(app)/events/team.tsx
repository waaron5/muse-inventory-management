import Link from "next/link";
import { connection } from "next/server";
import { Avatar } from "@/components/avatar";
import { HoverLabel } from "@/components/hover-label";
import { currentSession } from "@/server/auth";
import { loaders } from "@/server/loaders";
import { Invite } from "../users/invite";

/** Workspace members, rather than live presence or Event assignments. */
export async function Team() {
  await connection();
  const [{ people }, session] = await Promise.all([loaders.users(), currentSession()]);
  const active = people.filter((person) => person.active);
  return <div className="order-last flex w-full items-center gap-2 rail:order-none rail:ml-auto rail:w-auto">
    <Link href="/settings#users" aria-label={`View team, ${active.length} members`} className="flex -space-x-2 rounded-full">
      {active.slice(0, 5).map((person) => (
        <HoverLabel key={person.id} label={person.name || person.email}>
          <span tabIndex={0} aria-label={person.name || person.email} className="rounded-full border-2 border-background">
            <Avatar name={person.name || person.email} colour={person.avatarColour} />
          </span>
        </HoverLabel>
      ))}
      {active.length > 5 && (
        <HoverLabel label={active.slice(5).map((person) => person.name || person.email).join(", ")}>
          <span tabIndex={0} aria-label={`${active.length - 5} more members`} className="flex size-9 items-center justify-center rounded-full border-2 border-background bg-fill text-[13px]">+{active.length - 5}</span>
        </HoverLabel>
      )}
    </Link>
    {session?.user.role === "admin" && <Invite compact />}
  </div>;
}
