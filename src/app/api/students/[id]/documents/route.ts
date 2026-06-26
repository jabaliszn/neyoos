import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { addDocumentSchema } from "@/lib/validations/student";
import { addDocument } from "@/lib/services/student.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/students/:id/documents — attach a stored document (B.1.10). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("student.edit");
    const input = addDocumentSchema.parse(await req.json().catch(() => ({})));
    const result = await addDocument(user, params.id, input);
    return ok(result, 201);
  } catch (err) {
    return handleError(err);
  }
}
