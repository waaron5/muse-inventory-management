/** Where things are in the app, for the links an AI Connection's answers carry (ADR 0017). */
export function appLinks(appURL: string) {
  const to = (path: string) => new URL(path, appURL).toString();
  return {
    to,
    item: (thing: { id: string; kind: "inventory" | "gift" }) => to(`/${thing.kind === "gift" ? "gifts" : "inventory"}/${thing.id}`),
    event: (id: string) => to(`/events/${id}`),
    // A Client has no page of its own: its Events.
    client: (id: string) => to(`/events?client=${id}`),
  };
}

export type AppLinks = ReturnType<typeof appLinks>;
