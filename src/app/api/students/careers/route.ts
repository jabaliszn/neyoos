import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { careerDiscoverySchema } from "@/lib/validations/career-discovery";
import { getStudentCareerRecords, getCareerDiscoveryProfile, logCareerRecord, deleteCareerRecord, CareerDiscoveryError } from "@/lib/services/career-discovery.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("student.view");
    const studentId = req.nextUrl.searchParams.get("studentId");
    const view = req.nextUrl.searchParams.get("view");
    if (!studentId) return fail("INVALID", "studentId required", 400);

    if (view === "profile") {
      const data = await getCareerDiscoveryProfile(user, studentId);
      return ok({ data });
    }

    const data = await getStudentCareerRecords(user, studentId);
    return ok({ data });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("student.view");
    const body = await req.json();
    const data = careerDiscoverySchema.parse(body);
    const record = await logCareerRecord(user, data);
    return ok({ data: record }, 201);
  } catch (error) {
    if (error instanceof CareerDiscoveryError) {
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
    const user = await requirePermission("student.view");
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("INVALID", "id required", 400);
    await deleteCareerRecord(user, id);
    return ok({ message: "Deleted" });
  } catch (error) {
    if (error instanceof CareerDiscoveryError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400 };
      return fail(error.code, error.message, statusMap[error.code as keyof typeof statusMap] as any);
    }
    return handleError(error);
  }
}
