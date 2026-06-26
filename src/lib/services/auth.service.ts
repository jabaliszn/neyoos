/**
 * Auth service (Feature A.1 — Phone + OTP login).
 * Real database logic only. The API layer (Chunk 4) calls these functions.
 */
import crypto from "crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { db } from "@/lib/db";
import { SESSION_TTL_DAYS } from "@/lib/core/session";
import { sendSms, SHOW_DEV_OTP } from "@/lib/notifications/sms";

// --- Tunables (EDIT POINTS) ---
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5; // code valid for 5 minutes
const MAX_CODES_PER_WINDOW = 3; // phone OTP rate limit
const RATE_WINDOW_MINUTES = 15; // ...within this window
const MAX_VERIFY_ATTEMPTS = 5; // wrong-code attempts before a code is locked

/** Cryptographically strong N-digit numeric code as a zero-padded string. */
function generateNumericCode(length: number): string {
  const max = 10 ** length;
  // randomInt is unbiased; pad with leading zeros so "42" -> "000042".
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(length, "0");
}

/** SHA-256 hash of the code. We store the hash, never the raw code. */
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Constant-time comparison to avoid timing attacks. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export class AuthServiceError extends Error {
  constructor(
    public code:
      | "RATE_LIMITED"
      | "NO_PENDING_CODE"
      | "CODE_EXPIRED"
      | "TOO_MANY_ATTEMPTS"
      | "INVALID_CODE"
      | "USER_INACTIVE"
      | "INVALID_CREDENTIALS",
    message: string
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export interface RequestOtpResult {
  ok: true;
  expiresInSeconds: number;
  knownUser: boolean; // does this phone belong to a registered user?
  devCode?: string; // ONLY present in development
}

/**
 * Step 1 — generate, store (hashed), and send a login OTP for a phone.
 * Enforces the phone rate limit. Does NOT reveal whether the user exists
 * in a way attackers can exploit (we always behave the same; we only return
 * `knownUser` to the trusted server which uses it for the dev message).
 */
export async function requestLoginOtp(phone: string): Promise<RequestOtpResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_WINDOW_MINUTES * 60_000);

  // Rate limit: count codes created for this phone in the recent window.
  const recentCount = await db.otpCode.count({
    where: { phone, createdAt: { gte: windowStart } },
  });
  if (recentCount >= MAX_CODES_PER_WINDOW) {
    throw new AuthServiceError(
      "RATE_LIMITED",
      "Too many code requests. Please wait a few minutes and try again."
    );
  }

  // Is this a known user? (Login is open to all roles; we just link the code.)
  const user = await db.user.findFirst({
    where: { phone, isActive: true },
    select: { id: true, isActive: true, fullName: true },
  });

  const code = generateNumericCode(OTP_LENGTH);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60_000);

  await db.otpCode.create({
    data: {
      phone,
      codeHash: hashCode(code),
      userId: user?.id ?? null,
      purpose: "LOGIN",
      expiresAt,
    },
  });

  // "Send" the code. Real SMS provider swaps in here later (A.7).
  await sendSms(
    phone,
    `Your NEYO login code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. Do not share it.`,
    { prefix: false }
  );

  return {
    ok: true,
    expiresInSeconds: OTP_TTL_MINUTES * 60,
    knownUser: Boolean(user),
    ...(SHOW_DEV_OTP ? { devCode: code } : {}),
  };
}

export interface VerifyOtpResult {
  ok: true;
  sessionToken: string;
  expiresAt: Date;
  user: {
    id: string;
    fullName: string;
    role: string;
    tenantId: string;
  };
}

/**
 * Step 2 — verify a code and create a real session.
 * - Finds the newest unconsumed code for the phone.
 * - Enforces expiry and the verify-attempt limit.
 * - On success: consumes the code + creates a Session + writes an AuditLog.
 */
export async function verifyLoginOtp(
  phone: string,
  code: string,
  context?: { userAgent?: string; ipAddress?: string; deviceId?: string }
): Promise<VerifyOtpResult> {
  const now = new Date();

  const otp = await db.otpCode.findFirst({
    where: { phone, purpose: "LOGIN", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    throw new AuthServiceError(
      "NO_PENDING_CODE",
      "No active code found. Please request a new one."
    );
  }

  if (otp.expiresAt < now) {
    throw new AuthServiceError(
      "CODE_EXPIRED",
      "That code has expired. Please request a new one."
    );
  }

  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new AuthServiceError(
      "TOO_MANY_ATTEMPTS",
      "Too many wrong attempts. Please request a new code."
    );
  }

  // Wrong code: increment attempts and reject.
  if (!safeEqual(otp.codeHash, hashCode(code))) {
    await db.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AuthServiceError("INVALID_CODE", "That code is not correct.");
  }

  // Correct code. There must be a matching active user to log in.
  if (!otp.userId) {
    throw new AuthServiceError(
      "USER_INACTIVE",
      "This phone number is not registered. Ask your school to add you."
    );
  }

  const user = await db.user.findUnique({ where: { id: otp.userId } });
  if (!user || !user.isActive) {
    throw new AuthServiceError(
      "USER_INACTIVE",
      "This account is not active. Contact your school administrator."
    );
  }

  // Consume the code, create the session, and audit-log — atomically.
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiry = new Date(
    now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await db.$transaction([
    db.otpCode.update({
      where: { id: otp.id },
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
        metadata: JSON.stringify({ method: "phone_otp", phone }),
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

// --- Email + password backup login (A.1) ---

/** Hash and store a user's password with Argon2id (A.14). */
export async function setUserPassword(
  userId: string,
  plainPassword: string
): Promise<void> {
  const passwordHash = await argonHash(plainPassword);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

/**
 * Verify email + password and create a session.
 * Returns a GENERIC error on any failure (wrong email, wrong password,
 * inactive, or no password set) so attackers can't enumerate accounts.
 */
export async function loginWithPassword(
  email: string,
  password: string,
  context?: { userAgent?: string; ipAddress?: string; deviceId?: string }
): Promise<VerifyOtpResult> {
  const GENERIC = new AuthServiceError(
    "INVALID_CREDENTIALS",
    "Wrong email or password."
  );

  const user = await db.user.findFirst({
    where: { email: { equals: email } },
  });

  // Run a verify even when the user/hash is missing, to keep timing uniform.
  const hashToCheck =
    user?.passwordHash ??
    "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$0000000000000000000000000000000000000000000";
  let passwordOk = false;
  try {
    passwordOk = await argonVerify(hashToCheck, password);
  } catch {
    passwordOk = false;
  }

  if (!user || !user.passwordHash || !user.isActive || !passwordOk) {
    throw GENERIC;
  }

  const now = new Date();
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiry = new Date(
    now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await db.$transaction([
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
        metadata: JSON.stringify({ method: "email_password", email }),
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

/** Logout — delete the session row and audit-log it. */
export async function destroySession(token: string): Promise<void> {
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return;

  await db.$transaction([
    db.session.delete({ where: { token } }),
    db.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorName: session.user.fullName,
        action: "auth.logout",
        entityType: "Session",
      },
    }),
  ]);
}

/**
 * Logout everywhere (A.1) — invalidate ALL sessions for a user by user_id.
 * Returns the number of sessions removed. Audit-logged once.
 */
export async function destroyAllSessionsForUser(
  userId: string
): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, tenantId: true, fullName: true },
  });
  if (!user) return 0;

  const result = await db.session.deleteMany({ where: { userId } });

  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "auth.logout_everywhere",
      entityType: "Session",
      metadata: JSON.stringify({ sessionsRemoved: result.count }),
    },
  });

  return result.count;
}
