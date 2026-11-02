# Plan and print: Gifts are Given Away automatically, and nothing is loaded or returned

_Amended by [ADR 0014](0014-one-location-per-item.md): giveaways take from, and leftovers go back to, the Gift's one Location._

Muse asked to see what an Event needs and print it, not to check gear off at the truck. So there is no Load, Return, Write-off, Out, Overdue or Complete. Stock never leaves its Location for an Event, Count is just Stock across every Location, and a Reservation stops holding when its Event's Hold Window ends. The Hold Window is the Event's own start and end dates, both days counting; there are no Out or Return Dates. The day after an Event ends, a daily Vercel Cron gives away each of its Gift Lines automatically: the Line's count, from the Location with the most Stock first, never more than is in Stock, recorded in History on the Event's last day by "Automatic" (no person). Each Line is given away once, so a missed run is caught up by the next, and an Event without dates never ends. Leftovers are fixed by anyone changing a past Gift Line's count, which writes a correcting entry putting the difference back where it was given away from (or gives more away). Inventory needs nothing after an Event: a loss or a move is an Adjustment or Transfer on the item. We chose this because Muse wants nothing to manage: check-offs were extra work nobody would do, and stock left Out by a skipped return made every count wrong.

This amends ADR 0001 (Stock never goes Out, so Count is Stock) and ADR 0002 (no Location is picked at load-out, and nothing Overdue holds on after its window), and supersedes ADR 0009 (there is no check-off to take offline).

## Considered Options

- **Keep load and return, make them optional**: the counts are only right if someone does them, and a half-done return leaves gear Out for ever.
- **Give Gifts away by hand**, with an "All given away" button: still a step someone has to remember after every Event.
- **Keep Out and Return Dates folded away**: extra fields nobody should have to think about (October 26).

## Consequences

- An Event can be cancelled only before it ends, and an Admin can delete only an Event in no History (a giveaway puts it there) that no Past-use Photo names.
- Borrowed Items are plain Lines (name, count, lender) and don't need the Event's dates. The Print list shows everything the Event needs: each item under the Locations holding it, the most first, and what there's no Stock for under Not in stock.
- The cron is the one change that isn't made by a person, so it isn't a `defineCommand`; it still writes its History in one transaction, and its route is guarded by `CRON_SECRET`, apart from the keep-warm route that never touches the database (ADR 0006).
- Loads, Returns and Write-offs recorded before this stay in History, readable on item pages; the schema keeps their kinds and checks.
