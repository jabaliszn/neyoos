import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { typeahead } from "@/lib/services/search.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/search?q=... — tenant-scoped global search (type-ahead). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const hits = await typeahead(user.tenantId, q, user);
    return ok({ hits });
  } catch (err) {
    return handleError(err);
  }
}
