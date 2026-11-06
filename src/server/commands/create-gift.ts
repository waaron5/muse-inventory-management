import { createCatalogItem } from "./create-inventory-item";

// Admins build the Gifts catalog as they build Inventory. Each size of a sized
// Gift is its own Gift.
export const createGift = createCatalogItem(
  "gift",
  "createGift",
  "Adds a Gift to the catalog: a name, with an optional SKU, Unit Price in dollars (\"24.99\"), Description, and where it's kept and how many (startingStock). Each size of a sized Gift is its own Gift. Its photo is added in the app. Admins only. For a list, call this once for each, then say which went through and which didn't.",
);
