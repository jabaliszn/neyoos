import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";

/**
 * G.33/I.74 — COMPANY-GLOBAL appearance settings (PlatformSetting, NOT
 * tenant-owned — same family as PlatformFlag G.22). Only NEYO (SUPER_ADMIN)
 * writes; every signed-in client reads.
 *
 * Keys:
 *  - "liquid_level": "1" subtle · "2" standard (default) · "3" deep.
 *  - "neyo_liquid_system_active": "true" | "false" master ON/OFF.
 */
const LIQUID_KEY = "liquid_level";
const LIQUID_ACTIVE_KEY = "neyo_liquid_system_active";
const LIQUID_LEVELS = ["1", "2", "3"] as const;
export type LiquidLevel = (typeof LIQUID_LEVELS)[number];
export interface AppearanceSettings { liquidLevel: LiquidLevel; liquidEnabled: boolean }

export class AppearanceError extends Error {
  constructor(public code: "INVALID", message: string) {
    super(message);
  }
}

export async function getLiquidLevel(): Promise<LiquidLevel> {
  const row = await db.platformSetting.findUnique({ where: { key: LIQUID_KEY } });
  return row && (LIQUID_LEVELS as readonly string[]).includes(row.value)
    ? (row.value as LiquidLevel)
    : "2";
}

export async function getLiquidEnabled(): Promise<boolean> {
  const row = await db.platformSetting.findUnique({ where: { key: LIQUID_ACTIVE_KEY } });
  return row ? row.value !== "false" : true;
}

export async function getAppearanceSettings(): Promise<AppearanceSettings> {
  const [liquidLevel, liquidEnabled] = await Promise.all([getLiquidLevel(), getLiquidEnabled()]);
  return { liquidLevel, liquidEnabled };
}

export async function setAppearanceSettings(user: SessionUser, input: { liquidLevel?: string; liquidEnabled?: boolean }): Promise<AppearanceSettings> {
  if (input.liquidLevel !== undefined && !(LIQUID_LEVELS as readonly string[]).includes(input.liquidLevel)) {
    throw new AppearanceError("INVALID", "Liquidity level must be 1 (subtle), 2 (standard) or 3 (deep).");
  }

  const writes: Promise<unknown>[] = [];
  if (input.liquidLevel !== undefined) {
    writes.push(db.platformSetting.upsert({
      where: { key: LIQUID_KEY },
      update: { value: input.liquidLevel, updatedBy: user.fullName },
      create: { key: LIQUID_KEY, value: input.liquidLevel, updatedBy: user.fullName },
    }));
  }
  if (input.liquidEnabled !== undefined) {
    writes.push(db.platformSetting.upsert({
      where: { key: LIQUID_ACTIVE_KEY },
      update: { value: String(input.liquidEnabled), updatedBy: user.fullName },
      create: { key: LIQUID_ACTIVE_KEY, value: String(input.liquidEnabled), updatedBy: user.fullName },
    }));
  }
  await Promise.all(writes);

  const settings = await getAppearanceSettings();
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "platform.appearance_updated",
      entityType: "platformSetting",
      entityId: "platformAppearance",
      metadata: JSON.stringify(settings),
    },
  });
  return settings;
}

export async function setLiquidLevel(user: SessionUser, level: string): Promise<LiquidLevel> {
  const settings = await setAppearanceSettings(user, { liquidLevel: level });
  return settings.liquidLevel;
}
