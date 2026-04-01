# Muse Inventory Management App — Product Specification

## 1. Project Summary

### Product Name
Muse Event Management

### Purpose
Build a clean, fast internal inventory management system for Muse that replaces spreadsheet-based workflows with a reliable web app for managing inventory, events, and event gifting.

### Primary Outcome
The system should let internal users:
- view inventory and gifting availability clearly,
- reserve items for specific events,
- return inventory manually,
- track which user made each operational change,
- and give admins full control over approvals, edits, and exceptions.

### Product Principles
- Better than Excel for the common tasks Muse does every day
- Simple, fast, and easy to use
- Table-first UI with low cognitive load
- Operationally reliable over visually flashy
- Clear auditability and accountability
- Minimal friction for admins

---

## 2. Recommended Stack

The stack should be treated as fixed unless there is a strong reason to change it.

- **Frontend:** Next.js
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Styling:** Tailwind CSS
- **Auth:** NextAuth or equivalent simple session-based auth solution
- **Hosting:** Vercel for app, managed Postgres for database
- **Image storage:** Object storage or simple hosted file storage depending on deployment choice

### Technical Priorities
- Keep architecture simple
- Avoid overengineering
- Prefer maintainability over clever abstractions
- Favor straightforward CRUD and predictable state transitions
- Build for internal operational use, not consumer-grade complexity

---

## 3. Users and Roles

### Admin
Admins can:
- create, edit, retire, and manage inventory
- create, edit, and delete events
- create, edit, and manage gifts
- approve or reject reservations
- override any value in the system when needed
- manually adjust quantities
- verify who made changes and when

### Normal User
Normal users can:
- browse inventory, events, and gifts
- create reservations for inventory or gifts
- edit or cancel their own reservations
- return their own reserved inventory manually
- specify where inventory was returned

Normal users cannot:
- approve reservations
- directly edit inventory records outside the reservation flow
- directly alter system-wide quantities except through approved workflows

---

## 4. Core Domain Concepts

### Inventory
Regular reusable inventory items.

Examples:
- display materials
- decor pieces
- event gear
- signage
- reusable equipment

Inventory:
- has a quantity
- has a current location
- can be reserved for an event
- must be returned manually
- is never permanently deleted
- can be retired

### Gifts
Consumable items intended to be given away to people at events.

Examples:
- jackets
- bags
- giveaway items
- branded gifts

Gifts:
- have quantities
- can be reserved for an event
- require admin approval like inventory
- are not returned
- are consumed when used
- should remain historically traceable even after use

### Events
Events are the time-based container that reservations attach to.

Each event has:
- a company name
- an event name
- a start date
- an end date
- a location

Reservations are made for a specific event. Availability is determined by whether event date ranges overlap.

---

## 5. Core Business Rules

### 5.1 Reservation Rules
- All inventory reservations must be tied to a specific event.
- All gift reservations must be tied to a specific event.
- All reservations must be approved by an admin before they affect real availability.
- Pending reservations do **not** reduce available quantity.
- Only approved reservations reduce available quantity.
- Users can edit or cancel their own reservations.
- If a user edits an already approved reservation, it must go back into approval flow and require approval again.
- Multiple events may reserve the same item if quantity allows and the event windows do not conflict at the unit/quantity level.

### 5.2 Date Overlap Rules
Two events are considered overlapping if their date ranges touch or overlap in any way.

Example:
- Event A: May 1–3
- Event B: May 3–5

This **is** considered overlapping and should not be allowed to share the same quantity allocation for the same inventory during that overlap window.

### 5.3 Inventory Return Rules
- Reserved inventory must be returned manually by the user who reserved it.
- There is no automatic return when an event ends.
- A return action requires the user to specify where the inventory was returned.
- Partial returns are not allowed.
- If items are lost or damaged, the user can note that in notes, and an admin can later adjust quantity manually.

### 5.4 Inventory Lifecycle Rules
- Inventory can be active or retired.
- Retired inventory is not available for new reservations.
- Retired inventory should still be visible historically and referenceable in the UI.
- Inventory is never permanently deleted.

### 5.5 Gift Lifecycle Rules
- Gifts are consumable, not reusable.
- After approved use, gifts are considered consumed/gone.
- Gifts should not simply disappear from history.
- Used gifts should be visually indicated as consumed or crossed out in the UI.
- Gifts should not be treated the same as retired reusable inventory.

### 5.6 Event Rules
- Event state should be inferred by date, not stored manually.
- Events should appear visually distinct in the UI depending on whether they are past, current, or future.
- Admins can create, edit, and delete events.

### 5.7 Audit Rules
The system must make it clear:
- who created a reservation,
- who edited a reservation,
- who approved or rejected it,
- who returned inventory,
- who edited quantities,
- and when each of those actions happened.

This is operationally important so admins can verify responsibility and trace issues like missing inventory.

---

## 6. Availability Logic

### Inventory Availability Formula
Available quantity for a given inventory item during a requested event window should be:

**total quantity - sum of approved reservation quantities for overlapping event windows**

Important:
- Pending reservations do not count against availability.
- Rejected, canceled, and completed reservations do not count against availability.
- Overlap includes shared boundary dates.

### Gift Availability Formula
Gift availability should follow the same approval logic:

**total quantity - approved allocated quantity not yet consumed, depending on exact implementation choice**

For MVP, the simplest acceptable model is:
- gifts have quantity,
- reservations require approval,
- once used, the gifted quantity is deducted and considered consumed.

---

## 7. Required Pages

## 7.1 Dashboard
Purpose: quick operational overview.

Should include:
- total active inventory count
- total gift count
- pending reservation approvals
- upcoming events
- currently active events
- active approved reservations awaiting return
- useful quick-view operational summary

Dashboard should be useful immediately, not decorative.

---

## 7.2 Inventory Page
Purpose: primary inventory management table.

### Expected UI Pattern
The provided design reference shows the general direction:
- table-based layout
- modern clean row design
- compact navigation/sidebar layout
- searchable/filterable inventory list
- row-level actions

### Notes About the Design Reference
The design image is a **directional reference**, not a literal locked final spec.
The visual style, spacing, and table-first structure should be followed, but the exact columns and actions should be adjusted to reflect the real product rules in this specification.

### Inventory Table Should Include
Recommended columns:
- image
- item name/title
- description
- available quantity
- total quantity
- current location
- status
- last updated
- last updated by (if practical in table view, otherwise in details)
- notes or indicator that notes exist

### Inventory Actions
For standard users:
- open/view details
- reserve

For admins:
- edit
- retire
- optionally adjust quantity from edit flow

Admin row actions may appear on hover.

### Inventory Status Presentation
- active inventory should appear normally
- retired inventory should be visually distinguished, such as:
  - greyed out,
  - separated into a retired section/table,
  - or filtered via tabs

---

## 7.3 Events Page
Purpose: manage and browse events.

Each event should show:
- company name
- event name
- date range
- location
- associated inventory/gift reservations summary
- inferred status: past / current / future

### Event UI Expectations
- past events should be greyed out or visually de-emphasized
- current and future events should be easy to distinguish
- admins can edit and delete events

---

## 7.4 Gifting Page
Purpose: manage consumable event gifts.

Should mirror inventory patterns where useful, while respecting gifting-specific rules.

Recommended columns:
- item name/title
- description
- available quantity
- total quantity
- status
- associated event(s) if applicable
- notes

### Gift Actions
For users:
- reserve gifts for event

For admins:
- edit gifts
- manage quantities
- mark gift items as consumed through approved operational flow

### Gift Visual Behavior
Consumed gifts should be visually distinguished, e.g.:
- crossed out,
- marked consumed,
- or shown in a consumed section

Do not treat used gifts exactly like retired reusable inventory.

---

## 8. Reservation System

The agent should model reservations as explicit first-class entities in the schema, not implicit relationships.

There should be separate reservation records for inventory and gifts, or a carefully designed shared reservation model if done cleanly.

For clarity and maintainability, separate models are acceptable and likely simpler.

### Reservation Statuses (Inventory)
- pending
- approved
- rejected
- canceled
- completed

#### Meaning of statuses
- **pending:** awaiting admin approval
- **approved:** accepted and currently counts against availability
- **rejected:** denied by admin
- **canceled:** canceled by user before completion; should release any reserved state
- **completed:** inventory was returned

### Reservation Statuses (Gifts)
Recommended MVP statuses:
- pending
- approved
- rejected
- completed

Where completed means the gift allocation was used/consumed.

### Reservation Notes
Reservations should support notes so users/admins can document:
- damaged items
- missing items
- special circumstances
- quantity corrections
- return issues

---

## 9. Locations

Location needs to support both:
- known/common recurring locations, and
- arbitrary real-world custom locations.

Examples:
- JP Display warehouse
- California
- Mexico
- Tennessee
- someone’s garage

### Recommended Approach
Use a flexible model that allows:
- predefined saved locations for common use
- freeform/custom return or event locations when needed

### Minimum Requirements
- each event has a location
- inventory has a current location
- when returning inventory, the user must specify where it was returned

---

## 10. Search and Filtering

For MVP, search should include:
- item name/title
- description
- location

The UI should support fast filtering and browsing.

Recommended filters:
- active vs retired inventory
- event status (past/current/future)
- reservation status
- gift status

---

## 11. Design Assets and Brand Assets

## 11.1 Design Image
Yes, the design image should be included as a reference for the agent.

### How to use it
Place the design screenshot in the repo and reference it explicitly in this spec.
Recommended path:
- `docs/assets/inventory-page-reference.png`

### What the agent should do with it
- use it as a visual style and layout reference,
- preserve the overall clean table-first direction,
- but not blindly copy incorrect placeholder columns or incomplete details from the mockup.

The mockup is useful for:
- visual hierarchy
- table feel
- spacing direction
- sidebar/top-level layout direction

The mockup is **not** the source of truth for:
- exact column definitions
- business logic
- state rules
- permissions

This document is the source of truth for those.

## 11.2 Logo File
Yes, the logo file should also be included and referenced.

Recommended path:
- `public/logo.png`

### Logo guidance
- use `logo.png` in app navigation/header/sidebar branding
- do not redesign the logo unless explicitly instructed
- keep branding minimal and clean

---

## 12. Schema Overview

This section describes the intended schema structure at the product level. The implementation can vary slightly, but the domain meaning should remain consistent.

### Required Models
- User
- InventoryItem
- Event
- InventoryReservation
- GiftItem
- GiftReservation
- optional: Location
- optional: AuditLog

### Recommendation
The agent should strongly consider including an `AuditLog` model or equivalent history-tracking strategy, because traceability is a core requirement.

---

## 13. Detailed Schema Specification

Below is the intended schema structure in conceptual form.

### 13.1 User
Fields:
- `id`
- `name`
- `email`
- `role` (`ADMIN` | `USER`)
- `createdAt`
- `updatedAt`

Relationships:
- one user can create many reservations
- one user can approve many reservations
- one user can perform many audit actions

---

### 13.2 InventoryItem
Fields:
- `id`
- `title`
- `description`
- `imageUrl` (nullable)
- `quantity`
- `currentLocation`
- `status` (`ACTIVE` | `RETIRED`)
- `notes` (nullable)
- `createdAt`
- `updatedAt`
- `createdByUserId` (nullable but recommended)
- `updatedByUserId` (nullable but recommended)

Relationships:
- one inventory item can have many reservations over time

Important notes:
- quantity is total owned quantity
- available quantity is computed from approved overlapping reservations
- inventory is never deleted

---

### 13.3 Event
Fields:
- `id`
- `companyName`
- `eventName`
- `location`
- `startDate`
- `endDate`
- `notes` (nullable)
- `createdAt`
- `updatedAt`
- `createdByUserId` (nullable but recommended)
- `updatedByUserId` (nullable but recommended)

Relationships:
- one event can have many inventory reservations
- one event can have many gift reservations

Important notes:
- event status is inferred from dates, not stored manually
- admins can delete events

---

### 13.4 InventoryReservation
Fields:
- `id`
- `inventoryItemId`
- `eventId`
- `quantity`
- `status` (`PENDING` | `APPROVED` | `REJECTED` | `CANCELED` | `COMPLETED`)
- `requestedByUserId`
- `approvedByUserId` (nullable)
- `returnLocation` (nullable until returned)
- `notes` (nullable)
- `createdAt`
- `updatedAt`
- `lastModifiedByUserId` (recommended)

Relationships:
- belongs to one inventory item
- belongs to one event
- requested by one user
- optionally approved by one admin user

Important notes:
- if edited after approval, it should revert to pending
- completed means returned
- user must return entire reservation, not partial

---

### 13.5 GiftItem
Fields:
- `id`
- `title`
- `description`
- `quantity`
- `status` (`ACTIVE` | `CONSUMED`)
- `notes` (nullable)
- `createdAt`
- `updatedAt`
- `createdByUserId` (nullable but recommended)
- `updatedByUserId` (nullable but recommended)

Relationships:
- one gift item can have many gift reservations over time

Important notes:
- gifts are consumable
- consumed gifts should remain historically visible

---

### 13.6 GiftReservation
Fields:
- `id`
- `giftItemId`
- `eventId`
- `quantity`
- `status` (`PENDING` | `APPROVED` | `REJECTED` | `COMPLETED`)
- `requestedByUserId`
- `approvedByUserId` (nullable)
- `notes` (nullable)
- `createdAt`
- `updatedAt`
- `lastModifiedByUserId` (recommended)

Relationships:
- belongs to one gift item
- belongs to one event
- requested by one user
- optionally approved by one admin user

Important notes:
- gifts do not get returned
- completed means consumed/used

---

### 13.7 Optional Location Model
A separate location model is optional but reasonable if the app benefits from reusable saved locations.

Possible fields:
- `id`
- `name`
- `type` (`SAVED` | `CUSTOM`)
- `createdAt`
- `updatedAt`

If this adds too much complexity for MVP, a string field is acceptable initially.

---

### 13.8 AuditLog (Strongly Recommended)
Because the product requires visibility into who changed what and when, an audit trail should exist.

Possible fields:
- `id`
- `entityType` (`INVENTORY_ITEM` | `EVENT` | `INVENTORY_RESERVATION` | `GIFT_ITEM` | `GIFT_RESERVATION`)
- `entityId`
- `actionType` (`CREATED` | `UPDATED` | `APPROVED` | `REJECTED` | `RETURNED` | `RETIRED` | `DELETED` | `CONSUMED` | `QUANTITY_ADJUSTED`)
- `performedByUserId`
- `timestamp`
- `summary`
- `metadataJson` (optional)

At minimum, the agent should implement some equivalent traceability mechanism.

---

## 14. Suggested Enums

### UserRole
- `ADMIN`
- `USER`

### InventoryStatus
- `ACTIVE`
- `RETIRED`

### GiftStatus
- `ACTIVE`
- `CONSUMED`

### InventoryReservationStatus
- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELED`
- `COMPLETED`

### GiftReservationStatus
- `PENDING`
- `APPROVED`
- `REJECTED`
- `COMPLETED`

### AuditEntityType
- `INVENTORY_ITEM`
- `EVENT`
- `INVENTORY_RESERVATION`
- `GIFT_ITEM`
- `GIFT_RESERVATION`

### AuditActionType
- `CREATED`
- `UPDATED`
- `APPROVED`
- `REJECTED`
- `RETURNED`
- `RETIRED`
- `DELETED`
- `CONSUMED`
- `QUANTITY_ADJUSTED`

---

## 15. UX and Interaction Requirements

### General UX Requirements
- keep the UI clean and simple
- prioritize clarity over density
- make common actions fast
- avoid clutter
- preserve a professional internal tool feel

### Specific UX Requirements
- reserve buttons must be present where appropriate
- admin edit/retire actions should be accessible at row level
- hover actions for admin are acceptable
- completed or inactive entities should be visually distinguishable
- history or attribution should be visible where operationally useful

### Event Visual States
- past events: greyed out/de-emphasized
- current events: clearly indicated
- future events: clearly indicated

### Inventory Visual States
- retired inventory visually separated or greyed out
- active inventory clear and easy to scan

### Gift Visual States
- consumed gifts crossed out or marked consumed

---

## 16. Operational Edge Cases the Agent Must Cover

The implementation plan must explicitly account for these:

- two users requesting the same inventory near the same time
- approved reservations on overlapping event windows
- boundary date overlap handling
- user edits an approved reservation
- user cancels a pending or approved reservation
- event deletion while reservations exist
- inventory returned to a different location than originally assigned
- damaged or lost inventory upon return
- manual admin quantity correction after issues
- duplicate inventory item names
- broken or missing image URLs
- retired inventory that still appears in history
- consumed gifts that remain historically visible

---

## 17. Performance Expectations

For MVP, the system should:
- load primary pages quickly
- support fast search and filtering
- handle a moderate internal dataset without feeling sluggish
- keep the table views responsive and easy to use

This is an internal business app, so perceived speed matters a lot.

---

## 18. Out of Scope for MVP

These are intentionally not required for first release unless later requested:
- email notifications
- push notifications
- advanced analytics dashboards
- barcode scanning
- mobile-native app
- external vendor/customer portal
- complex multi-org permissions
- partial returns
- automatic return workflows

---

## 19. Definition of Done for MVP

The MVP is complete when:
- users can authenticate
- admins and users have correct role-based access
- inventory can be created, edited, searched, reserved, returned, and retired
- events can be created, edited, viewed, and deleted
- gifts can be created, reserved, approved, and consumed
- availability correctly respects approved overlapping date windows
- users can edit/cancel their own reservations
- edited approved reservations re-enter approval flow
- admins can see and act on pending approvals
- the UI clearly indicates inactive/past/consumed states
- the system records who made important changes and when
- the app is clean, usable, and meaningfully better than the spreadsheet workflow

---

## 20. Files the Agent Should Read

The planning/build agent should treat the following as source material:

- `docs/MUSE_PRODUCT_SPEC.md` — this document
- `docs/assets/inventory-page-reference.png` — design direction reference
- `public/logo.png` — brand/logo asset
- `prisma/schema.prisma` — implementation schema once created

If additional notes or data samples exist, they should also be added to `/docs` and referenced here.

---

## 21. Agent Instructions

When planning or implementing from this specification:
- treat this document as the business/source-of-truth spec
- use the design image as a visual/layout direction, not a business logic source
- preserve the fixed stack unless a strong justification exists
- prefer boring, maintainable architecture
- explicitly account for reservations, approvals, date overlap, auditability, and state transitions
- do not overbuild beyond MVP
- do not omit admin override capabilities
- do not treat gifts and reusable inventory as the same lifecycle

