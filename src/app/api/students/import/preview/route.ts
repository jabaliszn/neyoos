/**
 * B.1 Bulk import — preview endpoint (Chunk 4).
 * POST multipart (file) OR JSON (pasted text / parsed rows).
 * Permission: student.create.
 */
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { importPreviewSchema } from "@/lib/validations/student-import";
import { parseDelimited, parseXlsx, previewImport, ImportError } from "@/lib/services/student-import.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.create");

    const contentType = req.headers.get("content-type") ?? "";
    let rows: string[][] = [];
    let source: "csv" | "xlsx" | "paste" = "paste";
    let fileName: string | undefined;
    let hasHeader = true;
    let mapping;
    let targetClassId: string | undefined;
    let updateExisting = true;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new ImportError("BAD_FILE", "No file received.");
      fileName = file.name;
      const buf = Buffer.from(await file.arrayBuffer());
      if (/\.xlsx$/i.test(file.name)) {
        source = "xlsx";
        rows = await parseXlsx(buf);
      } else {
        source = "csv";
        rows = parseDelimited(buf.toString("utf-8"));
      }
      hasHeader = form.get("hasHeader") !== "false";
      const targetClassRaw = form.get("targetClassId");
      targetClassId = typeof targetClassRaw === "string" && targetClassRaw ? targetClassRaw : undefined;
      updateExisting = form.get("updateExisting") !== "false";
    } else {
      const body = importPreviewSchema.parse(await req.json());
      source = body.source;
      fileName = body.fileName;
      hasHeader = body.hasHeader;
      mapping = body.mapping;
      targetClassId = body.targetClassId;
      updateExisting = body.updateExisting;
      rows = body.rows ?? parseDelimited(body.text ?? "");
    }

    const preview = await previewImport(user, rows, hasHeader, mapping, targetClassId, updateExisting);
    return ok({ source, fileName, hasHeader, rows, updateExisting, ...preview });
  } catch (e) {
    return handleError(e);
  }
}
