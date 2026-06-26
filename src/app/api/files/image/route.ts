import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { uploadProcessedImage } from "@/lib/services/storage.service";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/files/image — multipart upload of an image; server resizes + strips
 * EXIF (privacy) and stores a normalized JPEG. Use for avatars/photos.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    const category = (form.get("category") as string) || "image";

    if (!(file instanceof File)) {
      return fail("VALIDATION_ERROR", "No file provided.", 422);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadProcessedImage(user.tenantId, user.id, {
      buffer,
      fileName: file.name,
      contentType: file.type,
      category,
    });
    return ok({ id: result.id, url: result.url, fileName: result.fileName });
  } catch (err) {
    return handleError(err);
  }
}
