import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().optional(),
  os: z.enum(["school_os_demo", "farm_os", "business_os", "creator_os"]),
});

/** POST /api/waitlist — Public registration for waitlists and demo approvals */
export async function POST(req: NextRequest) {
  try {
    const input = schema.parse(await req.json().catch(() => ({})));

    // Prevent duplicate entries for the same email and OS category
    const existing = await db.neyoFounderOpsEntry.findFirst({
      where: {
        kind: "WAITLIST",
        periodKey: input.email.toLowerCase(),
        summary: input.os,
      },
    });

    if (existing) {
      return fail(
        "ALREADY_REGISTERED",
        "You are already registered on the waiting list for this operating system!",
        422
      );
    }

    // Register waitlist entry as a unique NEYO operational entry
    await db.neyoFounderOpsEntry.create({
      data: {
        kind: "WAITLIST",
        periodKey: input.email.toLowerCase(),
        title: input.name,
        summary: input.os,
        status: "PLANNED", // PLANNED = Pending, DONE = Approved
        notes: input.phone || "No phone provided",
      },
    });

    return ok({
      success: true,
      message: "Successfully joined the waiting list! Our team will notify you upon review.",
    });
  } catch (err) {
    return handleError(err);
  }
}
