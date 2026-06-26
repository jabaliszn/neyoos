import { NextResponse } from "next/server";
import { requireRole } from "@/lib/core/session";
import {
  exportTenantData,
  recordExportAudit,
} from "@/lib/services/export.service";
import { handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenant/export — download this school's full data as JSON.
 * Role-gated to school leadership. Audit-logged.
 */
export async function GET() {
  try {
    const user = await requireRole(
      "SUPER_ADMIN",
      "SCHOOL_OWNER",
      "PRINCIPAL"
    );

    const data = await exportTenantData(user.tenantId);
    await recordExportAudit(user.tenantId, {
      id: user.id,
      fullName: user.fullName,
    });

    const filename = `neyo-export-${data.manifest.tenant.slug}-${
      new Date().toISOString().split("T")[0]
    }.json`;

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
