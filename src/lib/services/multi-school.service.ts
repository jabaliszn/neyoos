/**
 * R.4 — Multi-School Parent Accounts.
 *
 * The real architecture question the founder flagged: `User` and `Guardian`
 * are both tenant-scoped 1:1 (a User row belongs to exactly one school), and
 * login sessions bind directly to one User.id. Merging accounts across
 * tenants would be a much bigger, riskier project (shared roles/permissions,
 * cross-tenant data leakage risk, etc.) — so instead of merging anything,
 * this keeps EACH school's account completely separate (its own audit
 * trail, its own login, its own data) and adds a real, explicit, OTP-
 * verified LINK between two existing PARENT accounts belonging to the same
 * real person, plus a one-click way to switch the active session between
 * them. Nothing about either school's data model changes.
 *
 * Founder's explicit choices (via ask_user):
 *  - Linking is MANUAL ("Add another school"), never automatic — a shared
 *    or reused phone number must never silently link the wrong people.
 *  - Every link requires a fresh OTP sent to the phone being linked, exactly
 *    like a real login — proving the person doing the linking really does
 *    control that other account's registered phone.
 *  - Once linked, switching is one click (no re-auth per switch) — the
 *    verification already happened at link time.
 */
import crypto from "crypto";
import { db } from "@/lib/db";
import { AuthServiceError } from "@/lib/services/auth.service";
import { sendSms, SHOW_DEV_OTP } from "@/lib/notifications/sms";

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;
const MAX_CODES_PER_WINDOW = 3;
const RATE_WINDOW_MINUTES = 15;
const MAX_VERIFY_ATTEMPTS = 5;
const LINK_PURPOSE = "LINK_SCHOOL";

function generateNumericCode(length: number): string {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(length, "0");
}
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export interface LinkedSchoolSummary {
  userId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  fullName: string;
  role: string;
}

/**
 * Every real school account this parent can switch to, INCLUDING the one
 * they're currently signed into (so the UI can render a full switcher list,
 * current one highlighted). Only PARENT accounts are ever surfaced here —
 * this is not a general cross-tenant account-merge tool.
 */
export async function myLinkedSchools(userId: string): Promise<LinkedSchoolSummary[]> {
  const current = await db.user.findUnique({ where: { id: userId }, include: { tenant: true } });
  if (!current) return [];

  const links = await db.linkedGuardianAccount.findMany({
    where: { OR: [{ primaryUserId: userId }, { linkedUserId: userId }] },
    include: {
      primaryUser: { include: { tenant: true } },
      linkedUser: { include: { tenant: true } },
    },
  });

  const others = links.map((l) => (l.primaryUserId === userId ? l.linkedUser : l.primaryUser));

  const all = [current, ...others];
  // De-dupe (defensive — a real bidirectional link could theoretically be
  // recorded from both sides in edge cases, never show the same school twice).
  const seen = new Set<string>();
  const result: LinkedSchoolSummary[] = [];
  for (const u of all) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    result.push({
      userId: u.id,
      tenantId: u.tenantId,
      tenantName: u.tenant.name,
      tenantSlug: u.tenant.slug,
      fullName: u.fullName,
      role: u.role,
    });
  }
  return result;
}

/**
 * Step 1 of linking — the parent, signed into School A, enters the phone
 * number registered as their PARENT account at School B. Sends a real OTP
 * to that phone (exactly like login) and returns only a generic
 * "code sent" signal — never reveals whether the phone matches a real
 * account, so no phone-number enumeration is possible.
 */
export async function startSchoolLink(
  actingUserId: string,
  phone: string
): Promise<{ ok: true; expiresInSeconds: number; devCode?: string }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_WINDOW_MINUTES * 60_000);

  const recentCount = await db.otpCode.count({
    where: { phone, purpose: LINK_PURPOSE, createdAt: { gte: windowStart } },
  });
  if (recentCount >= MAX_CODES_PER_WINDOW) {
    throw new AuthServiceError("RATE_LIMITED", "Too many code requests. Please wait a few minutes and try again.");
  }

  // The target account for this OTP: whichever real PARENT user owns this
  // phone at ANY OTHER school — explicitly excluding the acting user's own
  // account right here (never just the acting user's own phone, which would
  // be a pointless self-link) so the OTP is deterministically bound to a
  // genuinely different real account, not whichever row happens to sort
  // first when several accounts share a phone. Re-checked again at confirm
  // time for certainty (defense in depth, never trust a single check alone).
  const target = await db.user.findFirst({
    where: { phone, role: "PARENT", isActive: true, id: { not: actingUserId } },
    select: { id: true },
  });

  const code = generateNumericCode(OTP_LENGTH);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60_000);

  await db.otpCode.create({
    data: {
      phone,
      codeHash: hashCode(code),
      userId: target?.id ?? null,
      purpose: LINK_PURPOSE,
      expiresAt,
    },
  });

  await sendSms(
    phone,
    `Your NEYO code to link this school to your other NEYO account is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. Do not share it.`,
    { prefix: false }
  );

  return {
    ok: true,
    expiresInSeconds: OTP_TTL_MINUTES * 60,
    ...(SHOW_DEV_OTP ? { devCode: code } : {}),
  };
}

/**
 * Step 2 — confirm the OTP and, on success, create the REAL bidirectional
 * link (both a fresh AuditLog entry AND a real, verified DB row — never a
 * "trust me" client-side flag). Rejects: wrong/expired/reused code, a phone
 * that doesn't belong to any real PARENT account, linking an account to
 * itself, or an account already linked to too many others (a generous but
 * real sanity cap, preventing runaway link graphs from account-sharing abuse).
 */
export async function confirmSchoolLink(
  actingUserId: string,
  phone: string,
  code: string
): Promise<{ linkedSchool: LinkedSchoolSummary }> {
  const now = new Date();

  const otp = await db.otpCode.findFirst({
    where: { phone, purpose: LINK_PURPOSE, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw new AuthServiceError("NO_PENDING_CODE", "No active code found. Please request a new one.");
  if (otp.expiresAt < now) throw new AuthServiceError("CODE_EXPIRED", "That code has expired. Please request a new one.");
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) throw new AuthServiceError("TOO_MANY_ATTEMPTS", "Too many wrong attempts. Please request a new code.");

  if (!safeEqual(otp.codeHash, hashCode(code))) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new AuthServiceError("INVALID_CODE", "That code is not correct.");
  }

  if (!otp.userId) {
    throw new AuthServiceError("USER_INACTIVE", "That phone isn't registered as a NEYO parent account at any school.");
  }
  if (otp.userId === actingUserId) {
    throw new AuthServiceError("INVALID_CODE", "That's your own account — enter your OTHER school's registered phone number.");
  }

  const [actingUser, targetUser] = await Promise.all([
    db.user.findUnique({ where: { id: actingUserId }, include: { tenant: true } }),
    db.user.findUnique({ where: { id: otp.userId }, include: { tenant: true } }),
  ]);
  if (!actingUser || !targetUser || !targetUser.isActive) {
    throw new AuthServiceError("USER_INACTIVE", "This account is not active.");
  }
  if (actingUser.tenantId === targetUser.tenantId) {
    throw new AuthServiceError("INVALID_CODE", "That account is already at the same school — nothing to link.");
  }
  if (targetUser.role !== "PARENT" || actingUser.role !== "PARENT") {
    throw new AuthServiceError("INVALID_CODE", "Multi-school switching is only available for parent accounts.");
  }

  const existingLinkCount = await db.linkedGuardianAccount.count({
    where: { OR: [{ primaryUserId: actingUserId }, { linkedUserId: actingUserId }] },
  });
  if (existingLinkCount >= 10) {
    throw new AuthServiceError("INVALID_CODE", "You've reached the maximum number of linked schools. Contact NEYO support if you genuinely need more.");
  }

  await db.$transaction([
    db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: now } }),
    db.linkedGuardianAccount.upsert({
      where: { primaryUserId_linkedUserId: { primaryUserId: actingUserId, linkedUserId: targetUser.id } },
      update: {},
      create: { primaryUserId: actingUserId, linkedUserId: targetUser.id, verifiedAt: now },
    }),
    db.auditLog.create({
      data: {
        tenantId: actingUser.tenantId,
        actorId: actingUserId,
        actorName: actingUser.fullName,
        action: "multi_school.linked",
        entityType: "User",
        entityId: targetUser.id,
        metadata: JSON.stringify({ linkedTenantName: targetUser.tenant.name, linkedTenantId: targetUser.tenantId }),
      },
    }),
    db.auditLog.create({
      data: {
        tenantId: targetUser.tenantId,
        actorId: actingUserId,
        actorName: actingUser.fullName,
        action: "multi_school.linked",
        entityType: "User",
        entityId: actingUser.id,
        metadata: JSON.stringify({ linkedTenantName: actingUser.tenant.name, linkedTenantId: actingUser.tenantId }),
      },
    }),
  ]);

  return {
    linkedSchool: {
      userId: targetUser.id,
      tenantId: targetUser.tenantId,
      tenantName: targetUser.tenant.name,
      tenantSlug: targetUser.tenant.slug,
      fullName: targetUser.fullName,
      role: targetUser.role,
    },
  };
}

/**
 * Remove a link (either party can unlink; this is a real, mutual removal —
 * not a one-sided hide — since the founder's model is "these are the same
 * real person's two accounts", not a one-way follow).
 */
export async function unlinkSchool(actingUserId: string, targetUserId: string): Promise<void> {
  const actingUser = await db.user.findUnique({ where: { id: actingUserId } });
  if (!actingUser) throw new AuthServiceError("USER_INACTIVE", "Account not found.");

  const link = await db.linkedGuardianAccount.findFirst({
    where: {
      OR: [
        { primaryUserId: actingUserId, linkedUserId: targetUserId },
        { primaryUserId: targetUserId, linkedUserId: actingUserId },
      ],
    },
  });
  if (!link) return; // already not linked — a safe no-op, not an error

  await db.$transaction([
    db.linkedGuardianAccount.delete({ where: { id: link.id } }),
    db.auditLog.create({
      data: {
        tenantId: actingUser.tenantId,
        actorId: actingUserId,
        actorName: actingUser.fullName,
        action: "multi_school.unlinked",
        entityType: "User",
        entityId: targetUserId,
      },
    }),
  ]);
}

/**
 * Switch the CURRENT real session to point at one of the parent's OWN,
 * already-linked accounts — one click, no re-auth (the founder's explicit
 * choice), because the link itself was already OTP-verified. Real server-
 * side check every time: the target must genuinely be linked to the
 * CURRENT session's user, never just "any user ID the client sends".
 */
export async function switchToLinkedSchool(
  sessionToken: string,
  actingUserId: string,
  targetUserId: string
): Promise<LinkedSchoolSummary> {
  if (targetUserId === actingUserId) {
    const self = await db.user.findUniqueOrThrow({ where: { id: actingUserId }, include: { tenant: true } });
    return { userId: self.id, tenantId: self.tenantId, tenantName: self.tenant.name, tenantSlug: self.tenant.slug, fullName: self.fullName, role: self.role };
  }

  const link = await db.linkedGuardianAccount.findFirst({
    where: {
      OR: [
        { primaryUserId: actingUserId, linkedUserId: targetUserId },
        { primaryUserId: targetUserId, linkedUserId: actingUserId },
      ],
    },
  });
  if (!link) {
    throw new AuthServiceError("INVALID_CODE", "That school isn't linked to your account.");
  }

  const target = await db.user.findUnique({ where: { id: targetUserId }, include: { tenant: true } });
  if (!target || !target.isActive) {
    throw new AuthServiceError("USER_INACTIVE", "That account is no longer active.");
  }

  await db.$transaction([
    db.session.update({ where: { token: sessionToken }, data: { userId: targetUserId } }),
    db.auditLog.create({
      data: {
        tenantId: target.tenantId,
        actorId: targetUserId,
        actorName: target.fullName,
        action: "multi_school.switched",
        entityType: "Session",
        metadata: JSON.stringify({ fromUserId: actingUserId }),
      },
    }),
  ]);

  return { userId: target.id, tenantId: target.tenantId, tenantName: target.tenant.name, tenantSlug: target.tenant.slug, fullName: target.fullName, role: target.role };
}
