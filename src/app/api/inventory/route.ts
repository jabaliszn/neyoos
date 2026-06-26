/**
 * B.18 Inventory API.
 * GET  /api/inventory                       — stores + items + alerts + assets
 * GET  /api/inventory?movements=<itemId>    — item movement history
 * POST /api/inventory {action: addStore|addItem|in|out|sell|addAsset}
 * "sell" bills the student's B.7 invoice (founder rule).
 * Permissions: inventory.view (read) / inventory.manage (write).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  storeSchema, itemSchema, stockInSchema, stockOutSchema, sellSchema, assetSchema,
} from "@/lib/validations/inventory";
import {
  listStores, createStore, listItems, createItem, stockIn, stockOut,
  sellToStudent, itemMovements, alerts, listAssets, addAsset,
  assetRegister, updateAsset, logAssetMaintenance,
} from "@/lib/services/inventory.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("inventory.view");
    const sp = req.nextUrl.searchParams;
    const movements = sp.get("movements");
    if (movements) return ok(await itemMovements(user, movements));
    const [stores, items, alertData, assets] = await Promise.all([
      listStores(user),
      listItems(user, { storeId: sp.get("storeId") ?? undefined }),
      alerts(user),
      assetRegister(user), // B.25: assets now carry bookValueKes + due flags + history
    ]);
    return ok({ stores, items, alerts: alertData, assets });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("inventory.manage");
    const body = await req.json().catch(() => ({}));
    const action = z
      .object({ action: z.enum(["addStore", "addItem", "in", "out", "sell", "addAsset", "updateAsset", "assetMaintenance"]) })
      .parse(body).action;
    if (action === "addStore") return ok(await createStore(user, storeSchema.parse(body)), 201);
    if (action === "addItem") return ok(await createItem(user, itemSchema.parse(body)), 201);
    if (action === "in") return ok(await stockIn(user, stockInSchema.parse(body)), 201);
    if (action === "out") return ok(await stockOut(user, stockOutSchema.parse(body)), 201);
    if (action === "sell") return ok(await sellToStudent(user, sellSchema.parse(body)), 201);
    if (action === "updateAsset") {
      // B.25: depreciation %, next service date, custodian, condition…
      const input = z.object({
        assetId: z.string().min(1),
        depreciationPctPerYear: z.coerce.number().int().min(0).max(100).optional(),
        nextMaintenanceOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        custodian: z.string().trim().max(80).nullable().optional(),
        location: z.string().trim().max(80).nullable().optional(),
        condition: z.enum(["GOOD", "FAIR", "NEEDS_REPAIR", "DISPOSED"]).optional(),
        acquiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        valueKes: z.coerce.number().int().min(0).optional(),
      }).parse(body);
      const { assetId, ...rest } = input;
      return ok(await updateAsset(user, assetId, rest));
    }
    if (action === "assetMaintenance") {
      const input = z.object({
        assetId: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        kind: z.enum(["SERVICE", "REPAIR", "INSPECTION", "OTHER"]),
        costKes: z.coerce.number().int().min(0),
        note: z.string().trim().max(300).optional(),
        nextMaintenanceOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }).parse(body);
      return ok(await logAssetMaintenance(user, input), 201);
    }
    return ok(await addAsset(user, assetSchema.parse(body)), 201);
  } catch (e) {
    return handleError(e);
  }
}
