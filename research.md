# Muse Inventory Management Architecture Research

Generated from the repository state on 2026-05-02.

This document describes the app as it is currently implemented, not the idealized version implied by `MUSE_PRODUCT_SPEC.md`. It is based on the source in `app/`, `components/`, `lib/`, `prisma/`, config files, and supporting assets. Generated/vendor directories such as `.next/` and `node_modules/` are present in the workspace but are not treated as authored architecture.

## 1. Executive Summary

Muse Inventory Management is a small internal monolith built with Next.js App Router, React 19, NextAuth credentials auth, Prisma 7, and PostgreSQL.

The architecture is straightforward:

- Reads are mostly handled in server components that query Prisma directly.
- Writes are handled through Next.js server actions.
- There are only three API routes: auth, demo reset, and image upload.
- Client components are used for forms, modals, row actions, toast notifications, and query-param driven UI.
- The app models eight core domain entities: `User`, `StorageLocation`, `InventoryItem`, `GiftItem`, `Event`, `InventoryReservation`, `GiftReservation`, and `AuditLog`.

The app is feature-complete enough to run real workflows for:

- inventory tracking
- event management
- event-based inventory reservations
- consumable gift requests and fulfillment
- admin approvals
- audit logging
- in-app notifications

It also contains a small amount of dormant or reference-only material:

- design assets in `designs/`
- normalized CSV source data in `data/`
- placeholder settings UI
- a few unused or leftover files

## 2. Repository Inventory

### Source and support areas

| Path          | File count | Purpose                                                                                         |
| ------------- | ---------: | ----------------------------------------------------------------------------------------------- |
| `app/`        |         55 | Next.js routes, layouts, pages, loading states, and API routes                                  |
| `components/` |         18 | Shared client/server UI primitives and interaction components                                   |
| `lib/`        |         12 | Cross-cutting business helpers, Prisma client setup, auth config, notifications, upload helpers |
| `prisma/`     |          6 | Schema, migrations, and seed scripts                                                            |
| `types/`      |          1 | NextAuth type augmentation                                                                      |
| `public/`     |          3 | Logo, demo image, and one checked-in uploaded inventory image                                   |
| `designs/`    |         10 | Mockups, screenshots, and a non-runtime modal prototype                                         |
| `data/`       |          2 | CSV exports of normalized source inventory/gift data                                            |

### Important root files

- `package.json`: runtime scripts and dependency set
- `next.config.ts`: exposes `APP_MODE`; increases proxy body size limit
- `proxy.ts`: auth gate for almost all non-public routes
- `docker-compose.yml`: local Postgres 16 on port `5433`
- `.env.example`: required environment variables and demo-mode options
- `README.md`: short product summary
- `MUSE_PRODUCT_SPEC.md`: product/design spec, broader than current implementation

### Generated and working-tree artifacts currently present

- `.next/`
- `node_modules/`
- `tsconfig.tsbuildinfo`

These are not architecture, but they are physically present in the workspace.

## 3. High-Level Architecture

### Architecture style

This is a thin monolith:

- one Next.js application
- one PostgreSQL database
- no separate backend service
- no RPC framework like tRPC
- no REST API layer for the main business flows
- no message queue, cron worker, or background processing layer

### Primary runtime shape

```text
Browser
  -> proxy.ts auth gate
  -> App Router server page/layout
      -> getServerSession(authOptions)
      -> direct Prisma reads
      -> shared server-rendered page composition
  -> client components hydrate
      -> forms, modals, row actions, search UI, toast UI
      -> server actions for mutations
      -> /api/inventory-images for file upload
  -> Prisma + PostgreSQL
  -> local filesystem under public/uploads/inventory for managed images
```

### Mutation boundary

The real application boundary is not an API controller layer. It is a set of server-action modules:

- `app/(app)/events/actions.ts`
- `app/(app)/inventory/actions.ts`
- `app/(app)/inventory/reservation-actions.ts`
- `app/(app)/gifting/actions.ts`

Those files contain most authorization checks, validation, state transitions, audit calls, and cache revalidation.

## 4. Route Map

### Root and auth

- `app/page.tsx`
  - immediate redirect to `/dashboard`
- `app/layout.tsx`
  - root HTML shell and global stylesheet import
- `app/login/page.tsx`
  - login route; normalizes `callbackUrl`
- `app/login/LoginPageClient.tsx`
  - credentials sign-in form; shows demo credentials when `APP_MODE === "demo"`
- `app/login/layout.tsx`
  - wraps login route in NextAuth `SessionProvider`

### Authenticated route group

Everything under `app/(app)/` is behind both:

- `proxy.ts`
- session enforcement in `app/(app)/layout.tsx`

That layout:

- loads the server session
- redirects unauthenticated users to `/login`
- computes notification indicator state
- wraps the app in:
  - `SessionProvider`
  - `ToastProvider`
  - `DemoBanner`
  - `Navbar`

### Feature routes

#### Dashboard

- `app/(app)/dashboard/page.tsx`
  - notification feed, not a metrics dashboard
- `app/(app)/dashboard/loading.tsx`
  - skeleton loader with some leftover stat-card visuals

#### Events

- `app/(app)/events/page.tsx`
- `app/(app)/events/new/page.tsx`
- `app/(app)/events/[id]/page.tsx`
- `app/(app)/events/[id]/edit/page.tsx`
- `app/(app)/events/loading.tsx`
- `app/(app)/events/[id]/loading.tsx`

#### Inventory

- `app/(app)/inventory/page.tsx`
- `app/(app)/inventory/new/page.tsx`
- `app/(app)/inventory/[id]/page.tsx`
- `app/(app)/inventory/[id]/edit/page.tsx`
- `app/(app)/inventory/loading.tsx`
- `app/(app)/inventory/[id]/loading.tsx`

#### Gifting

- `app/(app)/gifting/page.tsx`
- `app/(app)/gifting/new/page.tsx`
- `app/(app)/gifting/[id]/page.tsx`
- `app/(app)/gifting/[id]/edit/page.tsx`
- `app/(app)/gifting/loading.tsx`
- `app/(app)/gifting/[id]/loading.tsx`

#### Reservations

- `app/(app)/reservations/page.tsx`

This page is only for inventory reservations. There is no separate first-class page for gift reservations.

#### Settings

- `app/(app)/settings/page.tsx`

This route is currently placeholder UI only. It does not persist anything.

### API routes

- `app/api/auth/[...nextauth]/route.ts`
  - NextAuth credentials handler
- `app/api/inventory-images/route.ts`
  - admin-only image upload endpoint
- `app/api/demo-reset/route.ts`
  - demo-only database reset, guarded by bearer secret

## 5. Auth, Session, and Authorization

### Session model

Auth is configured in `lib/auth.ts` using:

- `next-auth`
- `CredentialsProvider`
- bcrypt password comparison against `User.passwordHash`
- JWT sessions

The session is augmented in `types/next-auth.d.ts` so `session.user` always includes:

- `id`
- `email`
- `name`
- `role`

### Route protection

`proxy.ts` uses `withAuth` and matches almost everything except:

- `/login`
- `/api/auth`
- `/api/demo-reset`
- static assets
- uploaded images
- demo images

### Action-level authorization

Every mutation path rechecks auth in its server-action file. Common patterns:

- `requireSession()`: any authenticated user
- `requireAdmin()`: admin-only mutation

### Effective permissions

| Capability                                              | User                                 | Admin                                                    |
| ------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| View app pages                                          | Yes                                  | Yes                                                      |
| Create/edit/delete events                               | No                                   | Yes                                                      |
| Create/edit/retire/activate inventory items             | No                                   | Yes                                                      |
| Create/edit/consume/activate gift items                 | No                                   | Yes                                                      |
| Create inventory reservation                            | Yes                                  | Yes, auto-approved                                       |
| Approve/reject inventory reservation                    | No                                   | Yes                                                      |
| Cancel pending inventory reservation                    | Own pending only                     | Backend yes; UI mainly exposes own pending cancellations |
| Edit inventory reservation                              | Own pending only                     | Backend yes; UI mainly exposes own pending edits         |
| Return approved inventory reservation                   | Own reservations only                | Yes                                                      |
| Bulk approve inventory reservations                     | No                                   | Yes                                                      |
| Bulk return inventory reservations                      | Own approved reservations only       | Yes                                                      |
| Remove rejected/completed inventory reservation history | Own reservations only                | Yes                                                      |
| Create gift reservation                                 | Yes                                  | Yes, auto-approved                                       |
| Approve/reject/complete gift reservation                | No                                   | Yes                                                      |
| Upload item image                                       | No                                   | Yes                                                      |
| Demo database reset                                     | Only if env + bearer secret allow it | Same                                                     |

### Notable auth quirk

`lib/auth.ts` exports `authOptions`, but it also includes a `NextAuth` handler export that duplicates the actual route handler in `app/api/auth/[...nextauth]/route.ts`. The route works, but the extra handler export in `lib/auth.ts` is unnecessary.

## 6. Data Model

### Core entities

| Model                  | Purpose                                               | Notes                                                      |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `User`                 | Authenticated app user                                | Two roles: `ADMIN`, `USER`                                 |
| `StorageLocation`      | Canonical allowed locations                           | Lookup table only                                          |
| `InventoryItem`        | Reusable inventory                                    | Can be `ACTIVE` or `RETIRED`                               |
| `GiftItem`             | Consumable giveaway/gift stock                        | Can be `ACTIVE` or `CONSUMED`                              |
| `Event`                | Event that consumes inventory/gifts                   | Stores company, name, location, date range                 |
| `InventoryReservation` | Request/approval/return lifecycle for reusable items  | Tracks requester, approver, last modifier, return location |
| `GiftReservation`      | Request/approval/consumption lifecycle for gift items | Tracks requester, approver, last modifier                  |
| `AuditLog`             | Append-only-ish activity stream                       | Polymorphic via `entityType` + `entityId`                  |

### Relationship shape

```text
User
  -> creates/updates InventoryItem, GiftItem, Event
  -> requests/approves/modifies reservations
  -> performs AuditLog entries

Event
  <- InventoryReservation -> InventoryItem
  <- GiftReservation      -> GiftItem

AuditLog
  -> performedBy User
  -> references other entities by entityType/entityId string pair
```

### Important modeling detail

`StorageLocation` is not enforced by relational foreign keys.

These fields are plain strings:

- `InventoryItem.currentLocation`
- `GiftItem.currentLocation`
- `InventoryReservation.returnLocation`

The app enforces allowed values in application code through:

- `lib/storage-location-options.ts`
- `lib/storage-locations.ts`

This means location integrity is partly code-level, not database-level.

### Enums in use

- `UserRole`: `ADMIN`, `USER`
- `InventoryStatus`: `ACTIVE`, `RETIRED`
- `GiftStatus`: `ACTIVE`, `CONSUMED`
- `InventoryReservationStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELED`, `COMPLETED`
- `GiftReservationStatus`: `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`
- `AuditEntityType`
- `AuditActionType`

### Migrations

There are two migrations:

1. `20260401234111_init`
   - creates all initial enums and tables
2. `20260408133000_storage_locations`
   - adds `StorageLocation`
   - adds `GiftItem.currentLocation`
   - seeds canonical location names
   - backfills `GiftItem.currentLocation`

## 7. Runtime Layers

### 7.1 App Router and rendering layer

The app uses server-rendered pages for almost all data reads.

Pattern:

- page component loads session
- page component runs Prisma queries directly
- page component derives display data
- client components receive serialized props for interactive controls

There is no separate repository/service layer between route pages and Prisma for read paths.

### 7.2 Server action layer

Mutation modules are the main business layer:

- `events/actions.ts`
- `inventory/actions.ts`
- `inventory/reservation-actions.ts`
- `gifting/actions.ts`

They are responsible for:

- auth and role checks
- domain validation
- transactional writes where needed
- audit log calls
- `revalidatePath()` cache invalidation

### 7.3 Database access layer

`lib/db.ts` sets up Prisma using `@prisma/adapter-pg` and `pg`.

Notable details:

- production explicitly enables SSL with `rejectUnauthorized: false`
- development reuses a global client
- there is a schema-change guard that recreates the client if the cached Prisma instance predates the `StorageLocation` model

### 7.4 API route layer

Only three cases use API routes instead of server actions:

- auth handshake
- demo reset
- binary file upload

### 7.5 Filesystem storage layer

Managed item images are stored under:

- `public/uploads/inventory/`

Upload logic lives in:

- `lib/inventory-image.ts`
- `lib/inventory-image-storage.ts`
- `app/api/inventory-images/route.ts`

Accepted types:

- JPEG
- PNG
- WEBP

Limit:

- 10 MB app-level validation
- 15 MB `proxyClientMaxBodySize` config

## 8. Cross-Cutting Libraries

### `lib/availability.ts`

This file holds the key availability rules:

- `datesOverlap()`
- `getInventoryAvailableQty()`
- `getGiftAvailableQty()`
- `getEventStatus()`

Important business behavior:

- inventory availability only counts `APPROVED` overlapping reservations
- pending inventory requests do not hold stock
- gifts are treated as globally consumable stock; date overlap does not matter
- event status is normalized to date-only comparisons

### `lib/audit.ts`

Best-effort audit logging wrapper.

Important behavior:

- audit failures do not fail the main transaction
- metadata is stored as serialized JSON string

### `lib/notifications.ts`

Implements the dashboard notification feed and navbar attention indicator.

Admin attention sources:

- pending inventory reservations
- pending gift reservations
- approved inventory reservations whose event has ended but has not been returned

User attention/updates:

- reservation status changes made by someone else
- approved inventory reservations that now need returning

### `lib/storage-location-options.ts` and `lib/storage-locations.ts`

These define and validate the canonical location list:

- `JP Display`
- `Nancy`
- `Muse Storage Unit`

`getStorageLocationNames()` pulls names from the database but filters them against the hardcoded union list, so the database and code must stay aligned.

### `lib/inventory-image-storage.ts`

Handles:

- managed upload path generation
- file writes
- replacement cleanup
- managed-image detection

### `lib/inventory-reservation-ui.ts` and `lib/gift-reservation-ui.ts`

Small mapping helpers for UI labels and badge variants.

## 9. Feature Architecture

### 9.1 Dashboard and notifications

Files:

- `app/(app)/dashboard/page.tsx`
- `lib/notifications.ts`
- `components/Navbar.tsx`

Behavior:

- dashboard is a notification inbox, not an analytics dashboard
- notifications are grouped into "attention" and "updates"
- navbar unread indicator uses both:
  - server-computed notification timestamp
  - a client `localStorage` seen marker

Important observation:

- `dashboard/loading.tsx` still renders skeleton stat cards and two-column sections that do not exactly match the current dashboard page shape

### 9.2 Events

Files:

- routes under `app/(app)/events/`
- `events/actions.ts`
- `EventForm.tsx`
- `EventRowActions.tsx`
- `ReserveInventoryForEventButton.tsx`
- `RequestGiftsForEventButton.tsx`

Behavior:

- admins can create, edit, and delete events
- deletion is blocked if active inventory/gift reservations still exist
- list page fetches all matching events, computes `past/current/future`, sorts in memory, then paginates 20 per page
- event rows show up to three inventory reservations and three gift reservations inline
- event detail page is the main event-centric reservation view

Important observations:

- event sorting is application-side, not database-side
- gift requests can be initiated directly from event list rows, but not from the current event detail page
- inventory reservations can be initiated directly from event rows/detail

### 9.3 Inventory items

Files:

- routes under `app/(app)/inventory/`
- `inventory/actions.ts`
- `InventoryForm.tsx`
- `InventoryTable.tsx`
- `InventoryActions.tsx`
- `InventoryDetailActions.tsx`
- `InventoryHeaderActions.tsx`

Behavior:

- admin-only create/edit/retire/activate
- list page searches title/description/location/notes
- rows show:
  - image
  - description/notes summary
  - reserved approved count aggregate
  - per-user pending/approved chips
- detail page shows:
  - recent active reservations
  - recent reservation history
  - recent audit history
  - reserve action for active items

Important observations:

- detail page only fetches the latest 20 reservations and latest 20 audit logs
- "delete" on inventory is actually soft retirement, not row deletion
- `InventoryForm.tsx` duplicates upload helper logic inline instead of reusing `lib/item-image-client.ts`

### 9.4 Inventory reservations

This is the richest part of the codebase.

Files:

- `app/(app)/inventory/reservation-actions.ts`
- `components/ReserveInventoryModal.tsx`
- `components/InventoryReservationRowActions.tsx`
- `app/(app)/reservations/*`

Behavior:

- can create single or batch reservations
- non-admin reservations start `PENDING`
- admin reservations auto-approve
- batch creation merges duplicate active reservations for the same user + event + item
- editing an approved reservation reverts it to `PENDING`
- approved reservations can be returned, which also updates the inventory item location
- rejected/completed history can be removed from the reservations page
- admins can bulk approve pending reservations
- admins and allowed users can bulk return approved reservations

Important business rules implemented here:

- no reservations for past events
- quantity must be at least 1
- duplicate items cannot be submitted twice in one batch
- availability is checked against overlapping approved reservations only
- bulk approvals are processed sequentially so each approval changes the availability for the next item in the loop

Important observations:

- this module is almost 900 lines and acts as the main business-logic hub
- `removeInventoryReservationHistory()` can update the item location before deleting completed history if the saved return location differs from the item's current location
- reservations page is inventory-only; gift reservations have no equivalent global queue page

### 9.5 Gifting

Files:

- routes under `app/(app)/gifting/`
- `gifting/actions.ts`
- `GiftForm.tsx`
- `GiftRowActions.tsx`
- `GiftDetailActions.tsx`
- `GiftHeaderActions.tsx`
- `components/GiftUseModal.tsx`
- `components/GiftReservationRowActions.tsx`

Behavior:

- admin-only create/edit/consume/activate gift items
- users can request gifts against an event
- admin gift requests auto-approve
- admin can approve, reject, or mark approved requests as used
- when a gift request is completed, `GiftItem.quantity` is decremented and status may flip to `CONSUMED`

Differences from inventory reservations:

- gift availability is global, not overlap-based
- there is no return flow
- there is no cancel/edit/remove-terminal flow for gift reservations
- completing a gift reservation mutates both reservation state and gift stock

Important observations:

- "delete" on a gift item is implemented as "mark consumed"
- the gifting list/detail pages reuse some inventory presentation components

### 9.6 Reservations page

Files:

- `app/(app)/reservations/page.tsx`
- `PendingReservationsTable.tsx`
- `NewReservationButton.tsx`

Behavior:

- central table for inventory reservations only
- admins see all reservations
- normal users only see their own
- status order is custom-sorted with pending first
- supports:
  - per-row approve/reject/cancel/return/edit/remove
  - bulk approve
  - bulk return
  - new reservation modal

Important observation:

- this page reuses the same bulk-dock portal slot infrastructure as the inventory list

### 9.7 Settings

Files:

- `app/(app)/settings/page.tsx`

Behavior:

- profile fields
- notification preferences
- workspace defaults

Current status:

- UI only
- not backed by database
- "Save Changes" button disabled

## 10. Shared UI Architecture

### Shared primitives

- `Modal.tsx`
  - portal-based modal
  - escape handling
  - click-outside close
  - basic focus trap
- `Toast.tsx`
  - global toast provider
  - optional undo/action pattern
- `PageHeader.tsx`
- `Breadcrumbs.tsx`
- `StatusBadge.tsx`
- `SearchBar.tsx`
- `Pagination.tsx`
- `TableSkeleton.tsx`
- `InventoryImagePreview.tsx`

### Shared page shell

`app/(app)/inventory/InventoryPageShell.tsx` is a reused layout shell for:

- inventory
- gifting
- events
- reservations

It standardizes:

- full-width header band
- toolbar band
- table container area
- optional pagination footer
- the bulk-action dock portal slot used by inventory and reservations

It also contains some legacy pagination-cleanup logic that strips `page` and `pageSize` params on routes that no longer use that pattern.

### Navigation shell

`components/Navbar.tsx` plus `components/Navbar.module.css` provide:

- primary navigation
- user menu
- dashboard notification indicator
- logout action

This is the only major component using a CSS module; most other styling lives in global CSS.

### Interaction pattern

The general UI pattern is:

- server page renders current truth
- client child handles local UI state
- client child calls server action
- server action writes data and revalidates paths
- client calls `router.refresh()` and shows a toast

There is no client data cache layer like React Query or SWR.

## 11. Styling System

### What is actually in use

The project includes Tailwind packages and imports `@import "tailwindcss";` in `app/globals.css`, but the implemented UI is mostly hand-authored CSS classes, not utility-class driven Tailwind.

Styling is dominated by:

- `app/globals.css` at 3,124 lines
- `components/Navbar.module.css` at 270 lines

### Styling characteristics

- CSS custom properties define brand, neutrals, typography, and status colors
- page shells, tables, forms, modals, and detail pages all share the same global CSS file
- mobile/responsive support exists but styling is not component-scoped outside the navbar

Important observation:

- the CSS architecture is centralized and simple, but the single large stylesheet is also a maintenance hotspot

## 12. Operational and Environment Model

### Environment variables

From `.env.example`:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- optional `APP_MODE`
- optional `DEMO_RESET_SECRET`

### Local database

`docker-compose.yml` provisions:

- `postgres:16-alpine`
- container name `muse_postgres`
- database `muse_db`
- port mapping `5433:5432`

### Demo mode

When `APP_MODE=demo`:

- login page shows prefill buttons for demo accounts
- `DemoBanner` is rendered in the app shell
- `/api/demo-reset` is enabled if the bearer token matches `DEMO_RESET_SECRET`

### Seed scripts

- `npm run seed`
  - basic local seed
- `npm run demo:reset`
  - richer demo seed with:
    - more inventory
    - more gifts
    - more events
    - sample reservations in multiple states
    - audit logs

## 13. Data Flow Summaries

### 13.1 Inventory reservation flow

```text
User opens ReserveInventoryModal
  -> selects event and item(s)
  -> client checks per-item availability via server action
  -> submit calls createInventoryReservationsBatch()
      -> validates event and quantities
      -> loads existing active reservations for same user/event/item
      -> checks overlap availability against approved reservations
      -> creates or merges reservations in a transaction
      -> optionally auto-approves for admins
      -> writes audit entries
      -> revalidates event, inventory, reservations, dashboard
  -> client refreshes and toasts result
```

### 13.2 Gift request flow

```text
User opens GiftUseModal or event gift modal
  -> selects event and quantity
  -> client checks available gift stock
  -> submit calls createGiftReservation()
      -> validates event and quantity
      -> computes available gift stock
      -> creates reservation
      -> auto-approves for admins
      -> writes audit entry
      -> revalidates gifting/event/dashboard views
```

### 13.3 Return flow for reusable inventory

```text
User/admin clicks Return
  -> modal captures return location and notes
  -> returnInventoryReservation()
      -> validates permissions and APPROVED status
      -> marks reservation COMPLETED
      -> moves item currentLocation to return location
      -> writes RETURNED audit
      -> revalidates dependent pages
```

### 13.4 Image upload flow

```text
Client selects image
  -> client validates mime type and size
  -> POST /api/inventory-images
      -> session required
      -> admin role required
      -> server validates again
      -> file written to public/uploads/inventory
      -> public URL returned
  -> create/update item action stores that URL
  -> old managed image may be deleted on replacement
```

## 14. Non-Runtime and Reference Material

### `designs/`

This folder is not part of the live runtime. It contains:

- screenshots and image references
- HTML/SCSS examples
- `designs/reserveModal.tsx`, a design-only prototype that imports nonexistent `./ui/*` primitives and uses a different component approach than the real app

### `data/`

The CSVs appear to be normalized source material:

- `data/muse-inventory.normalized.csv`
- `data/muse-gifts.normalized.csv`

They are not currently wired into the runtime or seed scripts.

### `MUSE_PRODUCT_SPEC.md`

This is a detailed product specification and design/reference document. It is broader than the current implementation and includes ideas, rules, and UX expectations that are only partially realized in code.

## 15. Notable Quirks, Gaps, and Risks

These are part of the current architecture and should be considered real characteristics of the codebase.

### Implemented but incomplete

- settings page is placeholder UI only
- dashboard loading skeleton does not exactly match the current dashboard content model

### Dormant or unused code

- `components/FilterDropdown.tsx` exists but is not imported anywhere
- `app/page.module.css` exists but `app/page.tsx` just redirects and does not import it
- `designs/reserveModal.tsx` is not runtime code

### Architectural hotspots

- `app/(app)/inventory/reservation-actions.ts` is the dominant business-logic file
- `app/globals.css` is a single large styling surface for most of the product

### Scalability constraints

- inventory, gifting, and reservations list pages load full matching datasets without database pagination
- event sorting is partly in memory after fetch
- availability logic loads approved reservations and filters overlap in application code

### Persistence risks

- managed image uploads are stored on the local filesystem under `public/uploads/inventory`
- this is not durable on stateless/serverless hosting such as Vercel without persistent object storage

### Data integrity constraints

- storage locations are duplicated in both code and database
- item location and return location are plain strings, not FK-backed relations

### Tooling gaps

- no automated tests were found
- no lint script is defined in `package.json`
- no CI/CD config is visible in the repository

## 16. Bottom Line

The current app is a pragmatic internal operations system with a clear center of gravity:

- Next.js server-rendered pages for reads
- server actions for writes
- Prisma/Postgres for persistence
- reusable inventory reservations and consumable gift workflows as the core domain

The codebase is coherent and functional, but it is intentionally simple:

- little abstraction between routes and database
- business logic concentrated in a few large action files
- global CSS instead of a componentized design system
- local-disk image storage
- no automated test harness

If someone needs to work effectively in this repository, the highest-value files to understand first are:

- `app/(app)/layout.tsx`
- `lib/auth.ts`
- `lib/db.ts`
- `lib/availability.ts`
- `lib/notifications.ts`
- `app/(app)/inventory/reservation-actions.ts`
- `app/(app)/gifting/actions.ts`
- `prisma/schema.prisma`
