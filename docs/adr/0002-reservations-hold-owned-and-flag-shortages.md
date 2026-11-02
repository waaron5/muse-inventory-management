# Reservations hold against Owned, not a Location, and Shortages are flagged rather than blocked

_Amended by [ADR 0010](0010-plan-and-print-with-automatic-giveaways.md): there is no load-out, and nothing holds on after its Hold Window._

A Reservation is just an Inventory Item and a count on an Event; it names no Location, and availability is checked against Owned (on the busiest day of the Event's Hold Window), not against any one Location's Stock. Which Location the Stock leaves from is recorded at load-out. A Reservation that over-commits an item is saved anyway, and every competing Event shows a Shortage until the numbers resolve it or an Admin acknowledges it. We chose this because Muse "just wants it to work": the real fixes for a clash (borrowing, buying, a same-day handoff between trucks) happen outside the app, and a hard wall would push people into faking counts.

## Considered Options

- **Reserve from a specific Location**: availability per Location, so every Transfer could silently break future Reservations, and staff would have to know which shelf to plan from weeks ahead. Rejected despite fitting ADR 0001's per-Location Stock more literally.
- **Block over-commitment**: keeps the numbers clean, but users would shrink counts or invent stock to get past it, which is worse than a visible Shortage.
- **Sum every overlapping hold** (v1's availability math): overstates shortages when competing Events don't overlap each other; we take the peak day instead.

## Consequences

- Available can be negative in practice; every screen that shows availability must be able to show "short by N".
- Load-out check-off must record a source Location per line (defaulting to the Location with the most Stock), and the Pull List should hint where Stock currently sits.
- Stock still Out after its Event's Hold Window stays held indefinitely (the Event is Overdue), so availability never counts on gear that hasn't come back.
