import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class DutyRosterError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID", message: string) {
    super(message);
  }
}

export type DutyRotationPeriod = "WEEKLY" | "BI_WEEKLY" | "MONTHLY";
const DUTIES = "Morning assembly, gate arrival checks, dining hall supervision, break/lunch duty, evening roll call";

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, days: number) { const n = new Date(d); n.setDate(n.getDate() + days); return n; }
function parseYmd(s: string) { return new Date(`${s}T00:00:00.000Z`); }
function rotationStep(rotation: DutyRotationPeriod) { return rotation === "WEEKLY" ? 7 : rotation === "BI_WEEKLY" ? 14 : 28; }

async function currentTermBounds(tenantId: string) {
  const year = new Date().getFullYear();
  const current = await db.academicTerm.findFirst({ where: { tenantId, current: true } });
  return {
    termLabel: current ? `Term ${current.term}, ${current.year}` : `Term 2, ${year}`,
    startDate: current?.startDate ?? ymd(new Date()),
    endDate: current?.endDate ?? ymd(addDays(new Date(), 7 * 12 - 1)),
  };
}

export async function dutyRosterBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const term = await currentTermBounds(user.tenantId);
    const [entries, teachers] = await Promise.all([
      tenantDb().dutyRosterEntry.findMany({
        where: { termLabel: term.termLabel },
        orderBy: { weekNo: "asc" },
      }),
      tenantDb().user.findMany({
        where: { role: { in: ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL", "PRINCIPAL"] }, isActive: true },
        select: { id: true, fullName: true, role: true },
        orderBy: { fullName: "asc" },
      }),
    ]);
    return {
      termLabel: term.termLabel,
      termStartDate: term.startDate,
      termEndDate: term.endDate,
      teachers,
      entries,
    };
  });
}

export async function generateDutyRoster(user: SessionUser, input: { rotationPeriod: DutyRotationPeriod; teacherIds: string[]; teachersPerCycle?: number }) {
  return withTenant(user.tenantId, async () => {
    const teacherIds = Array.from(new Set(input.teacherIds.filter(Boolean)));
    if (teacherIds.length === 0) throw new DutyRosterError("INVALID", "Select at least one teacher for duty rotation.");
    const teachers = await tenantDb().user.findMany({
      where: { id: { in: teacherIds }, role: { in: ["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL", "PRINCIPAL"] }, isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
    if (teachers.length === 0) throw new DutyRosterError("NOT_FOUND", "No active teachers found for duty rotation.");
    const teamSize = Math.max(1, Math.min(Math.trunc(input.teachersPerCycle ?? 2), teachers.length));

    const term = await currentTermBounds(user.tenantId);
    const step = rotationStep(input.rotationPeriod);
    const start = parseYmd(term.startDate);
    const end = parseYmd(term.endDate);
    const entries: { weekNo: number; startDate: string; endDate: string; primaryTeacherId: string; primaryTeacherName: string; assistantTeacherId: string | null; assistantTeacherName: string | null; dutyTeamSize: number; dutyTeacherIds: string; dutyTeacherNames: string }[] = [];
    let cursor = start;
    let weekNo = 1;
    while (cursor <= end && weekNo <= 16) {
      const team = Array.from({ length: teamSize }, (_, offset) => teachers[(weekNo - 1 + offset) % teachers.length]);
      const primary = team[0];
      const assistant = team[1] ?? null;
      const blockEnd = addDays(cursor, step - 1) > end ? end : addDays(cursor, step - 1);
      entries.push({
        weekNo,
        startDate: ymd(cursor),
        endDate: ymd(blockEnd),
        primaryTeacherId: primary.id,
        primaryTeacherName: primary.fullName,
        assistantTeacherId: assistant?.id ?? null,
        assistantTeacherName: assistant?.fullName ?? null,
        dutyTeamSize: teamSize,
        dutyTeacherIds: JSON.stringify(team.map((t) => t.id)),
        dutyTeacherNames: JSON.stringify(team.map((t) => t.fullName)),
      });
      cursor = addDays(cursor, step);
      weekNo++;
    }

    await db.dutyRosterEntry.deleteMany({ where: { tenantId: user.tenantId, termLabel: term.termLabel } });
    for (const e of entries) {
      await db.dutyRosterEntry.create({
        data: {
          tenantId: user.tenantId,
          termLabel: term.termLabel,
          rotationPeriod: input.rotationPeriod,
          ...e,
          duties: DUTIES,
          generatedById: user.id,
          generatedByName: user.fullName,
        },
      });
    }
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "academics.duty_roster_generated",
        entityType: "dutyRosterEntry",
        entityId: term.termLabel,
        metadata: JSON.stringify({ rotationPeriod: input.rotationPeriod, teacherCount: teachers.length, teachersPerCycle: teamSize, entryCount: entries.length }),
      },
    });
    return dutyRosterBoard(user);
  });
}
