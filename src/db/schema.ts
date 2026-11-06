import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  primaryKey,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { type ActivityPart, activityAreas } from "@/lib/activity";
import { clientColours } from "@/lib/client-colour";

const pgTable = snakeCase.table;

// The record of people. Shaped as Better Auth's `user` table with the admin
// plugin's columns (ADR 0008): `role` is Admin/User, `banned` is deactivation.
export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  avatarColour: integer().generatedAlwaysAsIdentity().unique(),
  avatarColourChoice: integer(),
  role: text({ enum: ["admin", "user"] }).notNull().default("user"),
  banned: boolean().notNull().default(false),
  banReason: text(),
  banExpires: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("user_avatar_colour_choice", sql`${t.avatarColourChoice} between 0 and 11`)]);

// Better Auth's own tables. A session is one signed-in device; deleting its row
// signs that device out of every command at once (ADR 0008).
export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    impersonatedBy: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

// Emailed codes waiting to be entered.
export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.identifier)],
);

// Sign-in tries in fixed time windows, so nobody can keep guessing or keep
// emailing codes. Keys are keyed hashes: no address or IP is stored.
export const signInCount = pgTable(
  "sign_in_count",
  {
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

// AI Connections (ADR 0017): Better Auth's OAuth provider tables, shaped as its
// MCP plugin asks. An AI app is an OAuth client; a person's Allow is their
// consent; its access and refresh tokens are stored only as keyed hashes.
export const oauthClient = pgTable(
  "oauth_client",
  {
    id: text().primaryKey(),
    clientId: text().notNull().unique(),
    clientSecret: text(),
    clientDiscoveryId: text(),
    disabled: boolean().default(false),
    skipConsent: boolean(),
    enableEndSession: boolean(),
    subjectType: text(),
    scopes: text().array(),
    clientCredentialsScopes: text().array().default([]),
    userId: text().references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }),
    name: text(),
    uri: text(),
    icon: text(),
    contacts: text().array(),
    tos: text(),
    policy: text(),
    softwareId: text(),
    softwareVersion: text(),
    softwareStatement: text(),
    redirectUris: text().array().notNull(),
    postLogoutRedirectUris: text().array(),
    backchannelLogoutUri: text(),
    backchannelLogoutSessionRequired: boolean(),
    tokenEndpointAuthMethod: text(),
    applicationType: text(),
    jwks: text(),
    jwksUri: text(),
    grantTypes: text().array(),
    responseTypes: text().array(),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean().default(false),
    referenceId: text(),
    metadata: jsonb(),
  },
  (t) => [index().on(t.userId)],
);

export const oauthResource = pgTable("oauth_resource", {
  id: text().primaryKey(),
  identifier: text().notNull().unique(),
  name: text().notNull(),
  accessTokenTtl: integer(),
  refreshTokenTtl: integer(),
  signingAlgorithm: text(),
  signingKeyId: text(),
  allowedScopes: text().array(),
  customClaims: jsonb(),
  dpopBoundAccessTokensRequired: boolean().default(false),
  disabled: boolean().default(false),
  createdAt: timestamp({ withTimezone: true }),
  updatedAt: timestamp({ withTimezone: true }),
  policyVersion: integer().default(1),
  metadata: jsonb(),
});

export const oauthClientResource = pgTable(
  "oauth_client_resource",
  {
    id: text().primaryKey(),
    clientId: text()
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    resourceId: text()
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: "cascade" }),
    metadata: jsonb(),
    createdAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.clientId), index().on(t.resourceId)],
);

export const oauthRefreshToken = pgTable(
  "oauth_refresh_token",
  {
    id: text().primaryKey(),
    token: text().notNull().unique(),
    clientId: text()
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text().references(() => session.id, { onDelete: "set null" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text(),
    authorizationCodeId: text(),
    resources: text().array(),
    requestedUserInfoClaims: text().array(),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }),
    revoked: timestamp({ withTimezone: true }),
    rotatedAt: timestamp({ withTimezone: true }),
    rotationReplayResponse: text(),
    rotationReplayExpiresAt: timestamp({ withTimezone: true }),
    authTime: timestamp({ withTimezone: true }),
    confirmation: jsonb(),
    scopes: text().array().notNull(),
  },
  (t) => [index().on(t.clientId), index().on(t.sessionId), index().on(t.userId), index().on(t.authorizationCodeId)],
);

export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text().primaryKey(),
    token: text().unique(),
    clientId: text()
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text().references(() => session.id, { onDelete: "set null" }),
    userId: text().references(() => user.id, { onDelete: "cascade" }),
    referenceId: text(),
    authorizationCodeId: text(),
    resources: text().array(),
    requestedUserInfoClaims: text().array(),
    refreshId: text().references(() => oauthRefreshToken.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }),
    revoked: timestamp({ withTimezone: true }),
    confirmation: jsonb(),
    scopes: text().array().notNull(),
  },
  (t) => [
    index().on(t.clientId),
    index().on(t.sessionId),
    index().on(t.userId),
    index().on(t.authorizationCodeId),
    index().on(t.refreshId),
  ],
);

export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text().primaryKey(),
    clientId: text()
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text().references(() => user.id, { onDelete: "cascade" }),
    referenceId: text(),
    resources: text().array(),
    requestedUserInfoClaims: text().array(),
    scopes: text().array().notNull(),
    createdAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.clientId), index().on(t.userId)],
);

export const oauthClientAssertion = pgTable("oauth_client_assertion", {
  id: text().primaryKey(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

export const location = pgTable("location", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const category = pgTable("category", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// The catalog: Inventory Items, reusable things Muse sends to events again and
// again, and Gifts, given away and gone. Both are counted rather than tracked
// unit by unit, and share Stock, History and the commands that change them.
// Unit Price is in cents; blank means unknown. The Item Photo is the key of
// its picture in Blob storage (`src/lib/photos.ts`).
export const item = pgTable("item", {
  id: uuid().primaryKey().defaultRandom(),
  kind: text({ enum: ["inventory", "gift"] }).notNull(),
  name: text().notNull(),
  sku: text(),
  unitPriceCents: integer(),
  description: text(),
  // Required by Inventory creation/edit commands; deletion leaves Unassigned.
  categoryId: uuid().references(() => category.id, { onDelete: "set null" }),
  photo: uuid().unique(),
  archivedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index().on(t.categoryId),
  check("item_category_only_on_inventory", sql`${t.kind} = 'inventory' or ${t.categoryId} is null`),
]);

// Stock: how many of one item are at its Location now. A guarded balance kept
// beside History, written in the same transaction (ADR 0004). Every item has
// exactly one, at its one Location (ADR 0014).
export const stock = pgTable(
  "stock",
  {
    itemId: uuid()
      .notNull()
      .references(() => item.id),
    locationId: uuid()
      .notNull()
      .references(() => location.id),
    count: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.locationId] }),
    uniqueIndex("stock_one_location_per_item").on(t.itemId),
    index().on(t.locationId),
    check("stock_count_never_negative", sql`${t.count} >= 0`),
  ],
);

// Why an Adjustment changed Stock outside any Event. Only a Gift is given away.
export const adjustmentReasons = ["purchased", "found", "lost", "damaged", "recount", "given-away"] as const;

// History: every change to Stock, never edited or deleted (ADR 0001). Stock
// moves from one place to another; Starting Stock comes from nowhere, and an
// Adjustment either adds to a Location or takes from it. A Gift Line's Gifts
// are Given Away from the Locations holding them once its Event ends (ADR
// 0010), and a giveaway-correction puts leftovers of one giveaway back where
// they came from.
//
// Loads, Returns and Write-offs, and their corrections, are from before ADR
// 0010: none is written now, but those already recorded stay readable, and
// their checks stay so they always meant what they said. Then a Gift was Given
// Away from what its Line had Out, touching no Location, and a Borrowed Item's
// check-off named no item and no Location.
export const historyEntry = pgTable(
  "history_entry",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Blank only on a Borrowed Item's check-off.
    itemId: uuid(),
    kind: text({
      enum: [
        "starting-stock",
        "transfer",
        "adjustment",
        "load",
        "load-correction",
        "return",
        "return-correction",
        "write-off",
        "given-away",
        "giveaway-correction",
      ],
    }).notNull(),
    reason: text({ enum: adjustmentReasons }),
    count: integer().notNull(),
    fromLocationId: uuid(),
    toLocationId: uuid(),
    // The Line a giveaway, Load, Return or Write-off, or a correction of one, is for.
    lineId: uuid(),
    // The giveaway a giveaway-correction puts back, the Load a load-correction
    // put back, or the Return a return-correction took back Out.
    correctsId: uuid().references((): AnyPgColumn => historyEntry.id),
    note: text(),
    // Blank only on a giveaway made automatically, by nobody (ADR 0010).
    byUserId: text(),
    // The calendar day it happened, in Muse's time zone (ADR 0005).
    happenedOn: date({ mode: "string" }).notNull(),
    recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.itemId),
    index().on(t.fromLocationId),
    index().on(t.toLocationId),
    index().on(t.byUserId),
    index().on(t.lineId),
    index().on(t.correctsId),
    check("history_entry_count_positive", sql`${t.count} > 0`),
    check(
      "history_entry_adjustment_has_reason",
      sql`(${t.kind} in ('adjustment', 'write-off')) = (${t.reason} is not null)`,
    ),
    check("history_entry_given_away_says_to_whom", sql`${t.reason} is distinct from 'given-away' or ${t.note} is not null`),
    check(
      "history_entry_only_a_check_off_names_no_item",
      sql`${t.itemId} is not null or (${t.lineId} is not null and ${t.kind} in ('load', 'load-correction', 'return', 'return-correction', 'write-off'))`,
    ),
    // Stock moves to and from a Location only when the check-off names an item.
    check(
      "history_entry_load_leaves_a_location",
      sql`${t.kind} <> 'load' or (${t.lineId} is not null and (${t.fromLocationId} is not null) = (${t.itemId} is not null) and ${t.toLocationId} is null)`,
    ),
    check(
      "history_entry_load_correction_puts_back",
      sql`${t.kind} <> 'load-correction' or (${t.lineId} is not null and ${t.correctsId} is not null and (${t.toLocationId} is not null) = (${t.itemId} is not null) and ${t.fromLocationId} is null)`,
    ),
    check(
      "history_entry_return_lands_in_a_location",
      sql`${t.kind} <> 'return' or (${t.lineId} is not null and (${t.toLocationId} is not null) = (${t.itemId} is not null) and ${t.fromLocationId} is null)`,
    ),
    check(
      "history_entry_return_correction_takes_back_out",
      sql`${t.kind} <> 'return-correction' or (${t.lineId} is not null and ${t.correctsId} is not null and (${t.fromLocationId} is not null) = (${t.itemId} is not null) and ${t.toLocationId} is null)`,
    ),
    check(
      "history_entry_write_off_touches_no_location",
      sql`${t.kind} <> 'write-off' or (${t.lineId} is not null and ${t.reason} in ('lost', 'damaged') and ${t.fromLocationId} is null and ${t.toLocationId} is null)`,
    ),
    // From a Location; before ADR 0010, from what its Line had Out.
    check(
      "history_entry_given_away_lands_nowhere",
      sql`${t.kind} <> 'given-away' or (${t.lineId} is not null and ${t.toLocationId} is null)`,
    ),
    check(
      "history_entry_giveaway_correction_puts_back",
      sql`${t.kind} <> 'giveaway-correction' or (${t.lineId} is not null and ${t.correctsId} is not null and ${t.toLocationId} is not null and ${t.fromLocationId} is null)`,
    ),
    check("history_entry_only_a_giveaway_is_by_nobody", sql`${t.byUserId} is not null or ${t.kind} = 'given-away'`),
  ],
);

// A company or person Muse plans Events for. Names are unique ignoring case and
// spacing, so a Client typed again inline is the one already there.
export const client = pgTable(
  "client",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    colour: text({ enum: clientColours }).notNull().default("blue"),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("client_name_unique").on(sql`lower(${t.name})`),
    check("client_colour", sql`${t.colour} in ('rose', 'orange', 'yellow', 'green', 'blue', 'violet')`),
  ],
);

// One engagement Muse runs for a Client. Dates are calendar days in Muse's time
// zone (ADR 0005), and they are its Hold Window (ADR 0010).
export const event = pgTable(
  "event",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    clientId: uuid().notNull(),
    plCode: text(),
    venue: text(),
    startsOn: date({ mode: "string" }),
    endsOn: date({ mode: "string" }),
    notes: text(),
    cancelledAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.clientId),
    uniqueIndex("event_pl_code_unique").on(sql`lower(${t.plCode})`),
    check("event_ends_after_it_starts", sql`${t.endsOn} >= ${t.startsOn}`),
  ],
);

// One row of what an Event needs. A Reservation is an Event's hold on a count
// of one Inventory Item or Gift, naming no Location (ADR 0002); an Event has at
// most one per item, and reserving more raises it. A Borrowed Item is entered
// by hand, with a name instead of an item, and holds no Stock.
export const lineKinds = ["reservation", "borrowed"] as const;
export type LineKind = (typeof lineKinds)[number];

export const line = pgTable(
  "line",
  {
    id: uuid().primaryKey().defaultRandom(),
    eventId: uuid()
      .notNull()
      .references(() => event.id),
    kind: text({ enum: lineKinds }).notNull().default("reservation"),
    // A Reservation's item; a Borrowed Item has none.
    itemId: uuid(),
    // A Borrowed Item's own name and its lender.
    name: text(),
    lender: text(),
    // How many it needs: those reserved or borrowed.
    reserved: integer().notNull(),
    // A Gift's hold ends when its Line is Given Away, after its Event ends
    // (before ADR 0010, when its Line's return was marked done).
    givenAwayAt: timestamp({ withTimezone: true }),
    // Who added it; reserving more later keeps them. Blank on a Line added
    // before this was kept.
    addedByUserId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("line_one_per_item").on(t.eventId, t.itemId),
    index().on(t.itemId),
    index().on(t.addedByUserId),
    check("line_reserved_positive", sql`${t.reserved} > 0`),
    check("line_reservation_names_an_item", sql`(${t.kind} = 'reservation') = (${t.itemId} is not null)`),
    check("line_by_hand_is_named", sql`(${t.kind} = 'reservation') = (${t.name} is null)`),
    check("line_borrowed_names_its_lender", sql`(${t.kind} = 'borrowed') = (${t.lender} is not null)`),
    // Only a Gift is Given Away.
    check("line_given_away_only_on_a_reservation", sql`${t.kind} = 'reservation' or ${t.givenAwayAt} is null`),
  ],
);

// An Admin's acknowledgement of a Shortage of one item, with who and a note on
// how it will be covered (ADR 0002).
export const shortageAcknowledgement = pgTable(
  "shortage_acknowledgement",
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid()
      .notNull()
      .references(() => item.id),
    note: text().notNull(),
    byUserId: text().notNull(),
    recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.itemId), index().on(t.byUserId)],
);

// The Events competing for the item when it was acknowledged, each short by
// its own worst day then. It clears an Event's flag until its Shortage grows
// past that or an Event outside the clash joins it.
export const shortageAcknowledgementEvent = pgTable(
  "shortage_acknowledgement_event",
  {
    acknowledgementId: uuid()
      .notNull()
      .references(() => shortageAcknowledgement.id),
    eventId: uuid()
      .notNull()
      .references(() => event.id),
    shortBy: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.acknowledgementId, t.eventId] }),
    index().on(t.eventId),
    check("shortage_acknowledgement_event_short", sql`${t.shortBy} > 0`),
  ],
);

// A photo of one Inventory Item or Gift as it was used, optionally naming an
// Event it was reserved for. Not History: deleting one really deletes it. An
// Event a photo names is never deleted.
export const pastUsePhoto = pgTable(
  "past_use_photo",
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid()
      .notNull()
      .references(() => item.id),
    // Its key in Blob storage, as for the Item Photo.
    photo: uuid().notNull().unique(),
    eventId: uuid(),
    note: text(),
    byUserId: text().notNull(),
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.itemId), index().on(t.eventId), index().on(t.byUserId)],
);

// Historical references retain their IDs after permanent deletion (ADR 0011).
// Live commands still validate and lock their targets; these snapshots keep
// names and Event lines readable without keeping a deleted catalog/account row.
export const deletedRecord = pgTable("deleted_record", {
  id: text().primaryKey(),
  kind: text({ enum: ["item", "event", "client", "location", "user", "line"] }).notNull(),
  name: text().notNull(),
  details: jsonb().$type<{ itemKind?: "inventory" | "gift"; eventId?: string }>().notNull().default({}),
  deletedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// Every change anyone made, one sentence each, in the order they happened. The
// sentence keeps the names it mentions as they were, so it still reads after a
// rename or a permanent deletion. Never changed once written.
export const activity = pgTable(
  "activity",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Blank only for a giveaway made automatically, by nobody (ADR 0010).
    byUserId: text(),
    area: text({ enum: activityAreas }).notNull(),
    sentence: jsonb().$type<ActivityPart[]>().notNull(),
    // Made through an AI Connection (ADR 0017): its app's client id, and the
    // app's name as it was then. Blank for a change made on screen.
    viaAiClientId: text(),
    viaAiApp: text(),
    // The clock's own time, so entries written in one transaction keep their order.
    recordedAt: timestamp({ withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  },
  (t) => [
    index().on(t.recordedAt),
    index().on(t.byUserId, t.recordedAt),
    index().on(t.area, t.recordedAt),
  ],
);
