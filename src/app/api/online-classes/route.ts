import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { onlineClassBoard, requestOnlineClass, setOnlineClassStatus } from "@/lib/services/online-class.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await onlineClassBoard(user));
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const action = z.enum(["request", "running", "ended", "cancelled"]).parse(body.action);
    if (action === "request") {
      const input = z.object({ classId: z.string(), title: z.string().trim().min(2).max(120), scheduledAt: z.string().trim().min(4) }).parse(body);
      return ok(await requestOnlineClass(user, input));
    }
    const { id } = z.object({ id: z.string() }).parse(body);
    return ok(await setOnlineClassStatus(user, id, action === "running" ? "RUNNING" : action === "ended" ? "ENDED" : "CANCELLED"));
  } catch (e) { return handleError(e); }
}
