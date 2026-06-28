import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { getCurriculumVersions, createDraftVersion, previewCurriculumDiff, publishDraftVersion, VersioningError } from "@/lib/services/curriculum-versioning.service";

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const diffId = req.nextUrl.searchParams.get("diffId");
    
    if (diffId) {
      const diff = await previewCurriculumDiff(user, diffId);
      return ok({ data: diff });
    }
    
    const data = await getCurriculumVersions(user);
    return ok({ data });
  } catch (error) {
    if (error instanceof VersioningError) return fail(error.code, error.message, 400);
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json();
    
    if (body.action === "DRAFT") {
      const draft = await createDraftVersion(user, body.curriculumId, body.versionName);
      return ok({ data: draft }, 201);
    }
    
    if (body.action === "PUBLISH") {
      const active = await publishDraftVersion(user, body.draftId);
      return ok({ data: active });
    }
    
    return fail("INVALID", "Unknown action", 400);
  } catch (error) {
    if (error instanceof VersioningError) return fail(error.code, error.message, 400);
    return handleError(error);
  }
}
