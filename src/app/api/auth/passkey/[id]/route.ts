import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { deletePasskey } from "@/lib/services/passkey.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** DELETE /api/auth/passkey/:id — remove one of the user's passkeys. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    await deletePasskey(user.id, params.id);
    return ok({ removed: true });
  } catch (err) {
    return handleError(err);
  }
}
