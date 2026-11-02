import { z } from "zod";

// The catalog fields an Admin types for an item, shared by create and edit.

// Blank optional text is "not given", never an empty string.
export const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .optional()
    .transform((value) => value || null);

// Typed as a person would: "24.99", "$1,250". Stored in cents.
const unitPrice = z
  .string()
  .trim()
  .optional()
  .transform((value) => value?.replace(/^\$/, "").replaceAll(",", "") || null)
  .refine((value) => value === null || /^\d+(\.\d{1,2})?$/.test(value), {
    message: "Enter the Unit Price as dollars and cents, like 24.99.",
  })
  .transform((value) => (value === null ? null : Math.round(Number(value) * 100)));

export const itemFields = {
  name: z.string().trim().min(1, "Give the item a name.").max(200, "Keep the name under 200 characters."),
  sku: optionalText(100, "Keep the SKU under 100 characters."),
  unitPrice,
  description: optionalText(5000, "Keep the Description under 5,000 characters."),
};
