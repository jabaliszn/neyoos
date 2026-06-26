import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { StaffImportError, importStaffBatch, staffRowsFromFile, staffRowsFromText, staffRowsFromTable } from "@/lib/services/staff-import.service";

export const dynamic = "force-dynamic";

const rowSchema = z.object({
  fullName: z.string().min(1),
  role: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  tscNumber: z.string().optional(),
  nationalId: z.string().optional(),
  kraPin: z.string().optional(),
  qualifications: z.string().optional(),
  employmentDate: z.string().optional(),
  contractType: z.string().optional(),
  emergencyContact: z.string().optional(),
});

const importSchema = z.object({
  rows: z.array(rowSchema).optional(),
  table: z.array(z.array(z.string())).optional(),
  text: z.string().optional(),
  hasHeader: z.boolean().default(true),
}).refine((v) => v.rows || v.table || v.text, { message: "Provide staff rows, table rows, pasted text or a file." });

/** POST /api/hr/import — Bulk import staff members from JSON, pasted CSV/TSV, or multipart CSV/XLSX. */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("staff.manage");
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const hasHeader = form.get("hasHeader") !== "false";
      if (!(file instanceof File)) throw new StaffImportError("INVALID", "Upload a staff import file.");
      const bytes = Buffer.from(await file.arrayBuffer());
      const rows = await staffRowsFromFile(file.name, bytes, hasHeader);
      return ok(await importStaffBatch(user, rows));
    }

    const body = importSchema.parse(await req.json());
    const rows = body.rows ?? (body.table ? staffRowsFromTable(body.table, body.hasHeader) : staffRowsFromText(body.text || "", body.hasHeader));
    return ok(await importStaffBatch(user, rows));
  } catch (err) {
    return handleError(err);
  }
}
