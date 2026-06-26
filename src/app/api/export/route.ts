import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { toCsv } from "@/lib/documents/csv";
import { toXlsx } from "@/lib/documents/xlsx";
import { handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  format: z.enum(["csv", "xlsx"]),
  sheetName: z.string().default("Export"),
  columns: z.array(z.object({ key: z.string(), label: z.string() })),
  rows: z.array(z.record(z.any())),
});

/**
 * POST /api/export — generic CSV/XLSX export (A.10, "CSV export everywhere").
 * Caller supplies columns + rows it already has permission to see.
 */
export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const { format, sheetName, columns, rows } = schema.parse(
      await req.json().catch(() => ({}))
    );

    if (format === "csv") {
      const csv = toCsv(columns, rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${sheetName}.csv"`,
        },
      });
    }
    const xlsx = await toXlsx(sheetName, columns, rows);
    return new NextResponse(xlsx, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sheetName}.xlsx"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
