# Repository Cleanup Checklist

---

## Critical — Security

- [x] **Rename `proxy.ts` → `middleware.ts`** (`proxy.ts`)
  Next.js only executes `middleware.ts` at the project root. The current file is silently ignored, meaning edge-level auth protection never runs. All route protection currently depends solely on layout-level checks.

- [x] **Rotate live database credentials** (`.env`)
  `NEXTAUTH_SECRET` replaced with a strong generated value; `DEV_ADMIN_LOGIN` / `DEV_USER_LOGIN` removed; duplicate credential comment removed. **Action still needed: rotate the Neon database password at console.neon.tech** — the current password was stored in a comment and the active URL in the same `.env` file.

---

## High — Bugs & Security

- [x] **`rejectInventoryReservation` missing status guard** (`app/(app)/inventory/reservation-actions.ts`)
  `approveInventoryReservation` throws `"Reservation is not pending"` if the status isn't `PENDING`. `rejectInventoryReservation` has no equivalent guard — it will reject already-approved or completed reservations, corrupting inventory state. Add the same `if (reservation.status !== "PENDING")` check.

- [x] **Move image uploads off the local filesystem** (`app/(app)/inventory/InventoryForm.tsx`, `GiftForm.tsx`)
  Migrated to Vercel Blob (`@vercel/blob`). `lib/inventory-image-storage.ts` now uses `put`/`del` from `@vercel/blob`. `isManagedInventoryImageUrl` updated to match Vercel Blob hostnames. **Action still needed: add `BLOB_READ_WRITE_TOKEN` to `.env` and Vercel project settings** (get it from the Vercel dashboard → Storage → Blob).

---

## Medium — Confirmed Bugs

- [x] **`handleCancel` sets wrong loading state** (`components/InventoryReservationRowActions.tsx:152`)
  Fixed: `setLoadingAction("remove")` → `setLoadingAction("cancel")`.

- [x] **Unsafe status variant cast in `EventDetailClient`** (`app/(app)/events/[id]/EventDetailClient.tsx:456`)
  Added `getInventoryReservationStatusVariant()` to `lib/inventory-reservation-ui.ts` (mirrors gift version). Updated `EventDetailClient` to use it instead of the unsafe `as` cast.

- [x] **Gift availability check ignores `eventId`** (`app/(app)/gifting/actions.ts:34`)
  Confirmed design intent: gifts are globally scoped. Removed the dead `eventId` parameter, unused event DB fetch, and its `Event not found` error. Updated callers in `RequestGiftsForEventButton.tsx` and `GiftUseModal.tsx`.

- [x] **Silent email failures** (`reservation-actions.ts`, `gifting/actions.ts`)
  Added `.catch(err => console.error("Email dispatch failed:", err))` to all 9 fire-and-forget email calls across both files. Also fixed inner `void sendEmail` inside IIFEs to `await sendEmail` so errors propagate to the outer `.catch`.

- [x] **Notification dismissals reset on refresh** (`app/(app)/dashboard/NotificationCards.tsx`)
  Added `localStorage` persistence. On mount, dismissed IDs are restored from `"dismissed-notifications"`. On dismiss, the updated list is written back. Storage errors (quota, private browsing) are silently ignored.

- [x] **Non-functional settings fields** (`app/(app)/settings/page.tsx:113–165`)
  Removed the entire "Workspace Defaults" section and the "placeholder UI" footer note. No functionality lost — none was wired up.

---

## Medium — Duplication

- [x] **Extract `requireSession()` / `requireAdmin()` to a shared module** (`lib/action-helpers.ts`)
  Created `lib/action-helpers.ts`. Removed local definitions from all 5 action files (`events/actions.ts`, `gifting/actions.ts`, `inventory/actions.ts`, `inventory/reservation-actions.ts`, `settings/user-actions.ts`). Also fixed the inline session check in `checkInventoryAvailability` to use `requireSession()`.

- [x] **Extract `getTodayStart()` to a shared module** (`lib/date-utils.ts`)
  Created `lib/date-utils.ts` with `getTodayStart`. Removed local definitions from `reservation-actions.ts`, `lib/notifications.ts`, and `reservations/page.tsx`.

- [x] **Use `getFirstName()` instead of inline `name.split(" ")[0]`**
  Replaced all 5 inline occurrences in `reservation-actions.ts` (×3) and `gifting/actions.ts` (×2) with `getFirstName(firstName ?? name, email)` from `lib/notifications`.

- [x] **Consolidate date formatters into `lib/date-utils.ts`**
  Added `formatLongDate`, `formatShortDate`, `formatAuditDate`, `formatDateRange` to `lib/date-utils.ts`. Removed local definitions from 3 detail clients, `notifications.ts`, `events/page.tsx`, and `PendingReservationsTable.tsx`. Note: `InventoryDetailClient` and `GiftDetailClient` used `formatLongDate` with `month: "short"` — correctly remapped to `formatAuditDate`.

- [x] **Move company theme data out of the events page** (`app/(app)/events/page.tsx:77`)
  Created `lib/company-themes.ts` with `CompanyColorTheme`, `COMPANY_COLOR_THEMES`, `COMPANY_THEME_OVERRIDES`, `COMPANY_CUSTOM_THEMES`, and `getCompanyTheme`. Removed all from `events/page.tsx`.

- [x] **Consolidate image upload UI into `InlineItemImageField`**
  Both `InventoryForm` and `GiftForm` now use `<InlineItemImageField>`. Removed 60+ lines of duplicated file-picker JSX from each. `InventoryForm` also migrated from its inline `uploadInventoryImage` to the shared `uploadManagedItemImage` from `lib/item-image-client`.

---

## Medium — Inconsistencies

- [x] **Replace `<a href>` with `<Link>` in form breadcrumbs** (`EventForm.tsx`, `GiftForm.tsx`, `InventoryForm.tsx`)
  All three form breadcrumbs converted to Next.js `<Link>` for client-side navigation.

- [x] **Standardize destructive action confirmation** (`InventoryReservationRowActions.tsx`, `GiftReservationRowActions.tsx`)
  Replaced all `window.confirm()` calls with two-step inline confirmation: first click arms the confirm state, second click executes, "No" button dismisses.

- [x] **Move `InventoryPageShell` to `components/`**
  Renamed to `PageShell`, moved to `components/PageShell.tsx`. All 4 importing pages updated (`events`, `gifting`, `inventory`, `reservations`). Old `InventoryPageShell.tsx` deleted.

- [x] **Resolve `checkInventoryAvailability` inline session check** (`reservation-actions.ts`)
  Updated to call `requireSession()` from `lib/action-helpers`.

- [x] **Standardize per-page `if (!session) return null` guards**
  Removed from `settings/page.tsx`, `reservations/page.tsx`, and `dashboard/page.tsx`. All session accesses updated to optional chaining consistent with other pages.

---

## Low — Unused Code (delete)

- [ ] **Delete `components/PageHeader.tsx`** — never imported anywhere; superseded by `TopBarContext`
- [ ] **Delete `components/Navbar.module.css`** — never imported; 368 lines of dead CSS
- [ ] **Delete `designs/` directory** — prototype file with `@ts-nocheck`, broken imports, and a `console.log`
- [ ] **Remove unused `Breadcrumbs` component** from `components/Breadcrumbs.tsx` — only the `Crumb` type is used; move the type inline or to a types file
- [x] **Remove or use `getFirstName` export** from `lib/notifications.ts` — now consumed by `reservation-actions.ts` and `gifting/actions.ts`
- [x] **Remove `formatShortDate` from `EventDetailClient`** — removed as part of date-utils consolidation

---

## Low — Sloppy / Minor

- [ ] **Fix double `getIncrementedQuantity` call** (`components/ReserveInventoryModal.tsx:394`)
  Called twice per click; store result in a local variable.

- [ ] **Rename private `InventoryIcon` in `Navbar.tsx`** — conflicts with the exported `InventoryIcon` in `MetadataIcons.tsx`; rename to `NavInventoryIcon`

- [ ] **Remove private `EditIcon` / `TrashIcon` redefinitions** (`InventoryReservationRowActions.tsx`, `ReserveInventoryModal.tsx`) — import from `DetailHeaderActions.tsx` instead

- [ ] **Add explanations to `eslint-disable-next-line react-hooks/exhaustive-deps`** — suppressed without comments in `InventoryDetailClient.tsx` and `EventForm.tsx`; document why the omission is intentional

- [ ] **Replace string-matching nav icon logic** (`components/Navbar.tsx:149`) — `isEventsIcon`, `isInventoryIcon` etc. derived by comparing class name strings. Replace with a declarative route→icon map.

- [ ] **Convert inline styles in settings users table to CSS classes** (`app/(app)/settings/users/page.tsx:50`)

- [ ] **Verify `inert` attribute React version compatibility** (`components/Navbar.tsx:116`) — `inert` is native in React 19+; if on React 18, replace with `aria-hidden` + `tabIndex={-1}`

- [ ] **Demo mode fail-closed guard** — verify `APP_MODE` defaults to `"production"` when not explicitly set; add a hard throw if the value is unrecognized

---

## Suggested New Files

| File | Purpose |
|------|---------|
| `lib/action-helpers.ts` | `requireSession`, `requireAdmin`, `getTodayStart` |
| `lib/date-utils.ts` | `formatShortDate`, `formatLongDate`, `formatDateRange`, `getTodayStart` |
| `lib/inventory-reservation-ui.ts` | Add `getInventoryReservationStatusVariant` (mirrors gift version) |
| `lib/company-themes.ts` | Move `COMPANY_THEME_OVERRIDES` / `COMPANY_CUSTOM_THEMES` out of `events/page.tsx` |
| `components/PageShell.tsx` | Rename/move `InventoryPageShell` for cross-feature use |