/**
 * PART J.7 — Student Portfolio System backend service.
 *
 * Provides real Prisma queries for student portfolio timelines, encrypted Storage
 * Vault verification, media size controls, teacher approval workflows, and portable
 * export packs.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";
import { scopeWhere } from "@/lib/services/student.service";
import {
  portfolioItemSchema,
  portfolioItemUpdateSchema,
  portfolioApprovalSchema,
  userCanReadPortfolio,
  userCanSubmitPortfolio,
  userCanApprovePortfolio,
  MAX_PORTFOLIO_FILE_SIZE_BYTES,
  STORAGE_WARNING_THRESHOLD_BYTES,
  type PortfolioItemInput,
  type PortfolioItemUpdateInput,
  type PortfolioApprovalInput,
} from "@/lib/validations/portfolio";

export class PortfolioError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "TOO_LARGE", message: string) {
    super(message);
    this.name = "PortfolioError";
  }
}

async function audit(user: SessionUser, action: string, entityType: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action,
      entityType,
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

function assertRead(user: SessionUser) {
  if (!userCanReadPortfolio(user)) throw new PortfolioError("FORBIDDEN", "You do not have permission to view student portfolios.");
}
function assertSubmit(user: SessionUser) {
  if (!userCanSubmitPortfolio(user)) throw new PortfolioError("FORBIDDEN", "You do not have permission to submit portfolio items.");
}
function assertApprove(user: SessionUser) {
  if (!userCanApprovePortfolio(user)) throw new PortfolioError("FORBIDDEN", "Only academic leadership and authorized teachers can approve portfolio items.");
}

export async function getPortfolioTimeline(user: SessionUser, studentId: string) {
  assertRead(user);
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({
      where: { AND: [{ id: studentId }, scope] },
      include: { schoolClass: true },
    });
    if (!student) throw new PortfolioError("NOT_FOUND", "Student not found or access forbidden by row scoping.");

    // Visibility rules:
    // PARENT sees only visibleToParents=true & status=APPROVED
    // STUDENT sees visibleToParents=true OR their own submitted/draft items
    // Staff see all items for the student
    let whereClause: Record<string, unknown> = { studentId };
    if (user.role === "PARENT") {
      whereClause = { studentId, visibleToParents: true, status: "APPROVED" };
    } else if (user.role === "STUDENT") {
      whereClause = { studentId }; // student sees all their own items
    }

    const items = await tenantDb().portfolioItem.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    // Calculate total storage usage for media size controls & warnings
    const totalStorageBytes = items.reduce((sum, item) => sum + (item.fileSizeBytes ?? 0), 0);
    const storageWarningExceeded = totalStorageBytes >= STORAGE_WARNING_THRESHOLD_BYTES;

    return {
      canSubmit: userCanSubmitPortfolio(user),
      canApprove: userCanApprovePortfolio(user),
      student: {
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        admissionNo: student.admissionNo,
        className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
        photoUrl: student.photoUrl,
      },
      items,
      storage: {
        totalStorageBytes,
        totalStorageMegabytes: Math.round((totalStorageBytes / (1024 * 1024)) * 10) / 10,
        warningThresholdBytes: STORAGE_WARNING_THRESHOLD_BYTES,
        warningThresholdMegabytes: Math.round(STORAGE_WARNING_THRESHOLD_BYTES / (1024 * 1024)),
        storageWarningExceeded,
        maxLimitMegabytes: Math.round(MAX_PORTFOLIO_FILE_SIZE_BYTES / (1024 * 1024)),
      },
    };
  });
}

export async function submitPortfolioItem(user: SessionUser, input: PortfolioItemInput) {
  assertSubmit(user);
  const parsed = portfolioItemSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({
      where: { AND: [{ id: parsed.studentId }, scope] },
    });
    if (!student) throw new PortfolioError("NOT_FOUND", "Student not found or access forbidden by row scoping.");

    // Encrypted Storage Vault enforcement
    if (parsed.storedFileId) {
      const storedFile = await tenantDb().storedFile.findUnique({ where: { id: parsed.storedFileId } });
      if (!storedFile) throw new PortfolioError("INVALID", "File reference not found in the encrypted Storage Vault.");
      if (!storedFile.encrypted) throw new PortfolioError("INVALID", "Portfolio files must use the encrypted Storage Vault path.");
    }

    // Media size limit enforcement
    if (parsed.fileSizeBytes && parsed.fileSizeBytes > MAX_PORTFOLIO_FILE_SIZE_BYTES) {
      throw new PortfolioError("TOO_LARGE", `File size exceeds the ${MAX_PORTFOLIO_FILE_SIZE_BYTES / (1024 * 1024)} MB portfolio limit.`);
    }

    // Student role submissions force SUBMITTED status and require teacher approval
    let initialStatus = parsed.status;
    let initialVisibility = parsed.visibleToParents;
    if (user.role === "STUDENT") {
      initialStatus = "SUBMITTED";
      initialVisibility = false;
    }

    const row = await tenantDb().portfolioItem.create({
      data: {
        ...parsed,
        tenantId: user.tenantId,
        status: initialStatus,
        visibleToParents: initialVisibility,
        storedFileId: parsed.storedFileId ?? null,
        fileUrl: parsed.fileUrl ?? null,
        fileName: parsed.fileName ?? null,
        fileSizeBytes: parsed.fileSizeBytes ?? null,
        externalLink: parsed.externalLink ?? null,
        description: parsed.description ?? null,
        competencyId: parsed.competencyId ?? null,
        subjectId: parsed.subjectId ?? null,
        clubId: parsed.clubId ?? null,
        awardId: parsed.awardId ?? null,
        createdById: user.id,
        createdByName: user.fullName,
      } as never,
    });

    await audit(user, "portfolio.item_submitted", "portfolioItem", row.id, { studentId: row.studentId, title: row.title, category: row.category });
    return row;
  });
}

export async function updatePortfolioItem(user: SessionUser, input: PortfolioItemUpdateInput) {
  assertSubmit(user);
  const parsed = portfolioItemUpdateSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().portfolioItem.findUnique({ where: { id: parsed.id } });
    if (!existing) throw new PortfolioError("NOT_FOUND", "Portfolio item not found.");

    if (user.role === "STUDENT" && existing.createdById !== user.id) {
      throw new PortfolioError("FORBIDDEN", "You can only update your own submitted portfolio items.");
    }

    if (parsed.storedFileId) {
      const storedFile = await tenantDb().storedFile.findUnique({ where: { id: parsed.storedFileId } });
      if (!storedFile || !storedFile.encrypted) throw new PortfolioError("INVALID", "Portfolio files must use the encrypted Storage Vault path.");
    }

    const row = await tenantDb().portfolioItem.update({
      where: { id: existing.id },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.category !== undefined ? { category: parsed.category } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
        ...(parsed.storedFileId !== undefined ? { storedFileId: parsed.storedFileId ?? null } : {}),
        ...(parsed.fileUrl !== undefined ? { fileUrl: parsed.fileUrl ?? null } : {}),
        ...(parsed.fileName !== undefined ? { fileName: parsed.fileName ?? null } : {}),
        ...(parsed.fileSizeBytes !== undefined ? { fileSizeBytes: parsed.fileSizeBytes ?? null } : {}),
        ...(parsed.externalLink !== undefined ? { externalLink: parsed.externalLink ?? null } : {}),
        ...(parsed.competencyId !== undefined ? { competencyId: parsed.competencyId ?? null } : {}),
        ...(parsed.subjectId !== undefined ? { subjectId: parsed.subjectId ?? null } : {}),
        ...(parsed.clubId !== undefined ? { clubId: parsed.clubId ?? null } : {}),
        ...(parsed.awardId !== undefined ? { awardId: parsed.awardId ?? null } : {}),
      } as never,
    });

    await audit(user, "portfolio.item_updated", "portfolioItem", row.id, { title: row.title });
    return row;
  });
}

export async function approvePortfolioItem(user: SessionUser, input: PortfolioApprovalInput) {
  assertApprove(user);
  const parsed = portfolioApprovalSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().portfolioItem.findUnique({ where: { id: parsed.itemId } });
    if (!existing) throw new PortfolioError("NOT_FOUND", "Portfolio item not found.");

    const row = await tenantDb().portfolioItem.update({
      where: { id: existing.id },
      data: {
        status: "APPROVED",
        visibleToParents: parsed.visibleToParents,
        approvedById: user.id,
        approvedByName: user.fullName,
        approvedAt: new Date(),
      } as never,
    });

    await audit(user, "portfolio.item_approved", "portfolioItem", row.id, { studentId: row.studentId, approvedBy: user.fullName });
    return row;
  });
}

export async function rejectPortfolioItem(user: SessionUser, input: PortfolioApprovalInput) {
  assertApprove(user);
  const parsed = portfolioApprovalSchema.parse(input);
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().portfolioItem.findUnique({ where: { id: parsed.itemId } });
    if (!existing) throw new PortfolioError("NOT_FOUND", "Portfolio item not found.");

    const row = await tenantDb().portfolioItem.update({
      where: { id: existing.id },
      data: {
        status: "REJECTED",
        visibleToParents: false,
      } as never,
    });

    await audit(user, "portfolio.item_rejected", "portfolioItem", row.id, { studentId: row.studentId, rejectedBy: user.fullName, note: parsed.note });
    return row;
  });
}

export async function deletePortfolioItem(user: SessionUser, id: string) {
  assertSubmit(user);
  return withTenant(user.tenantId, async () => {
    const existing = await tenantDb().portfolioItem.findUnique({ where: { id } });
    if (!existing) throw new PortfolioError("NOT_FOUND", "Portfolio item not found.");

    if (user.role === "STUDENT" && existing.createdById !== user.id) {
      throw new PortfolioError("FORBIDDEN", "You can only delete your own submitted portfolio items.");
    }

    const row = await tenantDb().portfolioItem.delete({ where: { id: existing.id } });
    await audit(user, "portfolio.item_deleted", "portfolioItem", row.id, { studentId: row.studentId, title: row.title });
    return row;
  });
}

export async function exportPortfolioPack(user: SessionUser, studentId: string) {
  assertRead(user);
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({
      where: { AND: [{ id: studentId }, scope] },
      include: { schoolClass: true },
    });
    if (!student) throw new PortfolioError("NOT_FOUND", "Student not found or access forbidden by row scoping.");

    const items = await tenantDb().portfolioItem.findMany({
      where: { studentId, status: "APPROVED", visibleToParents: true },
      orderBy: { approvedAt: "desc" },
    });

    await audit(user, "portfolio.pack_exported", "student", student.id, { itemsCount: items.length });

    return {
      manifest: {
        version: "1.0",
        generatedAt: new Date().toISOString(),
        issuer: "NEYO Education OS",
        tenantId: user.tenantId,
      },
      learner: {
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        admissionNo: student.admissionNo,
        className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
      },
      portfolioPack: items.map((i) => ({
        id: i.id,
        title: i.title,
        category: i.category,
        description: i.description,
        fileUrl: i.fileUrl,
        fileName: i.fileName,
        fileSizeBytes: i.fileSizeBytes,
        externalLink: i.externalLink,
        approvedByName: i.approvedByName,
        approvedAt: i.approvedAt,
        competencyId: i.competencyId,
        subjectId: i.subjectId,
        clubId: i.clubId,
        awardId: i.awardId,
      })),
    };
  });
}
