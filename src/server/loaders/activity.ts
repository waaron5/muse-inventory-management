import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { activity, event, item, user } from "@/db/schema";
import type { ActivityArea, ActivityPart, ActivityRef } from "@/lib/activity";
import { defineLoader } from "./define";

/** How many entries a page of Activity shows; "View more" adds this many again. */
export const ACTIVITY_PAGE = 50;

export type ActivityFilters = {
  area?: ActivityArea;
  /** A person's id, or "automatic" for what happened by nobody. */
  person?: string;
  /** How many to show, newest first. */
  show?: number;
};

/** A part of an entry's sentence; a record that still exists links to its page. */
export type ActivityShown = string | (ActivityRef & { live: boolean });

// The name someone goes by: their own, their address until they've signed in,
// or as they were when deleted (ADR 0011).
const byName = sql<string | null>`coalesce(nullif(${user.name}, ''), ${user.email}, (select snapshot.name from deleted_record snapshot where snapshot.kind = 'user' and snapshot.id = ${activity.byUserId}))`;
const byColour = sql<number | null>`coalesce(${user.avatarColourChoice}, ${user.avatarColour})`;

// Two round trips: the entries and who has any, then which of the Events and
// items they name are still there to link to.
export const loadActivityScreen = defineLoader("activity", async (db, filters: ActivityFilters) => {
  const show = filters.show ?? ACTIVITY_PAGE;
  const where = and(
    filters.area ? eq(activity.area, filters.area) : undefined,
    filters.person === "automatic" ? isNull(activity.byUserId) : filters.person ? eq(activity.byUserId, filters.person) : undefined,
  );
  const [rows, people] = await Promise.all([
    db
      .select({ id: activity.id, byUserId: activity.byUserId, name: byName, colour: byColour, sentence: activity.sentence, viaAi: activity.viaAiApp, recordedAt: activity.recordedAt })
      .from(activity)
      .leftJoin(user, eq(user.id, activity.byUserId))
      .where(where)
      .orderBy(desc(activity.recordedAt), desc(activity.id))
      // One more than shown says whether there are more.
      .limit(show + 1),
    db
      .selectDistinct({ id: activity.byUserId, name: byName })
      .from(activity)
      .leftJoin(user, eq(user.id, activity.byUserId)),
  ]);
  const shown = rows.slice(0, show);

  const named = (kind: ActivityRef["ref"]) => [
    ...new Set(shown.flatMap((r) => r.sentence.flatMap((p) => (typeof p !== "string" && p.ref === kind ? [p.id] : [])))),
  ];
  const [events, items] = await Promise.all([
    named("event").length ? db.select({ id: event.id }).from(event).where(inArray(event.id, named("event"))) : [],
    named("item").length ? db.select({ id: item.id }).from(item).where(inArray(item.id, named("item"))) : [],
  ]);
  const live = new Set([...events, ...items].map((r) => r.id));
  const showing = (part: ActivityPart): ActivityShown =>
    typeof part === "string" ? part : { ...part, live: (part.ref === "event" || part.ref === "item") && live.has(part.id) };

  return {
    entries: shown.map((r) => ({
      id: r.id,
      // Nobody: the daily giveaway (ADR 0010).
      by: r.byUserId ? { id: r.byUserId, name: r.name ?? "Someone", colour: r.colour ?? undefined } : null,
      sentence: r.sentence.map(showing),
      // The AI app it was done through, as it was named then (ADR 0017); null on screen.
      viaAi: r.viaAi,
      recordedAt: r.recordedAt,
    })),
    more: rows.length > show,
    // By name, then Automatic last.
    people: [
      ...people
        .flatMap((p) => (p.id ? [{ id: p.id, name: p.name ?? "Someone" }] : []))
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })),
      ...(people.some((p) => !p.id) ? [{ id: "automatic", name: "Automatic" }] : []),
    ],
  };
});
