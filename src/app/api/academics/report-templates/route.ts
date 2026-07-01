import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { requireRevenueFeature } from "@/lib/services/tier-gating.service";
import { ok, fail, handleError } from "@/lib/api/respond";
import { reportTemplateSchema } from "@/lib/validations/report-builder";
import { getReportTemplates, createReportTemplate, updateReportTemplate, deleteReportTemplate, buildTemplateDrivenReportPdf, ReportTemplateError } from "@/lib/services/report-template.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    await requireRevenueFeature(user, "custom_reports");
    const studentId = req.nextUrl.searchParams.get("studentId");
    const templateId = req.nextUrl.searchParams.get("templateId");
    const format = req.nextUrl.searchParams.get("format");
    if (studentId && format === "pdf") {
      const built = await buildTemplateDrivenReportPdf(user, studentId, templateId);
      return new Response(new Uint8Array(built.pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${built.fileName}"`,
        },
      });
    }
    const templates = await getReportTemplates(user);
    return ok({ data: templates });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    await requireRevenueFeature(user, "custom_reports");
    const body = await req.json();
    const data = reportTemplateSchema.parse(body);
    const template = await createReportTemplate(user, data);
    return ok({ data: template }, 201);
  } catch (error) {
    if (error instanceof ReportTemplateError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CONFLICT: 409 };
      return fail(error.code, error.message, statusMap[error.code] as any);
    }
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors[0].message, 400);
    }
    return handleError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    await requireRevenueFeature(user, "custom_reports");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("INVALID", "Template ID required", 400);
    const body = await req.json();
    const data = reportTemplateSchema.parse(body);
    const template = await updateReportTemplate(user, id, data);
    return ok({ data: template });
  } catch (error) {
    if (error instanceof ReportTemplateError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CONFLICT: 409 };
      return fail(error.code, error.message, statusMap[error.code] as any);
    }
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    await requireRevenueFeature(user, "custom_reports");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("INVALID", "Template ID required", 400);
    await deleteReportTemplate(user, id);
    return ok({ message: "Deleted" });
  } catch (error) {
    if (error instanceof ReportTemplateError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CONFLICT: 409 };
      return fail(error.code, error.message, statusMap[error.code] as any);
    }
    return handleError(error);
  }
}
