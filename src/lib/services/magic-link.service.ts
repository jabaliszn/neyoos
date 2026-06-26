/**
 * Magic link service (Feature A.1 — passwordless email sign-in).
 * Real DB logic only. Token is random; only its SHA-256 hash is stored.
 */
import crypto from "crypto";
import { db } from "@/lib/db";
import { SESSION_TTL_DAYS } from "@/lib/core/session";
import { AuthServiceError, type VerifyOtpResult } from "@/lib/services/auth.service";
import { sendEmail, SHOW_DEV_LINK, appBaseUrl } from "@/lib/notifications/email";

// --- Tunables (EDIT POINTS) ---
const LINK_TTL_MINUTES = 15;
const MAX_LINKS_PER_WINDOW = 3;
const RATE_WINDOW_MINUTES = 15;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface RequestMagicLinkResult {
  ok: true;
  /** Present only in development so the founder can click the link. */
  devLink?: string;
}

/**
 * Generate + store a magic link for an email and "send" it.
 * Always behaves the same whether or not the user exists (no enumeration);
 * we simply don't attach a userId when there's no match, and the callback
 * will then fail with a generic message.
 */
export async function requestMagicLink(
  email: string
): Promise<RequestMagicLinkResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_WINDOW_MINUTES * 60_000);

  const recentCount = await db.magicLink.count({
    where: { email, createdAt: { gte: windowStart } },
  });
  if (recentCount >= MAX_LINKS_PER_WINDOW) {
    throw new AuthServiceError(
      "RATE_LIMITED",
      "Too many link requests. Please wait a few minutes and try again."
    );
  }

  const user = await db.user.findFirst({
    where: { email: { equals: email }, isActive: true },
    select: { id: true },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + LINK_TTL_MINUTES * 60_000);

  await db.magicLink.create({
    data: {
      email,
      tokenHash: hashToken(token),
      userId: user?.id ?? null,
      expiresAt,
    },
  });

  const link = `${appBaseUrl()}/api/auth/magic/callback?token=${token}`;

  await sendEmail(
    email,
    "Your NEYO sign-in link",
    `Click to sign in to NEYO (expires in ${LINK_TTL_MINUTES} minutes):\n${link}\n\nIf you didn't request this, you can ignore this email.`
  );

  return {
    ok: true,
    ...(SHOW_DEV_LINK ? { devLink: link } : {}),
  };
}

/**
 * Consume a magic link token: verify it, create a session, audit it.
 * Single-use and time-limited.
 */
export async function consumeMagicLink(
  token: string,
  context?: { userAgent?: string; ipAddress?: string; deviceId?: string }
): Promise<VerifyOtpResult> {
  const now = new Date();

  const record = await db.magicLink.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.consumedAt) {
    throw new AuthServiceError(
      "INVALID_CODE",
      "This sign-in link is invalid or has already been used."
    );
  }
  if (record.expiresAt < now) {
    throw new AuthServiceError(
      "CODE_EXPIRED",
      "This sign-in link has expired. Please request a new one."
    );
  }
  if (!record.userId) {
    // Email had no matching active user. Consume so it can't be retried.
    await db.magicLink.update({
      where: { id: record.id },
      data: { consumedAt: now },
    });
    throw new AuthServiceError(
      "USER_INACTIVE",
      "This email is not registered. Ask your school to add you."
    );
  }

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user || !user.isActive) {
    throw new AuthServiceError(
      "USER_INACTIVE",
      "This account is not active. Contact your school administrator."
    );
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiry = new Date(
    now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await db.$transaction([
    db.magicLink.update({
      where: { id: record.id },
      data: { consumedAt: now },
    }),
    db.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        userAgent: context?.userAgent ?? null,
        ipAddress: context?.ipAddress ?? null,
        deviceId: context?.deviceId ?? null,
        expiresAt: sessionExpiry,
      },
    }),
    db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "auth.login",
        entityType: "Session",
        metadata: JSON.stringify({ method: "magic_link", email: user.email }),
      },
    }),
  ]);

  return {
    ok: true,
    sessionToken,
    expiresAt: sessionExpiry,
    user: {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
    },
  };
}
