import { defineLoader } from "./define";
import { type InventoryFilters, loadCatalog } from "./inventory";

// The Gifts list, filtered as the Inventory list is.
export const loadGiftsScreen = defineLoader("gifts", (db, filters: InventoryFilters) =>
  loadCatalog(db, "gift", filters),
);
