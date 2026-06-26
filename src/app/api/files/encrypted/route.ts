import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { uploadEncryptedFile } from "@/lib/services/storage.service";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/files/encrypted — multipart server-side encrypted upload. Plaintext never leaves NEYO. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    const category = (form.get("category") as string) || "general";
    if (!(file instanceof File)) return fail("VALIDATION_ERROR", "No file provided.", 422);
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadEncryptedFile(user.tenantId, user.id, { buffer, fileName: file.name, contentType: file.type, category });
    return ok({ id: result.id, url: result.url, fileName: result.fileName, encrypted: result.encrypted, encryptionMode: result.encryptionMode, checksumSha256: result.checksumSha256 });
  } catch (error) {
    return handleError(error);
  }
}
