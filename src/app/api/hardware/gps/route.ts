import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handleError, fail } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { ingestGpsBusLocation } from "@/lib/services/hardware-registry.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-neyo-tracker-token") || req.nextUrl.searchParams.get("token");
    if (process.env.HARDWARE_FEED_TOKEN && token !== process.env.HARDWARE_FEED_TOKEN) return fail("FORBIDDEN", "Invalid tracker token.", 403);
    const body = z.object({ tenantSlug: z.string().min(2), trackerId: z.string().min(2), vehicleId: z.string().optional(), vehicleRegNo: z.string().optional(), lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180), speedKph: z.coerce.number().optional(), headingDeg: z.coerce.number().optional() }).parse(await req.json());
    const tenant = await db.tenant.findUnique({ where: { slug: body.tenantSlug } });
    if (!tenant) return fail("NOT_FOUND", "Tenant not found.", 404);
    return ok(await ingestGpsBusLocation(tenant.id, body), 201);
  } catch (e) { return handleError(e); }
}
