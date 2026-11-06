import { z } from "zod";
import { event } from "@/db/schema";
import { ref, said } from "./activity";
import { defineCommand } from "./define";
import { checkDates, checkPlCodeFree, eventFields, resolveClient } from "./event-fields";

// Anyone can plan an Event.
export const createEvent = defineCommand({
  name: "createEvent",
  input: z.object(eventFields),
  allow: ["admin", "user"],
  ai: {
    description:
      "Adds an Event for a Client: give the Client's id from search, or a new Client's name (a name already there finds that Client). A P&L Code belongs to one Event only. Dates are optional, but an Event needs them before Inventory can be reserved for it.",
  },
  run: async (tx, _actor, { client, ...fields }, record) => {
    checkDates(fields);
    await checkPlCodeFree(tx, fields.plCode);
    const picked = await resolveClient(tx, client);
    const [created] = await tx
      .insert(event)
      .values({ ...fields, clientId: picked.id })
      .returning({ id: event.id });
    await record("events", said`created ${ref.event(created.id, fields.name)} for ${ref.client(picked.id, picked.name)}`);
    return created;
  },
});
