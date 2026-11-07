import "server-only";
import { db } from "@/db";
import { type ActivityFilters, loadActivityScreen } from "./activity";
import { loadAiConnections } from "./ai-connections";
import { loadClientsScreen } from "./clients";
import { loadCategoriesScreen } from "./categories";
import { loadEventScreen } from "./event";
import { type EventsFilters, loadEventsScreen } from "./events";
import { loadGiftsScreen } from "./gifts";
import { type InventoryFilters, loadInventoryScreen } from "./inventory";
import { loadGiftScreen, loadItemScreen } from "./item";
import { loadLocationsScreen } from "./locations";
import { loadPrintScreen, type PrintOrder } from "./print";
import { loadSearch } from "./search";
import { loadAvatarColour, loadProfileColour, loadUsersScreen } from "./users";

export type { ActivityFilters, ActivityShown } from "./activity";
export type { AiConnectionShown } from "./ai-connections";
export { ACTIVITY_PAGE } from "./activity";
export type { EventLinesData } from "./event";
export type { EventsFilters, EventsTab } from "./events";
export type { InventoryFilters } from "./inventory";
export type { PrintOrder } from "./print";
export type { SearchResults } from "./search";

/** The screen loaders, bound to the app's database. */
export const loaders = {
  activity: (filters: ActivityFilters) => loadActivityScreen(db, filters),
  aiConnections: (userId: string) => loadAiConnections(db, userId),
  categories: () => loadCategoriesScreen(db),
  events: (filters: EventsFilters) => loadEventsScreen(db, filters),
  event: (id: string) => loadEventScreen(db, id),
  print: (id: string, order: PrintOrder) => loadPrintScreen(db, id, order),
  inventory: (filters: InventoryFilters) => loadInventoryScreen(db, filters),
  item: (id: string) => loadItemScreen(db, id),
  gifts: (filters: InventoryFilters) => loadGiftsScreen(db, filters),
  gift: (id: string) => loadGiftScreen(db, id),
  users: () => loadUsersScreen(db),
  avatarColour: (id: string) => loadAvatarColour(db, id),
  profileColour: (id: string) => loadProfileColour(db, id),
  clients: () => loadClientsScreen(db),
  locations: () => loadLocationsScreen(db),
  search: (q: string) => loadSearch(db, q),
};
