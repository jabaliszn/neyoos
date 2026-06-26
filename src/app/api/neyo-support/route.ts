import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { createCustomerThread, addCustomerThreadMessage, listSchoolCustomerThreads, customerThreadSchema, customerReplySchema } from "@/lib/services/neyo-customer-hub.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ threads: await listSchoolCustomerThreads(user) });
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const action = z.enum(["create_thread", "reply"]).parse(body.action || "create_thread");
    if (action === "reply") {
      const input = customerReplySchema.parse({ ...body, direction: "CUSTOMER" });
      const threads = await listSchoolCustomerThreads(user);
      if (!threads.some((thread) => thread.id === input.threadId)) return fail("FORBIDDEN", "You can only reply to your school's NEYO support threads.", 403);
      return ok({ message: await addCustomerThreadMessage({ id: user.id, fullName: user.fullName, role: user.role, tenantId: user.tenantId }, input) }, 201);
    }
    return ok({ thread: await createCustomerThread(user, customerThreadSchema.parse(body)) }, 201);
  } catch (error) { return handleError(error); }
}
