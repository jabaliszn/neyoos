import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  LibraryImportError,
  importLibraryBatch,
  libraryRowsFromFile,
  libraryRowsFromText,
  libraryRowsFromTable,
  listLibraryImports,
} from "@/lib/services/library-import.service";

export const dynamic = "force-dynamic";

const rowSchema = z.object({
  title: z.string().min(1),
  author: z.string().optional(),
  isbn: z.string().optional(),
  category: z.string().optional(),
  shelf: z.string().optional(),
  copiesTotal: z.coerce.number().int().min(1).max(1000).optional(),
});

const importSchema = z.object({
  rows: z.array(rowSchema).optional(),
  table: z.array(z.array(z.string())).optional(),
  text: z.string().optional(),
  hasHeader: z.boolean().default(true),
}).refine((v) => v.rows || v.table || v.text, { message: "Provide book rows, table rows, pasted text or a file." });

/** GET /api/library/import — recent Library bulk-import history (N.1). */
export async function GET() {
  try {
    const user = await requirePermission("library.view");
    return ok(await listLibraryImports(user));
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/library/import — Bulk import books from JSON, pasted CSV/TSV, or multipart CSV/XLSX. */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("library.manage");
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const hasHeader = form.get("hasHeader") !== "false";
      if (!(file instanceof File)) throw new LibraryImportError("INVALID", "Upload a library import file.");
      const bytes = Buffer.from(await file.arrayBuffer());
      const rows = await libraryRowsFromFile(file.name, bytes, hasHeader);
      const source = file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
      return ok(await importLibraryBatch(user, rows, { fileName: file.name, source }));
    }

    const body = importSchema.parse(await req.json());
    const rows = body.rows
      ? body.rows.map((r) => ({ ...r, copiesTotal: r.copiesTotal ?? 1 }))
      : (body.table ? libraryRowsFromTable(body.table, body.hasHeader) : libraryRowsFromText(body.text || "", body.hasHeader));
    const source = body.table ? "csv" : "paste";
    return ok(await importLibraryBatch(user, rows, { source }));
  } catch (err) {
    return handleError(err);
  }
}
