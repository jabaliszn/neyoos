/**
 * B.18 Inventory / Stores — Zod validation.
 */
import { z } from "zod";

export const storeSchema = z.object({
  name: z.string().trim().min(2, "Name the store.").max(80),
  location: z.string().trim().max(120).optional(),
});
export type StoreInput = z.infer<typeof storeSchema>;

export const itemSchema = z.object({
  storeId: z.string().min(1, "Pick the store."),
  name: z.string().trim().min(2, "Name the item.").max(120),
  category: z.string().trim().min(2, "Category, e.g. Food / Uniform.").max(60),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  reorderLevel: z.coerce.number().min(0).max(1_000_000).default(0),
  sellPriceKes: z.coerce.number().int().min(1).max(1_000_000).optional(), // set = sellable to students
  trackExpiry: z.boolean().optional(),
});
export type ItemInput = z.infer<typeof itemSchema>;

export const stockInSchema = z.object({
  itemId: z.string().min(1),
  qty: z.coerce.number().positive("Quantity must be positive."),
  reason: z.string().trim().max(200).optional(),
  batchNo: z.string().trim().max(60).optional(), // for trackExpiry items
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type StockInInput = z.infer<typeof stockInSchema>;

export const stockOutSchema = z.object({
  itemId: z.string().min(1),
  qty: z.coerce.number().positive("Quantity must be positive."),
  reason: z.string().trim().min(2, "Why is stock leaving? e.g. Kitchen issue — lunch.").max(200),
});
export type StockOutInput = z.infer<typeof stockOutSchema>;

/** Sell to a student — billed straight onto their B.7 invoice (founder rule). */
export const sellSchema = z.object({
  itemId: z.string().min(1),
  studentId: z.string().min(1, "Pick the student."),
  qty: z.coerce.number().positive().max(1000),
});
export type SellInput = z.infer<typeof sellSchema>;

export const assetSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  location: z.string().trim().max(120).optional(),
  custodian: z.string().trim().max(100).optional(),
  acquiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  valueKes: z.coerce.number().int().min(0).max(100_000_000).default(0),
});
export type AssetInput = z.infer<typeof assetSchema>;
