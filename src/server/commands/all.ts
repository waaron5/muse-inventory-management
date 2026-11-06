import { acknowledgeShortage } from "./acknowledge-shortage";
import { addBorrowedItem } from "./add-line";
import { adjustStock } from "./adjust-stock";
import { archiveItem, unarchiveItem } from "./archive-item";
import { cancelEvent, deleteEvent, reinstateEvent } from "./cancel-event";
import { createCategory, deleteCategory, renameCategory } from "./categories";
import { changeReserved, removeLine } from "./change-line";
import { archiveClient, createClient, mergeClients, renameClient, setClientColour, unarchiveClient } from "./clients";
import { createEvent } from "./create-event";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { deleteClient, deleteItem, deleteLocation } from "./delete-record";
import { editEvent } from "./edit-event";
import { editGift, editInventoryItem } from "./edit-inventory-item";
import { renameLocation } from "./locations";
import { addPastUsePhoto, deletePastUsePhoto, setItemPhoto } from "./photos";
import { reserve } from "./reserve";
import { setOwnAvatarColour } from "./set-own-avatar-colour";
import { setOwnName } from "./set-own-name";
import { changeRole, deactivateUser, deleteUser, inviteUser, reactivateUser } from "./users";

/**
 * Every command (ADR 0003), by name: the app's Server Actions call them, and
 * those an AI Connection may run are its tools (ADR 0017). A test fails when a
 * command is left out.
 */
export const allCommands = {
  acknowledgeShortage,
  addBorrowedItem,
  addPastUsePhoto,
  adjustStock,
  archiveClient,
  archiveItem,
  cancelEvent,
  changeReserved,
  changeRole,
  createCategory,
  createClient,
  createEvent,
  createGift,
  createInventoryItem,
  createLocation,
  deactivateUser,
  deleteCategory,
  deleteClient,
  deleteEvent,
  deleteItem,
  deleteLocation,
  deletePastUsePhoto,
  deleteUser,
  editEvent,
  editGift,
  editInventoryItem,
  inviteUser,
  mergeClients,
  reactivateUser,
  reinstateEvent,
  removeLine,
  renameCategory,
  renameClient,
  renameLocation,
  reserve,
  setClientColour,
  setItemPhoto,
  setOwnAvatarColour,
  setOwnName,
  unarchiveClient,
  unarchiveItem,
};
