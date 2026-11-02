# Every command records its Activity

Muse wants to see every change anyone made, in one place, in plain words. Every command (ADR 0003) records one Activity entry in its own transaction: a sentence after the actor's name, saying what changed as it is now, with the records it names kept as they were then (their id, name and, for an item, whether it's Inventory or a Gift). `defineCommand` hands each command a `record` function and refuses to commit a command that doesn't call it exactly once, so a new command can't forget; a command that turned out to change nothing records null and writes no entry. Only changing your own name or profile colour records none (`activity: false`), since a profile isn't Muse's data. The daily automatic giveaway, the one command without an actor (ADR 0010), writes its entries by nobody.

We store the finished sentence rather than rebuilding it from History, Lines and the catalog because most changes (editing an Event, renaming a Client, inviting someone) leave no row behind that says what happened, and because a sentence written then keeps reading the same after renames and permanent deletions (ADR 0011). The Activity page links an Event or item only while it still exists.

## Consequences

- Activity began when it launched; nothing before it was backfilled.
- History stays the record of Stock and is unchanged; Activity is the record of every change, Stock ones included.
- Adding a command means writing its sentence, and its tests fail until it does.
