/**
 * H.2 Multi-Owner Support (founder 2026-06-14).
 *
 * A school can register several SCHOOL_OWNERs. When Tenant.requireJointOwnerApproval
 * is ON and there are 2+ owners, critical actions need a SECOND owner to approve
 * (dual control): one owner raises an OwnerApprovalRequest, a DIFFERENT owner
 * approves or rejects it. The rows + audit log are the joint-approval log.
 *
 * If there is only one owner (or the flag is off) the action proceeds normally —
 * joint approval cannot block a single-owner school from running.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class OwnerApprovalError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "STATE" | "SELF", message: string) {
    super(message);
    this.name = "OwnerApprovalError";
  }
}

export const OWNER_ACTIONS = [
  "PERMANENT_DELETE",
  "PAYROLL_APPROVE",
  "OWNER_ROLE_CHANGE",
  "MODULE_CHANGE",
  "OTHER",
] as const;
export type OwnerAction = (typeof OWNER_ACTIONS)[number];

function isOwner(user: SessionUser): boolean {
  return user.role === "SCHOOL_OWNER" || user.secondaryRole === "SCHOOL_OWNER";
}

/** Count active SCHOOL_OWNER users (primary or secondary role) for a tenant. */
export async function ownerCount(tenantId: string): Promise<number> {
  return withTenantCount(tenantId);
}
async function withTenantCount(tenantId: string) {
  const owners = await db.user.findMany({
    where: { tenantId, isActive: true, OR: [{ role: "SCHOOL_OWNER" }, { secondaryRole: "SCHOOL_OWNER" }] },
    select: { id: true },
  });
  return owners.length;
}

/** Does this school currently require joint owner approval? (flag ON AND 2+ owners) */
export async function jointApprovalActive(tenantId: string): Promise<boolean> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { requireJointOwnerApproval: true } });
  if (!tenant?.requireJointOwnerApproval) return false;
  return (await ownerCount(tenantId)) >= 2;
}

/** List owners (for the multi-owner panel) + the joint-approval state. */
export async function ownersBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const owners = await tenantDb().user.findMany({
      where: { isActive: true, OR: [{ role: "SCHOOL_OWNER" }, { secondaryRole: "SCHOOL_OWNER" }] },
      select: { id: true, fullName: true, email: true, role: true, secondaryRole: true },
      orderBy: { fullName: "asc" },
    });
    const tenant = await tenantDb().tenant.findUnique({ where: { id: user.tenantId } });
    const pending = await tenantDb().ownerApprovalRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      owners,
      ownerCount: owners.length,
      requireJointOwnerApproval: !!tenant?.requireJointOwnerApproval,
      jointActive: !!tenant?.requireJointOwnerApproval && owners.length >= 2,
      canManage: isOwner(user),
      pending,
    };
  });
}

/** Owner toggles the joint-approval policy. */
export async function setJointApproval(user: SessionUser, enabled: boolean) {
  return withTenant(user.tenantId, async () => {
    if (!isOwner(user)) throw new OwnerApprovalError("FORBIDDEN", "Only a School Owner can change the joint-approval policy.");
    await db.tenant.update({ where: { id: user.tenantId }, data: { requireJointOwnerApproval: enabled } });
    await audit(user, "owner.joint_policy_updated", { enabled });
    return { requireJointOwnerApproval: enabled };
  });
}

/** Raise a request for a second owner to approve a critical action. */
export async function requestOwnerApproval(
  user: SessionUser,
  input: { action: OwnerAction; summary: string; payload?: unknown }
) {
  return withTenant(user.tenantId, async () => {
    if (!isOwner(user)) throw new OwnerApprovalError("FORBIDDEN", "Only a School Owner can raise a joint-approval request.");
    const row = await db.ownerApprovalRequest.create({
      data: {
        tenantId: user.tenantId,
        action: input.action,
        summary: input.summary,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        requestedById: user.id,
        requestedByName: user.fullName,
      },
    });
    await audit(user, "owner.approval_requested", { action: input.action, summary: input.summary, id: row.id });
    return row;
  });
}

/** A DIFFERENT owner approves or rejects a pending request. */
export async function decideOwnerApproval(
  user: SessionUser,
  requestId: string,
  approve: boolean,
  note?: string
) {
  return withTenant(user.tenantId, async () => {
    if (!isOwner(user)) throw new OwnerApprovalError("FORBIDDEN", "Only a School Owner can decide joint-approval requests.");
    const req = await tenantDb().ownerApprovalRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new OwnerApprovalError("NOT_FOUND", "Approval request not found.");
    if (req.status !== "PENDING") throw new OwnerApprovalError("STATE", "This request has already been decided.");
    // Dual control: the initiator cannot approve their own request.
    if (req.requestedById === user.id) throw new OwnerApprovalError("SELF", "A second owner must approve this — you cannot approve your own request.");

    const row = await db.ownerApprovalRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        decidedById: user.id,
        decidedByName: user.fullName,
        decidedAt: new Date(),
        decisionNote: note ?? null,
      },
    });
    await audit(user, approve ? "owner.approval_granted" : "owner.approval_rejected", {
      id: requestId, action: req.action, requestedBy: req.requestedByName,
    });
    return row;
  });
}

async function audit(user: SessionUser, action: string, metadata: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType: "tenant", entityId: user.tenantId,
      metadata: JSON.stringify(metadata),
    },
  });
}
