# Allow permanent deletion while preserving historical snapshots

Admins may permanently delete Inventory Items, Gifts, Events, Clients, Locations and user accounts even when other records refer to them. Remove the live record while retaining historical names and counts and readable linked Event lines, rather than cascading deletion through business records or refusing deletion because history exists. Muse chose this to give the team control over its catalog without losing the explanation of past work and Stock changes.

Deleting a Location warns that its Stock will become Unassigned; it remains in Count and can be reassigned through Edit. Deleting an Event does not restore Gifts already Given Away. Existing role permissions remain, and at least one active Admin must remain.

This amends the deletion restrictions in ADRs 0001 and 0010 and the Location requirement for Stock in ADR 0004. Stock changes still retain their History and balanced counts. Historical references keep their original IDs without foreign keys to live records; commands validate and lock their targets, while immutable deletion snapshots supply missing names. An internal Unassigned balance bucket keeps stock and ledger entries consistent when a Location is removed.
