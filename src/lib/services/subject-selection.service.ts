import { tenantDb } from "@/lib/core/tenant-db";
import { withTenant } from "@/lib/core/tenant-context";
import { SessionUser } from "@/lib/core/session";
import { type CreateSelectionPortalInput } from "@/lib/validations/subject-selection";

export class SelectionError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "CLOSED" | "CONFLICT", message: string) {
    super(message);
    this.name = "SelectionError";
  }
}

export async function createSelectionPortal(user: SessionUser, input: CreateSelectionPortalInput) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    
    if (!["PRINCIPAL", "DEPUTY_PRINCIPAL", "SUPER_ADMIN", "HOD"].includes(user.role)) {
      throw new SelectionError("FORBIDDEN", "Only Academics leadership can configure subject selection portals.");
    }

    const existing = await tDb.subjectSelectionPortal.findFirst({
      where: { 
        targetLevel: input.targetLevel, 
        status: "OPEN",
        closeDate: { gt: new Date() }
      }
    });

    if (existing) {
      throw new SelectionError("CONFLICT", "An active selection portal already exists for this level.");
    }

    return tDb.subjectSelectionPortal.create({
      data: {
        tenantId: user.tenantId,
        name: input.name,
        targetLevel: input.targetLevel,
        openDate: input.openDate,
        closeDate: input.closeDate,
        status: "OPEN",
        rulesJson: JSON.stringify(input.rules)
      }
    });
  });
}

export async function listAllSelectionPortals(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().subjectSelectionPortal.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { selections: true } } }
    });
  });
}

export async function getActiveSelectionPortals(user: SessionUser, level?: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const where: any = { status: "OPEN", closeDate: { gt: new Date() } };
    if (level) where.targetLevel = level;

    return tDb.subjectSelectionPortal.findMany({
      where,
      orderBy: { closeDate: "asc" }
    });
  });
}

export async function submitStudentSelections(user: SessionUser, portalId: string, studentId: string, selectedSubjectIds: string[]) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    
    const portal = await tDb.subjectSelectionPortal.findUnique({ where: { id: portalId } });
    if (!portal) throw new SelectionError("NOT_FOUND", "Portal not found.");
    if (portal.status !== "OPEN" || new Date(portal.closeDate) < new Date()) {
      throw new SelectionError("CLOSED", "This subject selection window is closed.");
    }

    const rules = JSON.parse(portal.rulesJson);
    if (rules.minElectives && selectedSubjectIds.length < rules.minElectives) {
      throw new SelectionError("INVALID", "You must select at least " + rules.minElectives + " subjects.");
    }
    if (rules.maxElectives && selectedSubjectIds.length > rules.maxElectives) {
      throw new SelectionError("INVALID", "You cannot select more than " + rules.maxElectives + " subjects.");
    }

    return tDb.studentSubjectSelection.upsert({
      where: { tenantId_portalId_studentId: { tenantId: user.tenantId, portalId, studentId } },
      create: {
        tenantId: user.tenantId,
        portalId,
        studentId,
        selectedSubjectIds: JSON.stringify(selectedSubjectIds)
      },
      update: {
        selectedSubjectIds: JSON.stringify(selectedSubjectIds)
      }
    });
  });
}

export async function getSelectionReport(user: SessionUser, portalId: string) {
  return withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const portal = await tDb.subjectSelectionPortal.findUnique({ where: { id: portalId }, include: { selections: { include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } } } } });
    if (!portal) throw new SelectionError("NOT_FOUND", "Portal not found");

    const subjects = await tDb.subject.findMany({ select: { id: true, name: true, code: true } });
    const subMap = new Map(subjects.map(s => [s.id, s.name]));

    const tally: Record<string, number> = {};
    subjects.forEach(s => tally[s.name] = 0);

    const studentSelections = portal.selections.map(sel => {
      const ids = JSON.parse(sel.selectedSubjectIds) as string[];
      const names = ids.map(id => {
        const name = subMap.get(id) || "Unknown";
        tally[name]++;
        return name;
      });
      return {
        studentName: sel.student.firstName + " " + sel.student.lastName,
        admissionNo: sel.student.admissionNo,
        subjects: names,
        isConfirmed: sel.isConfirmed
      };
    });

    return { portal, tally, studentSelections };
  });
}
