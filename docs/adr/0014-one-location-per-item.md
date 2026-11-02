# One Location per item

_Amends [ADR 0001](0001-stock-is-physical-with-append-only-history.md), [ADR 0004](0004-stock-balances-guarded-beside-the-ledger.md) and [ADR 0010](0010-plan-and-print-with-automatic-giveaways.md)._

Muse doesn't expect an item's Stock ever to be split between Locations. They want each Inventory Item and Gift to sit at one Location holding all of its Count, changed like any other field on the item. So every item has exactly one Stock balance, guarded by a unique index on `stock.item_id`, and its Location is where that balance is. Adding an item asks for its Location and Count. Editing it can change either: a new Count is a Recount, as before, and a new Location moves the whole balance there, recorded in History as a Transfer of all of it. An item added with no Location sits Unassigned with none. Deleting a Location still leaves its items Unassigned. Moving part of an item's Stock is gone, along with `transferStock`.

We kept the balance beside the append-only History (ADR 0004) rather than a column on the item, so "never negative", the ledger test and every History entry stay exactly as they were, and a move still explains itself in History.

## Considered Options

- **A Location column on the item, Count as a column beside it**: simpler to read, but it drops the guarded balance and every command and loader that already works through it.
- **Keep splits, default the form to one Location**: still lets Stock drift into two places, which Muse said never happens and don't want to manage.

## Consequences

- Automatic giveaways and extra Gifts given away take from the item's Location. Leftovers put back go to where the item is now, not where they were given away from.
- An Adjustment always applies at the item's Location; it no longer names one.
- The Print list shows each item under its Location.
- The migration stops if any item still holds Stock at two Locations, rather than guessing which one is right. Production had none.
