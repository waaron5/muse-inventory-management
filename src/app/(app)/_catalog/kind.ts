// Inventory Items and Gifts share their screens; this is where they differ.
export const catalogs = {
  inventory: { path: "/inventory", title: "Inventory", none: "No Inventory Items yet.", noun: "Item" },
  gift: { path: "/gifts", title: "Gifts", none: "No Gifts yet.", noun: "Gift" },
} as const;

export type Kind = keyof typeof catalogs;
