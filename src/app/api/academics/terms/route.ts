/** B.4 academic terms (KE 3-term year). GET (academics.view) · POST upsert (academics.manage). */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { termSchema } from "@/lib/validations/academics";
import { listTerms, upsertTerm } from "@/lib/services/academics.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requirePermission("academics.view");
    return ok({ terms: await listTerms(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const input = termSchema.parse(await req.json());
    return ok(await upsertTerm(user, input));
  } catch (e) {
    return handleError(e);
  }
}
