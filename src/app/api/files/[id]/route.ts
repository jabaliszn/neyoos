import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { deleteFile } from "@/lib/services/storage.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** DELETE /api/files/:id — remove a stored file (tenant-checked). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    await deleteFile(user.tenantId, params.id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
