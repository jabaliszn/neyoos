import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/core/session";
import { schoolProfileSchema } from "@/lib/validations/school-profile";
import { getSchoolProfile, updateSchoolProfile } from "@/lib/services/school-profile.service";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/school-profile — read the school profile & branding (G.9). */
export async function GET() {
  try {
    const user = await requirePermission("tenant.manage_settings");
    const profile = await getSchoolProfile(user.tenantId);
    return ok({ profile });
  } catch (err) {
    return handleError(err);
  }
}

/** PUT /api/school-profile — update profile, branding, joining requirements (G.9). */
export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission("tenant.manage_settings");
    const input = schoolProfileSchema.parse(await req.json().catch(() => ({})));
    const profile = await updateSchoolProfile(user.tenantId, input, {
      id: user.id,
      name: user.fullName,
    });
    return ok({ profile });
  } catch (err) {
    return handleError(err);
  }
}
