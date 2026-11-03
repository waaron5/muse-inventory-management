# Retire One-off Gifts; add Inventory and non-inventory separately

_Its keeping of One-off Gifts already made is replaced by [ADR 0015](0015-remove-one-off-gifts.md)._

No new One-off Gifts can be added to an Event. A gift bought for one Event goes into the catalog as a Gift, through a Purchased Adjustment, and is reserved like any other, so every gift Muse hands out is one it can find again in the catalog. Muse chose this to keep Gifts in one place: the hand-entered gift sat beside the catalog search in the same popup and was easy to reach for instead of it.

An Event's Gifts are now added only by searching the catalog. Its Inventory has two actions: **Add inventory** searches the catalog, and **Add non-inventory** enters a Borrowed Item by hand. "Non-inventory" is only the button's wording; the domain term stays Borrowed Item.

## Consequences

- The `addOneOffGift` command is removed. The `one-off-gift` Line kind stays, so One-off Gifts already made still show under their Event's Gifts, can have their count changed or be removed, print under "One-off Gifts", and are never Given Away from Stock.
- `docs/design-system.md`, `PRODUCT.md` and `CONTEXT.md` describe the two Inventory actions and the retired One-off Gift.
