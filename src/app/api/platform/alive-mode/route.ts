import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const KEYS = {
  enabled: "neyo_alive_mode_enabled",
  heartbeat: "neyo_alive_heartbeat_enabled",
  microcopy: "neyo_alive_microcopy_enabled",
  motion: "neyo_alive_motion_enabled",
} as const;

type AliveSettings = { enabled: boolean; heartbeat: boolean; microcopy: boolean; motion: boolean };

async function readAliveSettings(): Promise<AliveSettings> {
  const rows = await db.platformSetting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.get(KEYS.enabled) !== "false",
    heartbeat: map.get(KEYS.heartbeat) !== "false",
    microcopy: map.get(KEYS.microcopy) !== "false",
    motion: map.get(KEYS.motion) !== "false",
  };
}

export async function GET() {
  try {
    await requireUser();
    return ok(await readAliveSettings());
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const input = z.object({
      enabled: z.boolean().optional(),
      heartbeat: z.boolean().optional(),
      microcopy: z.boolean().optional(),
      motion: z.boolean().optional(),
    }).parse(await req.json().catch(() => ({})));
    const pairs: [keyof AliveSettings, string][] = [
      ["enabled", KEYS.enabled],
      ["heartbeat", KEYS.heartbeat],
      ["microcopy", KEYS.microcopy],
      ["motion", KEYS.motion],
    ];
    for (const [field, key] of pairs) {
      if (input[field] === undefined) continue;
      await db.platformSetting.upsert({
        where: { key },
        create: { key, value: String(input[field]), updatedBy: user.fullName },
        update: { value: String(input[field]), updatedBy: user.fullName },
      });
    }
    const settings = await readAliveSettings();
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "platform.alive_mode_updated",
        entityType: "platformSetting",
        entityId: "neyo_alive_mode",
        metadata: JSON.stringify(settings),
      },
    });
    return ok(settings);
  } catch (e) {
    return handleError(e);
  }
}
