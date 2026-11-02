# Remove One-off Gifts

_Replaces the keeping of One-off Gifts already made in [ADR 0012](0012-retire-one-off-gifts.md)._

ADR 0012 stopped new One-off Gifts but kept the Line kind so existing ones would still show, change and print. Muse has moved on from them, so we removed them altogether rather than carry a Line kind, a `note` column and a Print list group for records nothing can add. A gift bought for one Event stays a catalog Gift, as ADR 0012 decided.

## Consequences

- The `one-off-gift` Line kind, the Line's `note` column and the Print list's "One-off Gifts" group are gone, so a Line is a Reservation or a Borrowed Item.
- The migration stops rather than deletes if a One-off Gift Line still exists, so none can be lost silently; that deployment then fails until someone decides what happens to it.
