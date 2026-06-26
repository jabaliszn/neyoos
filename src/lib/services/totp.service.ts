/**
 * 2FA via TOTP service (Feature A.1 — RFC 6238, no external account needed).
 * - Setup: generate a base32 secret + an otpauth:// URI for the authenticator app.
 * - Enable: confirm the first token, then issue hashed single-use recovery codes.
 * - Verify: accept a current TOTP token OR a recovery code.
 * - Challenge: short-lived "2FA pending" record between login step 1 and step 2.
 */
import crypto from "crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { SESSION_TTL_DAYS } from "@/lib/core/session";
import { AuthServiceError, type VerifyOtpResult } from "@/lib/services/auth.service";

const ISSUER = "NEYO";
const CHALLENGE_TTL_MINUTES = 10;
const RECOVERY_CODE_COUNT = 8;

// Allow a +/- 1 step (30s) window for clock drift.
authenticator.options = { window: 1 };

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** STEP 1 of setup: create (or reuse) a secret and return the QR + manual key. */
export async function startTotpSetup(userId: string): Promise<{
  secret: string;
  otpauthUri: string;
  qrDataUrl: string;
}> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthServiceError("USER_INACTIVE", "User not found.");
  if (user.totpEnabled) {
    throw new AuthServiceError("INVALID_CODE", "2FA is already enabled.");
  }

  // New secret each time setup is (re)started, until enabled.
  const secret = authenticator.generateSecret();
  await db.user.update({ where: { id: userId }, data: { totpSecret: secret } });

  const account = user.email || user.phone || user.neyoLoginId;
  const otpauthUri = authenticator.keyuri(account, ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 });

  return { secret, otpauthUri, qrDataUrl };
}

/** STEP 2 of setup: confirm a token, enable 2FA, and return recovery codes. */
export async function enableTotp(
  userId: string,
  token: string
): Promise<{ recoveryCodes: string[] }> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.totpSecret) {
    throw new AuthServiceError("NO_PENDING_CODE", "Start 2FA setup first.");
  }
  if (!authenticator.verify({ token, secret: user.totpSecret })) {
    throw new AuthServiceError("INVALID_CODE", "That code is not correct.");
  }

  // Generate human-friendly recovery codes (e.g. 4f3a-9c2b), store only hashes.
  const recoveryCodes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const raw = crypto.randomBytes(4).toString("hex"); // 8 hex chars
    recoveryCodes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { totpEnabled: true, totpVerifiedAt: new Date() },
    }),
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({
      data: recoveryCodes.map((c) => ({
        userId,
        codeHash: sha256(c.replace("-", "")),
      })),
    }),
    db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "auth.2fa_enabled",
        entityType: "User",
        entityId: user.id,
      },
    }),
  ]);

  return { recoveryCodes };
}

/** Turn 2FA off after confirming a valid token or recovery code. */
export async function disableTotp(userId: string, token: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.totpEnabled) {
    throw new AuthServiceError("INVALID_CODE", "2FA is not enabled.");
  }
  const valid = await checkSecondFactor(userId, token);
  if (!valid) throw new AuthServiceError("INVALID_CODE", "That code is not correct.");

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null, totpVerifiedAt: null },
    }),
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "auth.2fa_disabled",
        entityType: "User",
        entityId: user.id,
      },
    }),
  ]);
}

/** True if the token is a valid current TOTP OR an unused recovery code. */
export async function checkSecondFactor(
  userId: string,
  token: string
): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.totpSecret) return false;

  const cleaned = token.trim().replace(/[\s-]/g, "");

  // 6-digit numeric -> treat as TOTP.
  if (/^\d{6}$/.test(cleaned)) {
    return authenticator.verify({ token: cleaned, secret: user.totpSecret });
  }

  // Otherwise treat as a recovery code (consume it if it matches).
  const match = await db.recoveryCode.findFirst({
    where: { userId, codeHash: sha256(cleaned), usedAt: null },
  });
  if (!match) return false;
  await db.recoveryCode.update({
    where: { id: match.id },
    data: { usedAt: new Date() },
  });
  return true;
}

// --- Login challenge plumbing ---

/**
 * Called by login routes right after step-1 auth succeeds.
 * If the user has 2FA enabled, we DISCARD the just-created session and issue a
 * short-lived challenge instead (no real session until the 2nd factor is given).
 * Returns a challenge token, or null if no 2FA is required.
 */
export async function maybeConvertToTotpChallenge(
  result: VerifyOtpResult,
  context?: { userAgent?: string; ipAddress?: string; deviceId?: string }
): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: result.user.id },
    select: { totpEnabled: true },
  });
  if (!user?.totpEnabled) return null;

  // Tear down the session step-1 created; require the 2nd factor first.
  await db.session
    .delete({ where: { token: result.sessionToken } })
    .catch(() => {});

  return createTotpChallenge(result.user.id, context);
}


/** Create a short-lived 2FA challenge after step-1 login. Returns its token. */
export async function createTotpChallenge(
  userId: string,
  context?: { userAgent?: string; ipAddress?: string; deviceId?: string }
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await db.totpChallenge.create({
    data: {
      token,
      userId,
      userAgent: context?.userAgent ?? null,
      ipAddress: context?.ipAddress ?? null,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000),
    },
  });
  return token;
}

/**
 * Solve a 2FA challenge: validate the challenge + the second factor, then
 * create the real session (mirrors the other login methods) and audit it.
 */
export async function solveTotpChallenge(
  challengeToken: string,
  factor: string,
  context?: { userAgent?: string; ipAddress?: string; deviceId?: string }
): Promise<VerifyOtpResult> {
  const challenge = await db.totpChallenge.findUnique({
    where: { token: challengeToken },
  });
  if (!challenge || challenge.expiresAt < new Date()) {
    throw new AuthServiceError(
      "CODE_EXPIRED",
      "Your sign-in attempt expired. Please sign in again."
    );
  }

  const valid = await checkSecondFactor(challenge.userId, factor);
  if (!valid) {
    throw new AuthServiceError("INVALID_CODE", "That code is not correct.");
  }

  const user = await db.user.findUnique({ where: { id: challenge.userId } });
  if (!user || !user.isActive) {
    throw new AuthServiceError("USER_INACTIVE", "This account is not active.");
  }

  const now = new Date();
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiry = new Date(
    now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await db.$transaction([
    db.totpChallenge.delete({ where: { id: challenge.id } }),
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
        metadata: JSON.stringify({ method: "totp_second_factor" }),
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
