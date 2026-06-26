/**
 * I.6 Principal Powers & Delegation.
 * Principal/Owner can assign non-sensitive operational tasks to teachers.
 * Teachers see their own task list and can mark a task done.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { Role } from "@/lib/core/roles";
import type { SessionUser } from "@/lib/core/session";
import { createInApp } from "@/lib/services/notification.service";
import type { CreateDelegationTaskInput } from "@/lib/validations/delegation";

export class DelegationError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "INVALID", message: string) {
    super(message);
    this.name = "DelegationError";
  }
}

const ASSIGNER_ROLES: Role[] = ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"];
const TEACHER_TARGET_ROLES = new Set(["TEACHER", "CLASS_TEACHER", "HOD", "DEAN_OF_STUDIES"]);

function hasAnyRole(user: SessionUser, roles: Role[]) {
  return roles.includes(user.role) || (!!user.secondaryRole && roles.includes(user.secondaryRole));
}
function canAssignDelegation(user: SessionUser) {
  return hasAnyRole(user, ASSIGNER_ROLES);
}

async function audit(user: SessionUser, action: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action,
      entityType: "principalDelegationTask",
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

function labelCategory(category: string) {
  return category.replaceAll("_", " ").toLowerCase();
}

export async function delegationBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const canAssign = canAssignDelegation(user);
    const where = canAssign
      ? { status: { in: ["OPEN", "DONE"] } }
      : { assignedToId: user.id, status: { in: ["OPEN", "DONE"] } };
    const tasks = await tenantDb().principalDelegationTask.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 80,
    });
    const teachers = canAssign
      ? await tenantDb().user.findMany({
          where: { isActive: true, role: { in: Array.from(TEACHER_TARGET_ROLES) } },
          select: { id: true, fullName: true, role: true, email: true },
          orderBy: { fullName: "asc" },
        })
      : [];
    return {
      canAssign,
      teachers,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        details: t.details,
        category: t.category,
        categoryLabel: labelCategory(t.category),
        assignedToId: t.assignedToId,
        assignedToName: t.assignedToName,
        assignedByName: t.assignedByName,
        dueDate: t.dueDate,
        status: t.status,
        completedAt: t.completedAt,
        createdAt: t.createdAt,
        isMine: t.assignedToId === user.id,
      })),
    };
  });
}

export async function createDelegationTask(user: SessionUser, input: CreateDelegationTaskInput) {
  return withTenant(user.tenantId, async () => {
    if (!canAssignDelegation(user)) {
      throw new DelegationError("FORBIDDEN", "Only the Principal or School Owner can assign teacher tasks.");
    }
    const target = await tenantDb().user.findUnique({ where: { id: input.assignedToId } });
    if (!target || !target.isActive) throw new DelegationError("NOT_FOUND", "Teacher not found.");
    const targetIsTeacher = TEACHER_TARGET_ROLES.has(target.role) || (!!target.secondaryRole && TEACHER_TARGET_ROLES.has(target.secondaryRole));
    if (!targetIsTeacher) throw new DelegationError("INVALID", "Choose a teacher, class teacher, HOD or Dean of Studies.");

    const row = await db.principalDelegationTask.create({
      data: {
        tenantId: user.tenantId,
        title: input.title.trim(),
        details: input.details?.trim() || null,
        category: input.category,
        assignedToId: target.id,
        assignedToName: target.fullName,
        assignedById: user.id,
        assignedByName: user.fullName,
        dueDate: input.dueDate || null,
      },
    });
    await createInApp({
      tenantId: user.tenantId,
      recipientId: target.id,
      title: "Task assigned by school office",
      body: `${user.fullName} assigned: ${row.title}${row.dueDate ? ` · due ${row.dueDate}` : ""}`,
      category: "delegation",
      href: "/dashboard",
    });
    await audit(user, "delegation.task_assigned", row.id, {
      assignedToId: target.id,
      assignedToName: target.fullName,
      category: input.category,
      dueDate: input.dueDate || null,
    });
    return row;
  });
}

export async function completeDelegationTask(user: SessionUser, taskId: string) {
  return withTenant(user.tenantId, async () => {
    const task = await tenantDb().principalDelegationTask.findUnique({ where: { id: taskId } });
    if (!task) throw new DelegationError("NOT_FOUND", "Task not found.");
    const isAssignee = task.assignedToId === user.id;
    const isAssigner = task.assignedById === user.id || canAssignDelegation(user);
    if (!isAssignee && !isAssigner) throw new DelegationError("FORBIDDEN", "You can only complete a task assigned to you.");
    if (task.status !== "OPEN") throw new DelegationError("INVALID", "Only open tasks can be marked done.");
    const row = await db.principalDelegationTask.update({
      where: { id: taskId },
      data: { status: "DONE", completedAt: new Date() },
    });
    if (task.assignedById !== user.id) {
      await createInApp({
        tenantId: user.tenantId,
        recipientId: task.assignedById,
        title: "Delegated task completed",
        body: `${user.fullName} completed: ${task.title}`,
        category: "delegation",
        href: "/dashboard",
      });
    }
    await audit(user, "delegation.task_completed", taskId, { title: task.title });
    return row;
  });
}

export async function cancelDelegationTask(user: SessionUser, taskId: string) {
  return withTenant(user.tenantId, async () => {
    const task = await tenantDb().principalDelegationTask.findUnique({ where: { id: taskId } });
    if (!task) throw new DelegationError("NOT_FOUND", "Task not found.");
    if (!canAssignDelegation(user) && task.assignedById !== user.id) {
      throw new DelegationError("FORBIDDEN", "Only the task assigner can cancel this task.");
    }
    if (task.status !== "OPEN") throw new DelegationError("INVALID", "Only open tasks can be cancelled.");
    const row = await db.principalDelegationTask.update({
      where: { id: taskId },
      data: { status: "CANCELLED" },
    });
    await createInApp({
      tenantId: user.tenantId,
      recipientId: task.assignedToId,
      title: "Delegated task cancelled",
      body: `${user.fullName} cancelled: ${task.title}`,
      category: "delegation",
      href: "/dashboard",
    });
    await audit(user, "delegation.task_cancelled", taskId, { title: task.title });
    return row;
  });
}
