import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { founderOpsIdSchema } from "@/lib/validations/founder-ops";
import {
  deleteBuildLog,
  deleteMetricSnapshot,
  deleteFounderOpsEntry,
  deleteCustomerInterview,
} from "@/lib/services/founder-ops.service";

export const dynamic = "force-dynamic";

const sectionSchema = z.enum(["build-logs", "metrics", "entries", "interviews"]);

/** Convenience DELETE endpoint for founder-ops rows. SUPER_ADMIN only. */
export async function DELETE(_req: NextRequest, { params }: { params: { section: string; id: string } }) {
  try {
    await requireRole("SUPER_ADMIN");
    const section = sectionSchema.parse(params.section);
    const id = founderOpsIdSchema.parse({ id: params.id }).id;

    if (section === "build-logs") return ok(await deleteBuildLog(id));
    if (section === "metrics") return ok(await deleteMetricSnapshot(id));
    if (section === "entries") return ok(await deleteFounderOpsEntry(id));
    return ok(await deleteCustomerInterview(id));
  } catch (err) {
    return handleError(err);
  }
}
