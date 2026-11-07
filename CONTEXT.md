# Muse Inventory

Internal tool for Muse Event Management, a corporate event planning company, to know what gear and gifts they own, where it is, and which events it is committed to.

## Catalog

**Category**:
A named group of Inventory Items, such as Furniture or Vases & Vessels. Each Inventory Item must be given one when added; deleting its Category leaves it Unassigned until given another. Gifts have no Category.
_Avoid_: Tag, type, collection

**Inventory Item**:
A kind of reusable thing Muse owns and sends to events again and again (chalkboards, cornhole sets, surfboards, signage), tracked as a count rather than as individual units.
_Avoid_: Asset, equipment, product

**Gift**:
A kind of consumable thing Muse gives away at events (jackets, bags, branded swag); once Given Away it is gone. Kept distinct from Inventory Items. Each size of a sized Gift is its own Gift ("Nano Puff jacket – M"). A gift bought for one Event enters the catalog as a Gift through a Purchased Adjustment and is reserved like any other. A Gift with none left stays in the catalog, its past giveaways visible, until Archived.
_Avoid_: Swag, giveaway, consumable item, one-off gift, custom gift

**Unit Price**:
The MSRP of a single one of an Inventory Item or Gift — the price of one chair, never of the whole stock of chairs.
_Avoid_: Price (unqualified), value, cost

**SKU**:
An optional code identifying a kind of Inventory Item or Gift; it does not identify an individual physical unit.

**Item Photo**:
The one picture of an Inventory Item or Gift in the catalog, showing what the thing looks like; kept by Admins. Distinct from Past-use Photos, though an Admin may copy one in by hand.
_Avoid_: Image, thumbnail, catalog photo

**Description**:
Free text about an Inventory Item or Gift: what it is, what a set includes (a cornhole set's boards and bags, still booked as one item), and any notes on its condition.
_Avoid_: Contents, notes (as a separate field), kit, bundle, components

## Places

**Location**:
A place where Muse stock can sit — a warehouse, a storage unit, someone's garage, a region. Each Inventory Item or Gift sits at one Location with all of its Stock, set on the item like any other field (ADR 0014); deleting a Location leaves its items Unassigned and its historical name readable.
_Avoid_: Storage location, warehouse (unless it is literally one)

**Unassigned**:
Stock with no current Location, or an Inventory Item whose Category was deleted. An item added with no Location sits Unassigned. Unassigned Stock remains part of Count until the item is given a Location or adjusted.

**Stock**:
How many of one Inventory Item or Gift are physically at its Location, or Unassigned. Stock never leaves its Location for an Event; only Gifts Given Away after one leave it for good.
_Avoid_: Quantity (unqualified), inventory level

**Transfer**:
Moving all of an Inventory Item's or Gift's Stock to another Location, by changing the item's Location; it takes effect at once, with no in-transit state. Part of an item's Stock is never moved on its own.
_Avoid_: Move, relocation

**Starting Stock**:
The Count given, at its Location, when an Inventory Item or Gift is first added to the catalog. It enters History as its first entry, with no reason asked; any later change is an Adjustment.
_Avoid_: Opening balance, initial import

**Adjustment**:
A change to an item's Stock at its Location outside any Event, after its Starting Stock, always with a reason (Purchased, Found, Lost, Damaged/written off, Recount, or, for a Gift handed out outside any Event, Given away with a note of who it went to). A loss or a move noticed after an Event is an Adjustment or a Transfer on the item.
_Avoid_: Correction, edit, write-off (except as a reason)

**Given Away**:
Recording that an Event's Gifts went to people and will not come back, reducing Count at once. The day after an Event ends, each of its Gift Lines is Given Away automatically ("Automatic" in History): its count, from the Gift's Location, never more than is in Stock, on the Event's last day. Leftovers go back by changing the past Gift Line's count, which writes a correcting entry putting the difference back at the Gift's Location.
_Avoid_: Consumed, used, completed

**Count**:
How many of one Inventory Item or Gift Muse has in all: its Stock at its Location ("Count 24"). Always a sum, never entered directly; it drops only through Given Away and Adjustments.
_Avoid_: Owned, total quantity, quantity (unqualified)

**Activity**:
Every change anyone made to Muse's data, newest first, each as one short sentence after who made it ("Aaron added 6 Chairs to BRL Cove 26") with when; edits say only what changed, as it is now. Automatic giveaways are by "Automatic". A change made through an AI Connection is still the person's, marked "via AI". Changing your own name or profile colour, or disconnecting your own AI Connection, isn't Activity. It began when the feature launched, is kept forever and never edited, and keeps the names it mentions as they were. Everyone can see it. Distinct from History, which is only Stock and lives on each item.
_Avoid_: Audit log, activity feed, change log, History (for this)

**History**:
The permanent record of every change to Stock (Starting Stock, Transfers, Adjustments, Gifts Given Away and leftovers put back), with who, when and why; Loads, Returns and Write-offs from before ADR 0010 stay in it, readable. Each entry keeps both the day it happened, which can be set earlier when recorded after the fact, and when it was recorded. Mistakes are fixed by adding a correcting entry, never by changing an old one.
_Avoid_: Stock History, audit log, activity feed

**Archived**:
An Inventory Item, Gift or Client retired from use: hidden from the catalog, booking and where one is picked, its history kept, until an Admin unarchives it. An item can be Archived only once it has no Stock and nothing reserved. Locations are deleted rather than Archived.
_Avoid_: Retired, deleted, inactive

**Deleted**:
A record permanently removed from use, distinct from reversible archiving. Historical names, counts and linked Event lines remain readable; deleting an Event does not put Given Away Gifts back into Stock.

## Events

**Client**:
A company or person Muse plans events for (Ivorypeak, Birchline, Riverside Community Church). One Client has many Events.
_Avoid_: Company, customer, account

**Event**:
A single engagement Muse runs for a Client. It always has a name and a Client, and carries its P&L Code, Venue and dates. May exist without dates while still being planned.
_Avoid_: Job, project, show

**P&L Code**:
Muse's internal code for an Event, used as its financial identifier (e.g. "BRL Cove 26", "IVP-Roadshow 26"). It identifies the Event but is not its name.
_Avoid_: P&L name, event code, event name

**Venue**:
Where an Event takes place (a hotel, a resort, a client's office), as free text. Never a Location: Locations are where Muse keeps stock.
_Avoid_: Event location, location (for an Event)

**Borrowed Item**:
A thing Muse does not own, borrowed for one Event, entered by hand as a Line in that Event's Inventory ("Add non-inventory" on screen): a name, a count and an optional lender. It never enters the catalog or any Location, and changes no Stock.
_Avoid_: Rental, one-off inventory, external item, non-inventory (except as the button's wording)

**Line**:
One row of what an Event needs: a Reservation of an Inventory Item or Gift, or a Borrowed Item. An Event's Lines fall into its **Inventory** (Inventory Items and Borrowed Items) and its **Gifts**; there is no umbrella name for the two together, since Gifts are never Inventory. Each Line keeps who added it, shown as their bubble; reserving more later keeps them, and Lines from before this was kept have no one. Once a Gift Line is Given Away, its count is how many went. The Print list is a paper working copy of everything an Event needs; the Lines stay the record.
_Avoid_: Pull List, packing list, checklist, manifest, Pull Sheet

**Past-use Photo**:
A photo of one Inventory Item or Gift as it was used, kept on that item so people can see how it was set up and plan next time; optionally names the Event it was taken at, from Events the item went to, with an optional note. Anyone can add one at any time; it is not part of History and deleting it really deletes it. Borrowed Items have none.
_Avoid_: Event Photo, gallery photo, setup photo

**Reservation**:
An Event's hold on a count of one Inventory Item or Gift. It names no Location. Takes effect at once, with no approval. An Inventory Item's Reservation holds across the Event's Hold Window; a Gift's holds whatever the dates, from when it is made until its Line is Given Away (or it is released), since Given Away Gifts never come back.
_Avoid_: Booking, request, allocation

**Hold Window**:
The days an Event's Inventory Item Reservations hold stock: the Event's own start and end dates. Both end days count, so two Events sharing a boundary day compete. An Event with one date lasts that day; one without dates has none, and never ends.
_Avoid_: Booking period, Out Date, Return Date

**Available**:
How many of an Inventory Item are free across a Hold Window: Count minus what other Events reserve, taken on the busiest day of the window. For a Gift there is no window: Available is its Count minus every other Event's hold on it not yet Given Away.

**Shortage**:
When, on some day, Events hold more of an Inventory Item than its Count ("short by N" is the worst single day), or when Events' holds on a Gift not yet Given Away add up to more than its Count. A Reservation that causes one is saved anyway, and every competing Event is flagged until the numbers resolve it or an Admin Acknowledges it with a note (the flag returns if the shortage grows).
_Avoid_: Conflict, overbooking error

**Cancelled**:
An Event that fell through: kept for the record, its Reservations released. Only possible before the Event ends; it can be reinstated, bringing its Reservations back, or permanently deleted by an Admin.
_Avoid_: Deleted

## People

**Admin**:
A Muse team member who, beyond everything a User can do, keeps the catalog, corrects counts, Acknowledges Shortages, merges Clients, permanently deletes records, manages Locations and Categories, and manages other people's roles and access. An Admin cannot demote, deactivate or delete themselves; there is always at least one active Admin.

**User**:
A Muse team member without admin rights. A User sees everything an Admin sees, and can plan Events (Clients, Events, Reservations, Borrowed Items), change a past Gift Line's count, create Locations and Categories, and record Found and Given away Adjustments. Roles limit what someone can change, never what they can see.
_Avoid_: Staff, member, viewer

**AI Connection**:
A person's own AI app (Claude, ChatGPT, Grok) linked to Muse Inventory and acting as them: it sees what they see and can change what their role allows, except permanent deletion, managing people beyond inviting, merging Clients, Acknowledging Shortages and photos, which stay in the app. Each person connects their own, and can disconnect it in Settings; deactivating them ends it.
_Avoid_: Agent, bot, assistant, integration
