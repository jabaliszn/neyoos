import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { communityServiceDecisionSchema, communityServiceSchema } from "@/lib/validations/community-service";
import { getStudentServiceActivities, logServiceActivity, deleteServiceActivity, decideServiceActivity, buildCommunityServiceReport, CommunityServiceError } from "@/lib/services/community-service.service";
import { renderCommunityServiceReportPdf } from "@/lib/documents/community-service-report-pdf";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("student.view");
    const studentId = req.nextUrl.searchParams.get("studentId");
    const format = req.nextUrl.searchParams.get("format");
    if (!studentId) return fail("INVALID", "studentId required", 400);

    if (format === "pdf" || format === "certificate") {
      const built = await buildCommunityServiceReport(user, studentId);
      const pdf = await renderCommunityServiceReportPdf({
        tenant: {
          name: built.tenant.name,
          county: built.tenant.county,
          addressLine: built.tenant.addressLine,
          motto: built.tenant.motto,
          brandPrimary: built.tenant.brandPrimary,
        },
        student: built.summary.student,
        totalHours: built.summary.totalHours,
        activities: built.summary.activities,
        title: format === "certificate" ? "Community Service Certificate" : "Community Service Report",
      });
      return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="community-service-${format}.pdf"` } });
    }

    const data = await getStudentServiceActivities(user, studentId);
    return ok({ data });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.edit");
    const body = await req.json();
    if (body?.action === "decision") {
      const updated = await decideServiceActivity(user, communityServiceDecisionSchema.parse(body));
      return ok({ data: updated });
    }
    const data = communityServiceSchema.parse(body);
    const activity = await logServiceActivity(user, data);
    return ok({ data: activity }, 201);
  } catch (error) {
    if (error instanceof CommunityServiceError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400 };
      return fail(error.code, error.message, statusMap[error.code as keyof typeof statusMap] as any);
    }
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors[0].message, 400);
    }
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission("student.edit");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("INVALID", "id required", 400);
    await deleteServiceActivity(user, id);
    return ok({ message: "Deleted" });
  } catch (error) {
    if (error instanceof CommunityServiceError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400 };
      return fail(error.code, error.message, statusMap[error.code as keyof typeof statusMap] as any);
    }
    return handleError(error);
  }
}
