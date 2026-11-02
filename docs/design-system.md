# Design system

One look for the whole app, modelled on Dropbox and Google's file browsers. Settled in Visual design system and revised in the Clients and Events review.

**A style note is never about one element.** If the active nav tab should be grey, every active thing (chips, dropdown options, tabs) uses the same grey. Change the token or the shared part, never one call site.

## Colour

Every colour is a token in `src/app/globals.css`. Components never use a hex value or Tailwind's palette, so Dark mode is only a second value on each token: `light-dark(light, dark)`. `src/design-system.test.ts` checks this, that every token and Client colour has a dark value, and that text and status pills meet WCAG AA in both themes, including each Client's name in its own `--client-ink`.

**Appearance** (the account menu) is Light, Dark or System, saved per device in `lib/appearance`. System follows the OS live; Light or Dark goes on `<html>` as `data-theme` before first paint. Muse cyan and the main button are the same in both themes. Paper (the Print list's sheets) stays light, and printing is always light.

| Role | Token | Use |
| --- | --- | --- |
| Main action | `bg-main` / `hover:bg-main-hover`, `text-on-main` | Muse cyan with white on top. Page, form and section actions. |
| At rest | `bg-fill` | Chips, skeletons, a plain badge ("Archived") |
| Row hover | `bg-row-hover` → `bg-fill` | Rows use the same grey as resting filter bubbles, in both themes |
| Hovered | `bg-hover` | Nav tabs, menu items, chips and secondary buttons |
| Selected | `bg-selected` | The active nav tab, an active chip, the chosen option in a menu. A step darker than hover. |
| Warning | `bg-warning-surface`, `text-warning` | Asking for more than is Available, and "Short by N" |
| Lines | `border-line` | Hairlines everywhere, including every input's border, which turns `border-ink` on hover |
| Text | `text-ink`, `text-subtle` | Active icons are ink, never cyan |
| Paper | `bg-paper`, `text-paper-ink`, `text-paper-subtle`, `border-paper-line` | The Print list's sheets only. Paper stays white in Dark mode. |
| Links and focus | `text-cyan-ink`, the focus ring | |

The greys are cool, from Dropbox's 2023 theme: the sidebar is `bg-subtle` (its subtle background), and the neutral ladder `bg-fill` → `bg-hover` → `bg-selected` flattens its blue-grey surfaces into opaque steps. There are no other greys. Rows use `bg-row-hover`, an alias of `bg-fill`, for hover and touch feedback. Other hover, press, highlight or open states use `bg-hover`, `bg-selected` or `bg-main-hover`. Destructive detail icons use `bg-alert-surface` with `text-alert` on hover. Underline tabs mark the current one with an ink underline. Text buttons, inactive tabs, sortable column headings and the Event row's Inventory and Gifts counts take a solid underline on hover, as `TextButton` does; underlines never animate.

Cyan appears on action buttons, the logo's "e" and the focus ring. User avatars use their own persistent colour. My profile offers six distinct colour choices, with a check icon that appears only for an unsaved selection; a saved choice appears for every viewer. Existing automatic identities and saved colours stay stable.

Clients have a saved colour from the six-colour Client palette: rose, orange, yellow, green, blue and violet. Creation saves an automatic initial choice; renaming keeps it. Everyone can change it from the Client's Settings menu through a six-swatch sheet with Cancel/Save. A dot in its Settings row shows the saved colour. Event stripes and detail tags use that colour; Client names beneath Event names use its muted `--client-ink`, with AA contrast in both themes.

## Shared parts

Use these rather than restyling by hand:

- `components/button.tsx`:
  - `FormActions`: a right-aligned form footer with Cancel before the primary action. Shared by add, save and confirmation forms. Sign-in instead has one full-width main button under its field.
  - `MainButton`: requires an `icon`.
  - `TextButton`: an icon and text without a background, for quiet section actions.
  - `SecondaryButton`
  - `ButtonLink`: `look="main"` requires an `icon`.
  - `buttonClass`
- `components/admin-action.tsx`: a page action only an Admin may take.
- `components/ask-an-admin.tsx`: what a User sees instead of an Admin's action, disabled with "Ask an Admin". `AdminAction` and Admin-only form buttons both use it.
- `components/thumb.tsx`:
  - `ItemThumb` (the Item Photo, or a bare box icon) leads every catalog row. `EventThumb` (a bare calendar icon) marks an Event where Events mix with items: search results and a Shortage's other Events. The Events list leaves it out, since every row there is an Event. Icons have no square behind them.
  - `Photo`: any stored photo, at its small or full size. Photos are private, so never through `next/image`.
- `components/confirm.tsx`: `Confirm`, a confirming sheet's words, any fields it asks for, and its one main button (Cancel event, Deactivate, Merge).
- `components/archive.tsx`: `ArchiveMenuItem` and `ArchiveSheet`, a "⋯" menu's Archive or Unarchive and the sheet that does it (an item or a Client). Locations have Rename and Delete, with no archival state.
- `components/rename-form.tsx`: `RenameForm`, a rename sheet's one field and its Save (a Client, a Location).
- `components/row-list.tsx`: `RowList` and `Row`, the plain lists of the account menu's screens (Users, Clients, Locations), with `RowListSkeleton`. `RowText` shares their title/subtitle rhythm with Events, Inventory and Gifts: body-size medium titles, 14px subtitles, both with 24px line height. A row no longer in use is dimmed, with a plain badge ("Archived", "Deactivated").
- `components/avatar.tsx`: `Avatar`, a person's initials on their persistent colour. The automatic colour identity survives name changes; a profile preference can override it. Both use the same light and dark surfaces. There are no profile photos.
- `components/avatar-colour-setting.tsx`: `AvatarColourSetting`, the profile's six named colour swatches and conditional confirm icon. Its fieldset has an accessible name without a visible heading.
- `components/warning-panel.tsx`: `WarningPanel`, a warning in a block of its own.
- `components/badge.tsx`: `Badge`, a row's warning in a word or two ("Short by 2"), at the row's end. `tone="plain"` is a state rather than a warning ("Archived", "Deactivated").
- `components/form.tsx`:
  - `Field`, `Select`, `TextArea`, `fieldClass`: hairline border, with our own chevron on `Select`.
  - `DayField`: "Day it happened" on every Stock change, today unless it's recorded after the fact.
  - `FormError`: a refusal, beside the form that asked.
  - `failsInline` (a form's action) and `inlineFailure` (any other): a single action that fails says "Something went wrong. Try again." beside it, never the error page.
- `server/flash.ts` and `components/toaster.tsx`: snackbars. A Server Action calls `flash("Changes saved")` once its command has committed, and the next screen shows it: an ink pill (inverted in dark) with a check, bottom centre, for about 3 seconds, shown once. Every change confirms this way. A refused command shows its error, never a snackbar.
- `lib/back-to.ts`: an edit page opened with `?back=<path>` (from a row's "⋯") goes back there on Save and Cancel; otherwise it goes back to the page itself. Only a path in this app counts.
- `components/error-screen.tsx`: `ErrorScreen`, the full-page error: just "Something went wrong.", with Try again, Go back and Report this.
- `components/bug-report.tsx`: `BugReportSheet`, Report a bug from the account menu, or Report this from the error page with its error attached.
- `components/filter-chip.tsx`: filters that live in the URL.
  - `ToggleChip`
  - `SelectChip`: "Client" unset, "Client: Acme ×" set.
  - `DatesChip`: a run of days, "Available" unset, "Available: Nov 12 – Nov 14 ×" set.
  - `MonthChip`: twelve directly selectable months and an optional year selector. Automatic years mean the current/next occurrence on Upcoming, current/most recent on Past; tab changes recalculate automatic years and preserve explicitly chosen years. The Events calendar month and year, "Month" unset, "Month: November 2026 ×" set. Includes Events overlapping any day in that month; keeps Client and tab selections in the URL.
- `components/menu.tsx`: every dropdown menu. Its items show the pointer cursor, as buttons do (`globals.css`).
  - `MenuContent`
  - `MenuSeparator`: a hairline between a menu's groups of like items (the account menu's screens, Appearance, and actions).
  - `MenuItem`: takes `selected`, and a `hint` saying why it's disabled: "Ask an Admin" for an Admin's action, as `AskAnAdmin` does for a button.
  - `MoreTrigger`: the borderless "⋯" at a row's end, with only a neutral background on hover and while open. Detail cards show direct Edit, Cancel/Reinstate, Archive/Unarchive and Delete icons as applicable: no borders, neutral hover background, red for Archive/Delete. With `onRow` it shows only while its `group/row` is hovered where a mouse can hover, and always on phone and touch.
  - `menuIcon`: a menu item's icon.
  - `floating`: the panel a menu or a chip's popover floats in.
- `components/appearance.tsx`: `AppearancePicker`, the account menu's Appearance row: its name, then Light, Dark and System as small icons at its end.
- `components/global-search.tsx`: the one search, across Events, Inventory and Gifts (Archived items left out).
  - `GlobalSearch`: the 320px field at the right of the three main lists' `TopRow` from 800px, reading "Search", with its results dropdown. `/` or ⌘K focuses it; nothing on screen says so.
  - `SearchButton`: on phone, the top bar's search icon on the three main lists, opening search in a sheet. Secondary pages have no search control.
- `components/search-field.tsx`: `SearchInput`, the search box itself, for global search, a picker's and a Settings card's.
- `components/view-more.tsx`: `ViewMoreLink` and `ViewMoreButton`, the end of a list cut short: a secondary button, its words, then a `ChevronDown`. Activity's "View more" loads the next page in place; a Settings card's "View N more" shows the rest of its rows.
- `components/page-header.tsx`:
  - `TopRow`: the first row of every page. The way back on the left, then the page's main action on the right. Search appears on the three main lists only.
  - `BackLink`: a detail or form page's way back, in its `TopRow`: "‹ Events", "‹ BRL Cove 26".
  - `PageTitle`
  - `PageHeader`: forms and detail pages.
  - `ListHeader`: list pages, a `TopRow` with the main action and the title below it.
- `components/list-page.tsx`: `ListPage` gives the three main lists their viewport layout; `ListScrollArea` keeps rows in a named, keyboard-scrollable region with sticky column headings.
- `components/linked-row.tsx`: `LinkedRow`, a desktop table row that opens its page when clicked anywhere but its own controls; its name stays the real link. Never stretch a link over a `<tr>` with `position: relative`: Safari before 2026 ignores it, so every row's link covers the page and the last row's wins. Phone rows are `<li>`s, where a stretched link is fine.
- `components/hover-label.tsx`: `HoverLabel`, a compact inverted label below a control with a small pointer. Appears after 250ms of hover, or immediately on keyboard focus, with a short fade and 3px slide. Team avatars show the person's name; the compact Invite control says "Invite". With `tap`, tapping also shows it, for a bubble that does nothing else: a Line's added-by bubble ("Added by Aaron · Oct 28") sits between the Line's name and its count, on the Event page and in its row's panel, never on the Print list.
- `components/page-column.tsx`: `PageColumn` centres secondary pages in a bordered panel beside the sidebar from 800px, with shared form, detail, compact and print widths. The `TopRow` stays outside it.
- `components/shell/nav.tsx`: the sections. The current one's icon is filled ink, the rest outlined in `text-subtle`. These three icons are Phosphor's, since Lucide has no filled icons; every other icon is Lucide.

Main buttons are worded **Add …**, never "New …": Add Event, Add Item, Add Gift, Add Location. A person is the exception: they're **Invite**d. Their icons:

| Action | Icon |
| --- | --- |
| Add | `Plus` |
| Reserve | `CalendarPlus` |
| Save | `Check` |
| Acknowledge | `Check` |
| Move | `ArrowRightLeft` |
| Cancel event | `CalendarX` |
| Reinstate event | `CalendarCheck` |
| Delete (an Event, a Past-use Photo) | `Trash2` |
| Edit, Rename | `Pencil` |
| Merge (a Client) | `Merge` |
| Archive | `Archive` |
| Unarchive | `ArchiveRestore` |
| Print (the Print list) | `Printer` |
| Invite | `UserPlus` |
| Make Admin, Make User | `UserCog` |
| Deactivate | `UserX` |
| Reactivate | `UserCheck` |
| Sign in (both steps) | `LogIn` |
| Continue | `ArrowRight` |
| Send (a bug report) | `Send` |
| Try again (the error page) | `RotateCw` |

Event Inventory/Gifts use `TextButton` below their headings: a plus icon and text, without a background. Inventory stacks “Add inventory”, which opens a catalog search picker, above “Add non-inventory”, which opens the Borrowed Item form (name and count required, lender optional). Gifts has one, “Add gift”, which opens a catalog search picker. Other section actions, including Reserve for an event and Add photo, use the cyan main button. Secondary buttons remain text only except Upload screenshot, which carries an upload icon. Remove redundant explanatory and empty-state prose; keep labels, errors and destructive warnings.

Item and Gift forms label initial stock as **Count**, under a single **Location** dropdown; Locations are added in Settings. Unit Price keeps a subtle "$" fixed ahead of what's typed, and takes only digits and one decimal point with up to two places. Their photo picker is a bordered, clickable photo-icon tile (or the chosen photo), without a visible "Item Photo" label or separate Choose photo button; adding a Past-use Photo uses the same tile, and its sheet's Add photo carries `Check`.

Inventory Item add and edit forms have a required **Category** dropdown below Name, with "Select a category" until chosen. Inventory has a **Category** filter using the shared `SelectChip`, including Unassigned; it combines with Location, Available and Archived. Item details show the current Category or Unassigned. Gifts have no Category.

Unknown Unit Prices display as **$-**; an unset price field stays blank. Count is prominent with a small per-Location breakdown, rather than a separate stock table. Move and Adjust count buttons are hidden: Admins edit compact count steppers through Edit, one for single-location Stock and per-Location when split. Saves record Recount Adjustments and reject stale counts. Stock orphaned by Location deletion is Unassigned and stays counted.

## Motion

Small controls use the shared motion tokens in `globals.css`: 150ms for hover feedback, 110ms to fade a menu in, and 70ms to fade it out. Productive easing settles quickly, without bounce or delay.

- Main Add buttons enlarge their plus icon from 100% at rest to 120% on hover or keyboard focus. The button and label stay still; disabled buttons stay still too.
- The account row's chevrons each move 3px apart on hover, keyboard focus and while its menu is open.
- `MenuContent` fades on open and close, including the account menu. Closing content stops accepting pointer input immediately.
- Hover motion requires a fine pointer that supports hover. Reduced motion disables these animations and transitions.

The research and source links are in [Interface motion](research/interface-motion.md).

## Layout

**From 800px** there is a sidebar: a 72px rail, or 240px from 1024px. It never moves: the page doesn't bounce past its top or end there. Phones keep their native bounce.

- **Content** has 32px outer margins beside the sidebar. Only the three main lists (Events, Inventory and Gifts) fill that width. Every other page's readable column is centred within that space, with its text left-aligned.
- **The top row** (`TopRow`) starts every page, 44px tall at the same top as the sidebar's logo row, so the logo lines up with it. Its left holds a detail or form page's way back, and is empty on a list page. Its right holds the main action, preceded by global search on Events, Inventory and Gifts only.
- **Main list pages:** the title comes below the top row, then the chips, the underline tabs, and the table. A borderless gear icon button sits right after the title, as in Dropbox, with a hover label; on hover only its icon darkens, with no background; it links to the page's section of Settings (Events → Clients, Inventory → Locations and Categories, Gifts → Locations). `ListHeader` requires it, so every main list page has one.
- **Events, Inventory and Gifts:** the shell fills the viewport. Titles, actions, filters and tabs stay in place; only the rows scroll, with sticky column headings. Phone rows use the same scroll area. The area is named and keyboard-focusable. Detail and form pages keep document scrolling; printing keeps its full page layout.
- **Main list right spacing:** rows leave an extra 32px before the scrollbar on desktop (64px total from the content edge), and 16px on phone. This gutter stays present even without a scrollbar.
- **Centred secondary pages** use `PageColumn`: new and edit forms have a 560px maximum, Event/Inventory Item/Gift details, Settings cards and Activity have a 760px maximum. Titles, fields, photos, sections and lists share their page's column; loading placeholders use the same layout.
- **Every centred column has a border:** a hairline `border-line` outline, `rounded-lg` corners and 32px padding, matching the main pages' outer spacing, without a shadow. The maximum widths include that border and padding. The full-width top row and the three main lists sit outside these panels.
- **Sign-in and the first-sign-in name prompt** sit in the same bordered column (`PageColumn`, 480px compact), with the centred logo inside the border above the form, and no shell.
- **The Print list's screen view** uses a centred 960px maximum for its controls and paper preview. Printing removes the column's maximum width, margins, border, corners and padding so US Letter sheets still start at the page's top left at full size.
- **The top row stays full width**, outside every centred column: the way back at the left, search and the page's main action at the right. Users' Invite, Locations' Add Location and the Print list's Print action sit here on desktop and remain beside their titles on phone.
- **Settings** is one page with an overarching Settings heading at the content's left edge, below the full-width top row and above the navigation and cards. From 1024px the heading stays fixed with the navigation while the cards scroll; below that it stays in normal document flow. Its five separate bordered cards are: My profile, Users, Clients, Locations and Categories. Preserve the existing row/form layouts. Invite, Add Client, Add Location and Add Category sit at the right of their card's heading row. Clients and Categories have a 224px search box just before that button (on phone, its own full-width row beneath the heading); it narrows the card's rows by name as you type, saying "Nothing matches." when none do. A card shows its first 8 rows, then `ViewMoreButton` ("View 12 more") for the rest.
- **The Settings menu**, from 1024px, is 160px wide at the content's left edge (the same 32px from the sidebar as every page's content), in a fixed column with the heading at 88px and menu at 150px from the viewport top, aligned with the top border of the My profile card at the start of the page. Its viewport position stays unchanged throughout page scrolling; a short viewport scrolls the menu internally. The cards stay centred on the page while there's room beside the menu, then take the space to its right. It lists the five cards with 20px Lucide icons (UserRound, UsersRound, Building2, MapPin and Shapes), 12px icon/text gaps and the sidebar's row spacing. Icons are subtle at rest and ink for the current card (the card in view is `bg-selected`), and a link scrolls to its card in 320ms with ease-out, instantly under reduced motion, putting its `#section` in the URL. Below 1024px there is no menu. Categories use the Locations pattern: anyone can add, Admins rename or delete, and deletion warns that assigned Inventory Items become Unassigned. In the Clients, Locations and Categories cards, each row's name is a link (`Row`'s `href`) with no hover or press styling: a Client's to Events filtered to it, a Location's and a Category's to Inventory filtered to it. Successful changes show the usual snackbar. The old collection URLs redirect to their Settings cards; the account menu has one Settings entry.
- **Your own user row** has no access or role menu. Admins can change another person's role, deactivate them or delete their account; commands enforce the same restriction.
- **Invitations** are Admin-only and accept `@museem.com` addresses. The invitation form says "Add any email that ends in @museem.com" and has no role selector. Everyone is invited as a User; an Admin can promote them afterward from Users settings. The command enforces the initial User role regardless of supplied form fields.
- **Team** on Events shows active workspace avatars beside the heading beneath Add Event, wrapping below on phone. The group opens Settings' Users card; Admins can invite through the compact adjacent control. This is membership, without online-status or Event-assignment indicators.
- **The account row** at the sidebar's foot has an up/down chevron in the full sidebar.

**Under 800px** is the phone top bar. Phones keep their own structure but share every style:

- Search is an icon in the top bar on the three main lists, opening a sheet. The top row shows only the way back, if there is one.
- The title and main action come first, with chips below.
- Lists are full-width rows.
- Desktop centring and panel borders do not change phone margins, content widths, title/action placement or navigation. Panels have no added border or padding on phone.

## Lists

- **Hairline table:** 64px catalog and Event rows (48px photos), growing to fit an Event's folded P&L line, with a `bg-row-hover` tint on hover. Row titles and subtitles follow Settings' `RowText` sizing and spacing, with 8px vertical padding. Each row ends in the "⋯" of its page's menu (`EventMenu`, `ItemMenu` with `back`), so Edit and Delete come back to the list.
- **One column flexes, facts stay fixed:** catalog Name takes a set width from 1000px, with Details taking the spare width. The Events list uses the same 240px Name width from 1000px then a fixed 176px Dates with the Venue beneath, with P&L taking the spare width so codes show in full, beside fixed 112px Inventory and Gifts counts. On narrower tables Name and P&L share the spare width. Counts, prices, badges and the "⋯" keep fixed widths, together at the row's end, as in Dropbox's file list. Nothing stretches the gaps between facts, and nothing leaves empty space before the "⋯".
- **Columns give way instead of scrolling:** the list region is a size container, and as it narrows, columns leave in a set order. Counts and badges never leave. Events: below 900px P&L folds into a third line beneath Name and Client. It stays as a collapsed column, so month headings and the open panel still span the row. Catalog: Details leaves below 1000px, Unit Price below 760px, a Gift's Reserved below 700px. Below 600px the table scrolls sideways inside its region.
- **Every row ends the same way:** its numbers, then a **Status** column for badges ("Short by 2", `Badge`; "None left", `tone="plain"`), then "⋯". Events is the exception: nearly all its rows would leave that column blank, so its badge ends the Client line instead, as on phone. Inventory's sits beneath Next reserved.
- **Row menus:** a 56px final column aligns the "⋯" control at the far right, inset 12px on desktop and 16px on phone, matching the leading inset.
- **Events columns:** Name (the Client beneath, any badge at that line's end) · Dates (the Venue beneath) · P&L · Inventory · Gifts · ⋯. P&L is the flexible text column, truncated only when the row runs out of room, with its full code available on hover; an unset code stays blank. The Client is plain 14px text in its colour's muted `--client-ink`, never a pill, so it reads as part of the Event's name; the Client stripe leads the row. Dates drop the year ("Nov 12 – 14", `formatRowDays`) and are left out under "No dates", where the Venue stands alone; the Venue is 14px and subtle, truncated with its full text on hover. Inventory and Gifts count Lines, as bare right-aligned numbers, subtle at 0, Borrowed Items under Inventory. Each count ends in an arrow and opens the same full-width panel under the row with the Event's Inventory and Gifts, editable as on its page (`EventRow`); both arrows turn together. Several can be open, none on phone. The badge is the Event's worst Shortage not yet acknowledged.
- **Inventory and Gifts columns:** Photo · Name (SKU beneath) · Details (the Description, one line) · Location · Unit Price · Count · then, on Inventory, Next reserved ("150 on Nov 3": the soonest Hold Window from today and what it holds, with the item's worst unacknowledged Shortage as a badge beneath), replaced by Available while the Available filter is on; on Gifts, Reserved (what Events still to be Given Away hold) and Status. A Gift with none left and no Shortage says "None left". Name, Unit Price and Count headings sort the list, ascending then descending, with the sort in the URL (`sort=count`, `sort=-count`) like the filters; an unknown Unit Price sorts last. An Item Photo opens large when clicked, with a magnifying-glass-plus hover/focus cue. Photo viewers have no Download action. Photos have a 12px desktop inset from the row's left edge. Detail photos are 128px, or 96px on narrow phones.
- Columns use consistent 12px gutters. Numeric columns align right, including their headings; a sorted numeric heading puts its arrow before the word so the word still lines up with the numbers. The Event tab border reserves the same right gutter and scrollbar space as the rows.
- **Phone rows:** an Event's name has the first line to itself; the Client (in its ink), the dates and any badge share the second. P&L, when set, has a third line, truncated with the full code on the Event's page. Venue is on the Event's page. A catalog row gives its end to the Count, with any badge beneath ("12 available" while the Available filter is on); its subtitle is Location · SKU, and Unit Price is on the item's page.
- **Events** sit under small month labels ("November 2026") taken from their first day.
  - Events without dates go last, under "No dates".
  - Upcoming runs soonest first; Past and Cancelled run most recent first.
