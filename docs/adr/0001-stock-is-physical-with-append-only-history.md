# Stock is a physical count per Location, with append-only Stock History

_Amended by [ADR 0014](0014-one-location-per-item.md): each item's Stock sits at one Location._

_Amended by [ADR 0010](0010-plan-and-print-with-automatic-giveaways.md): nothing is loaded, so Stock never goes Out and Count is Stock._

Each Location's Stock counts what is physically there now: loading an Event's Pull List takes Stock out of its Location (it becomes Out), and returning puts it into whichever Location it lands in. Owned is always the sum of Stock plus Out, never stored as an editable number. Every change to Stock writes an entry to Stock History, which is never edited or deleted; mistakes are fixed with a correcting entry. We chose this so the app can answer "how many are in the Warehouse right now?" and "where did the missing ones go?", the questions Muse's spreadsheets and v1's single `quantity` field could not.

## Considered Options

- **Home count**: a Location keeps counting stock that is Out at an Event, and "out" shows only on the Pull List. Simpler, but no screen tells you what is actually on the shelf, and an item returned to a different Location means editing two counts by hand.
- **Editable totals with a loose audit log** (v1's shape): one quantity per item, edited in place. History can drift from the numbers, so missing stock cannot be traced.

## Consequences

- Load-out must know which Location each unit leaves from; when that is chosen (at reservation or at load-out) is the Reservation and availability rules ticket's call.
- Stock can never go negative; a mismatch found at the truck is fixed with an inline *Found* Adjustment rather than by allowing a negative count.
- Whether each Location's Stock is stored as a balance or recomputed from Stock History is an implementation choice left to the architecture ADRs.
