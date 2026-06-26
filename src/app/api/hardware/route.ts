import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { hardwareBoard, registerCctvCamera, setHardwareStatus } from "@/lib/services/hardware-registry.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try { const user = await requirePermission("tenant.manage_settings"); return ok(await hardwareBoard(user)); }
  catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("tenant.manage_settings");
    const body = await req.json().catch(() => ({}));
    const action = z.object({ action: z.enum(["status", "cctv"]) }).parse(body).action;
    if (action === "cctv") {
      const input = z.object({ name: z.string().min(2), location: z.string().min(2), streamUrl: z.string().optional() }).parse(body);
      return ok(await registerCctvCamera(user, input), 201);
    }
    const input = z.object({ deviceType: z.enum(["GPS", "BARCODE", "THERMAL_PRINTER", "RFID", "FINGERPRINT", "CCTV", "FACE_CAMERA"]), label: z.string().min(2), status: z.enum(["NOT_CONNECTED", "READY_TO_PAIR", "CONNECTED", "ERROR"]), deviceName: z.string().optional(), metadata: z.unknown().optional() }).parse(body);
    return ok(await setHardwareStatus(user, input));
  } catch (e) { return handleError(e); }
}
