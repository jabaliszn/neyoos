/**
 * R.6 — the printable "Form 4 trip"-style ad-hoc fee-collection report.
 * GET /api/finance/activities/:id/pdf — a real PDF roster for the activity.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { handleError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { activityRoster } from "@/lib/services/school-activity.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("finance.view");
    const { renderActivityRosterPdf } = await import("@/lib/documents/activity-roster-pdf");
    const { activity, rows } = await activityRoster(user, params.id);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });

    const pdf = await renderActivityRosterPdf({
      tenant: { name: tenant.name, county: tenant.county, addressLine: tenant.addressLine, motto: tenant.motto, brandPrimary: tenant.brandPrimary },
      activity,
      rows,
      generatedAt: new Date().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }),
      generatedByName: user.fullName,
    });

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${activity.name.replace(/[^a-z0-9]+/gi, "-")}-roster.pdf"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
