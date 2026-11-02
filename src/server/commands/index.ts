import "server-only";
import { db } from "@/db";
import type { Actor } from "./define";
import { acknowledgeShortage } from "./acknowledge-shortage";
import { addBorrowedItem } from "./add-line";
import { adjustStock } from "./adjust-stock";
import { archiveItem, unarchiveItem } from "./archive-item";
import { cancelEvent, deleteEvent, reinstateEvent } from "./cancel-event";
import { changeReserved, removeLine } from "./change-line";
import { archiveClient, createClient, mergeClients, renameClient, setClientColour, unarchiveClient } from "./clients";
import { deleteClient, deleteItem, deleteLocation } from "./delete-record";
import { createEvent } from "./create-event";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { editEvent } from "./edit-event";
import { editGift, editInventoryItem } from "./edit-inventory-item";
import { giveAwayEnded } from "./give-away";
import { renameLocation } from "./locations";
import { addPastUsePhoto, deletePastUsePhoto, setItemPhoto } from "./photos";
import { reserve } from "./reserve";
import { setOwnName } from "./set-own-name";
import { setOwnAvatarColour } from "./set-own-avatar-colour";
import { createCategory, renameCategory, deleteCategory } from "./categories";
import { changeRole, deactivateUser, deleteUser, inviteUser, reactivateUser } from "./users";

export type { Actor, Role } from "./define";
export { CommandError } from "../errors";

/** The commands, bound to the app's database. Server Actions call exactly one. */
export const commands = {
  createCategory: (actor: Actor, input: Parameters<typeof createCategory>[2]) => createCategory(db, actor, input),
  renameCategory: (actor: Actor, input: Parameters<typeof renameCategory>[2]) => renameCategory(db, actor, input),
  deleteCategory: (actor: Actor, input: Parameters<typeof deleteCategory>[2]) => deleteCategory(db, actor, input),
  createClient: (actor: Actor, input: Parameters<typeof createClient>[2]) => createClient(db, actor, input),
  setClientColour: (actor: Actor, input: Parameters<typeof setClientColour>[2]) => setClientColour(db, actor, input),
  deleteClient: (actor: Actor, input: Parameters<typeof deleteClient>[2]) => deleteClient(db, actor, input),
  deleteItem: (actor: Actor, input: Parameters<typeof deleteItem>[2]) => deleteItem(db, actor, input),
  deleteLocation: (actor: Actor, input: Parameters<typeof deleteLocation>[2]) => deleteLocation(db, actor, input),
  deleteUser: (actor: Actor, input: Parameters<typeof deleteUser>[2]) => deleteUser(db, actor, input),
  acknowledgeShortage: (actor: Actor, input: Parameters<typeof acknowledgeShortage>[2]) =>
    acknowledgeShortage(db, actor, input),
  addBorrowedItem: (actor: Actor, input: Parameters<typeof addBorrowedItem>[2]) =>
    addBorrowedItem(db, actor, input),
  addPastUsePhoto: (actor: Actor, input: Parameters<typeof addPastUsePhoto>[2]) =>
    addPastUsePhoto(db, actor, input),
  adjustStock: (actor: Actor, input: Parameters<typeof adjustStock>[2]) => adjustStock(db, actor, input),
  archiveClient: (actor: Actor, input: Parameters<typeof archiveClient>[2]) => archiveClient(db, actor, input),
  archiveItem: (actor: Actor, input: Parameters<typeof archiveItem>[2]) => archiveItem(db, actor, input),
  cancelEvent: (actor: Actor, input: Parameters<typeof cancelEvent>[2]) => cancelEvent(db, actor, input),
  changeRole: (actor: Actor, input: Parameters<typeof changeRole>[2]) => changeRole(db, actor, input),
  changeReserved: (actor: Actor, input: Parameters<typeof changeReserved>[2]) =>
    changeReserved(db, actor, input),
  createEvent: (actor: Actor, input: Parameters<typeof createEvent>[2]) => createEvent(db, actor, input),
  createGift: (actor: Actor, input: Parameters<typeof createGift>[2]) => createGift(db, actor, input),
  createInventoryItem: (actor: Actor, input: Parameters<typeof createInventoryItem>[2]) =>
    createInventoryItem(db, actor, input),
  createLocation: (actor: Actor, input: Parameters<typeof createLocation>[2]) =>
    createLocation(db, actor, input),
  deactivateUser: (actor: Actor, input: Parameters<typeof deactivateUser>[2]) =>
    deactivateUser(db, actor, input),
  deleteEvent: (actor: Actor, input: Parameters<typeof deleteEvent>[2]) => deleteEvent(db, actor, input),
  deletePastUsePhoto: (actor: Actor, input: Parameters<typeof deletePastUsePhoto>[2]) =>
    deletePastUsePhoto(db, actor, input),
  editEvent: (actor: Actor, input: Parameters<typeof editEvent>[2]) => editEvent(db, actor, input),
  editGift: (actor: Actor, input: Parameters<typeof editGift>[2]) => editGift(db, actor, input),
  editInventoryItem: (actor: Actor, input: Parameters<typeof editInventoryItem>[2]) =>
    editInventoryItem(db, actor, input),
  // Run by Vercel Cron, as nobody.
  giveAwayEnded: () => giveAwayEnded(db),
  inviteUser: (actor: Actor, input: Parameters<typeof inviteUser>[2]) => inviteUser(db, actor, input),
  mergeClients: (actor: Actor, input: Parameters<typeof mergeClients>[2]) => mergeClients(db, actor, input),
  reactivateUser: (actor: Actor, input: Parameters<typeof reactivateUser>[2]) =>
    reactivateUser(db, actor, input),
  reinstateEvent: (actor: Actor, input: Parameters<typeof reinstateEvent>[2]) =>
    reinstateEvent(db, actor, input),
  removeLine: (actor: Actor, input: Parameters<typeof removeLine>[2]) => removeLine(db, actor, input),
  renameClient: (actor: Actor, input: Parameters<typeof renameClient>[2]) => renameClient(db, actor, input),
  renameLocation: (actor: Actor, input: Parameters<typeof renameLocation>[2]) =>
    renameLocation(db, actor, input),
  reserve: (actor: Actor, input: Parameters<typeof reserve>[2]) => reserve(db, actor, input),
  setItemPhoto: (actor: Actor, input: Parameters<typeof setItemPhoto>[2]) => setItemPhoto(db, actor, input),
  setOwnName: (actor: Actor, input: Parameters<typeof setOwnName>[2]) =>
    setOwnName(db, actor, input),
  setOwnAvatarColour: (actor: Actor, input: Parameters<typeof setOwnAvatarColour>[2]) =>
    setOwnAvatarColour(db, actor, input),
  unarchiveClient: (actor: Actor, input: Parameters<typeof unarchiveClient>[2]) =>
    unarchiveClient(db, actor, input),
  unarchiveItem: (actor: Actor, input: Parameters<typeof unarchiveItem>[2]) => unarchiveItem(db, actor, input),
};
