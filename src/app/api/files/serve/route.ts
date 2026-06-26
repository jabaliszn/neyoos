import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/core/session";
import { readObject } from "@/lib/services/storage.service";
import { handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/serve?key=... — stream a stored file.
 * Tenant-checked: a user may only fetch keys under their own tenant prefix.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const key = req.nextUrl.searchParams.get("key") ?? "";
    if (!key.startsWith(`tenants/${user.tenantId}/`)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const obj = await readObject(key);
    return new NextResponse(obj.body, {
      headers: {
        "Content-Type": obj.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
