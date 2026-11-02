import { createCatalogItem } from "./create-inventory-item";

// Admins build the Gifts catalog as they build Inventory. Each size of a sized
// Gift is its own Gift.
export const createGift = createCatalogItem("gift", "createGift");
