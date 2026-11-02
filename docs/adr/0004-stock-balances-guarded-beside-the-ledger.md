# Stock is stored as guarded balance rows beside the append-only History

_Amended by [ADR 0014](0014-one-location-per-item.md): each item has exactly one balance, at its Location._

Each Location's Stock of each Inventory Item or Gift is a balance row with `CHECK (qty >= 0)`, updated in the same transaction as the History entries that explain the change. The command locks the balance rows it touches, so two people loading the same item at once are serialized, and the second sees an error instead of driving Stock negative. A test asserts that every balance equals the sum of its History entries. This settles the choice that ADR 0001 left to the architecture: the balance makes "never negative" a database guarantee and keeps loaders cheap, and History remains the record that explains every number.

## Considered Options

- **History only, Stock as a sum**: one source of truth, but "never negative" under concurrent Loads still needs explicit locking, and every screen that shows Stock has to aggregate the ledger.
- **Balances with History as a loose log** (v1's shape): the two drift apart, which is the problem ADR 0001 exists to prevent.

## Consequences

- A command that changes Stock without writing History, or the reverse, is a bug the balance-versus-ledger test catches.
- Count is the sum of Stock across every Location (ADR 0010), never stored as an editable number.
