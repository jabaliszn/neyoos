import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import {
  getCurriculumVersions,
  createDraftVersion,
  previewCurriculumDiff,
  publishDraftVersion,
  VersioningError,
} from "@/lib/services/curriculum-versioning.service";

function versioningStatus(code: VersioningError["code"]) {
  return code === "NOT_FOUND" ? 404 : code === "CONFLICT" ? 409 : 400;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const diffId = req.nextUrl.searchParams.get("diffId");

    if (diffId) {
      const diff = await previewCurriculumDiff(user, diffId);
      return ok(diff);
    }

    const data = await getCurriculumVersions(user);
    return ok(data);
  } catch (error) {
    if (error instanceof VersioningError) return fail(error.code, error.message, versioningStatus(error.code));
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json();

    if (body.action === "DRAFT") {
      const draft = await createDraftVersion(user, body.curriculumId, body.versionName);
      return ok(draft, 201);
    }

    if (body.action === "PUBLISH") {
      const active = await publishDraftVersion(user, body.draftId);
      return ok(active);
    }

    return fail("INVALID", "Unknown action. Use 'DRAFT' or 'PUBLISH'.", 400);
  } catch (error) {
    if (error instanceof VersioningError) return fail(error.code, error.message, versioningStatus(error.code));
    return handleError(error);
  }
}
