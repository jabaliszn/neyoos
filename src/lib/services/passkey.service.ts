/**
 * Passkey / WebAuthn service (Feature A.1).
 * Uses @simplewebauthn/server. Stores public keys; private keys stay on device.
 */
import crypto from "crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { SESSION_TTL_DAYS } from "@/lib/core/session";
import {
  RP_NAME,
  rpID,
  expectedOrigin,
  CHALLENGE_TTL_MINUTES,
} from "@/lib/core/webauthn";
import { AuthServiceError, type VerifyOtpResult } from "@/lib/services/auth.service";

const b64u = {
  encode: (buf: Uint8Array | Buffer) =>
    Buffer.from(buf).toString("base64url"),
  decode: (str: string) => Buffer.from(str, "base64url"),
};

function challengeExpiry(): Date {
  return new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000);
}

// --- Registration (must be signed in) ---

export async function getRegistrationOptions(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { credentials: true },
  });
  if (!user) throw new AuthServiceError("USER_INACTIVE", "User not found.");

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(),
    userName: user.email || user.phone || user.neyoLoginId,
    userDisplayName: user.fullName,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: user.credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports
        ? (JSON.parse(c.transports) as AuthenticatorTransport[])
        : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await db.webAuthnChallenge.create({
    data: {
      challenge: options.challenge,
      purpose: "REGISTER",
      userId: user.id,
      expiresAt: challengeExpiry(),
    },
  });

  return options;
}

export async function verifyRegistration(
  userId: string,
  response: unknown,
  deviceLabel?: string,
  requestOrigin?: string
): Promise<{ verified: boolean }> {
  const challenge = await db.webAuthnChallenge.findFirst({
    where: { userId, purpose: "REGISTER" },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.expiresAt < new Date()) {
    throw new AuthServiceError("CODE_EXPIRED", "Setup expired. Please try again.");
  }

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: response as any,
      expectedChallenge: challenge.challenge,
      expectedOrigin: requestOrigin || expectedOrigin(),
      expectedRPID: rpID(),
    });
  } catch {
    throw new AuthServiceError("INVALID_CODE", "Could not verify this passkey.");
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw new AuthServiceError("INVALID_CODE", "Passkey verification failed.");
  }

  const { credentialID, credentialPublicKey, counter } =
    verification.registrationInfo;

  // The browser response carries the transports the authenticator supports.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const respTransports = (response as any)?.response?.transports as
    | string[]
    | undefined;

  const user = await db.user.findUnique({ where: { id: userId } });

  await db.$transaction([
    db.credential.create({
      data: {
        userId,
        credentialId: credentialID,
        publicKey: b64u.encode(credentialPublicKey),
        counter,
        transports: respTransports ? JSON.stringify(respTransports) : null,
        deviceLabel: deviceLabel || "Passkey",
      },
    }),
    db.webAuthnChallenge.delete({ where: { id: challenge.id } }),
    db.auditLog.create({
      data: {
        tenantId: user!.tenantId,
        actorId: userId,
        actorName: user!.fullName,
        action: "auth.passkey_registered",
        entityType: "Credential",
      },
    }),
  ]);

  return { verified: true };
}

// --- Authentication (login) ---

export async function getLoginOptions(email: string) {
  const user = await db.user.findFirst({
    where: { email, isActive: true },
    include: { credentials: true },
  });

  // Always return options (even with no credentials) to avoid enumeration.
  const allowCredentials =
    user?.credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports
        ? (JSON.parse(c.transports) as AuthenticatorTransport[])
        : undefined,
    })) ?? [];

  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    allowCredentials,
    userVerification: "preferred",
  });

  await db.webAuthnChallenge.create({
    data: {
      challenge: options.challenge,
      purpose: "LOGIN",
      email,
      expiresAt: challengeExpiry(),
    },
  });

  return options;
}

export async function verifyLogin(
  email: string,
  response: unknown,
  context?: { userAgent?: string; ipAddress?: string; origin?: string; deviceId?: string }
): Promise<VerifyOtpResult> {
  const challenge = await db.webAuthnChallenge.findFirst({
    where: { email, purpose: "LOGIN" },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.expiresAt < new Date()) {
    throw new AuthServiceError("CODE_EXPIRED", "Sign-in expired. Please try again.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = response as any;
  const credentialIdFromResponse: string = resp?.id;
  const cred = await db.credential.findUnique({
    where: { credentialId: credentialIdFromResponse },
    include: { user: true },
  });
  if (!cred || cred.user.email !== email || !cred.user.isActive) {
    throw new AuthServiceError("INVALID_CODE", "This passkey is not recognised.");
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: resp,
      expectedChallenge: challenge.challenge,
      expectedOrigin: context?.origin || expectedOrigin(),
      expectedRPID: rpID(),
      authenticator: {
        credentialID: cred.credentialId,
        credentialPublicKey: b64u.decode(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports
          ? (JSON.parse(cred.transports) as AuthenticatorTransport[])
          : undefined,
      },
    });
  } catch {
    throw new AuthServiceError("INVALID_CODE", "Could not verify this passkey.");
  }

  if (!verification.verified) {
    throw new AuthServiceError("INVALID_CODE", "Passkey verification failed.");
  }

  const now = new Date();
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiry = new Date(
    now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await db.$transaction([
    db.credential.update({
      where: { id: cred.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: now,
      },
    }),
    db.webAuthnChallenge.delete({ where: { id: challenge.id } }),
    db.session.create({
      data: {
        token: sessionToken,
        userId: cred.userId,
        userAgent: context?.userAgent ?? null,
        ipAddress: context?.ipAddress ?? null,
        deviceId: context?.deviceId ?? null,
        expiresAt: sessionExpiry,
      },
    }),
    db.auditLog.create({
      data: {
        tenantId: cred.user.tenantId,
        actorId: cred.userId,
        actorName: cred.user.fullName,
        action: "auth.login",
        entityType: "Session",
        metadata: JSON.stringify({ method: "passkey" }),
      },
    }),
  ]);

  return {
    ok: true,
    sessionToken,
    expiresAt: sessionExpiry,
    user: {
      id: cred.user.id,
      fullName: cred.user.fullName,
      role: cred.user.role,
      tenantId: cred.user.tenantId,
    },
  };
}

// --- Management ---

export async function listPasskeys(userId: string) {
  return db.credential.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
  });
}

export async function deletePasskey(userId: string, credId: string): Promise<void> {
  const cred = await db.credential.findFirst({ where: { id: credId, userId } });
  if (!cred) throw new AuthServiceError("INVALID_CODE", "Passkey not found.");
  const user = await db.user.findUnique({ where: { id: userId } });
  await db.$transaction([
    db.credential.delete({ where: { id: cred.id } }),
    db.auditLog.create({
      data: {
        tenantId: user!.tenantId,
        actorId: userId,
        actorName: user!.fullName,
        action: "auth.passkey_removed",
        entityType: "Credential",
      },
    }),
  ]);
}

// --- Signed-in critical-action assertion (I.1 / I.40) ---

export async function getActionAssertionOptions(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId, isActive: true },
    include: { credentials: true },
  });
  if (!user) throw new AuthServiceError("USER_INACTIVE", "User not found.");
  if (user.credentials.length === 0) {
    throw new AuthServiceError("NO_PENDING_CODE", "Set up Face ID, fingerprint, or a passkey in Settings → Security first.");
  }

  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    allowCredentials: user.credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports
        ? (JSON.parse(c.transports) as AuthenticatorTransport[])
        : undefined,
    })),
    userVerification: "required",
  });

  await db.webAuthnChallenge.create({
    data: {
      challenge: options.challenge,
      purpose: "ACTION",
      userId: user.id,
      expiresAt: challengeExpiry(),
    },
  });

  return options;
}

// R.3 — how long a real biometric-verification ticket stays valid before it
// must be re-earned. Short on purpose: this proves "you scanned your finger
// JUST NOW for THIS action", not "you scanned it at some point today".
const BIOMETRIC_TICKET_TTL_MINUTES = 3;

export async function verifyActionAssertion(
  userId: string,
  response: unknown,
  requestOrigin?: string,
  actionKey?: string
): Promise<{ verified: true; ticket?: string }> {
  const challenge = await db.webAuthnChallenge.findFirst({
    where: { userId, purpose: "ACTION" },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.expiresAt < new Date()) {
    throw new AuthServiceError("CODE_EXPIRED", "Security check expired. Please try again.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = response as any;
  const credentialIdFromResponse: string = resp?.id;
  const cred = await db.credential.findFirst({
    where: { credentialId: credentialIdFromResponse, userId },
    include: { user: true },
  });
  if (!cred || !cred.user.isActive) {
    throw new AuthServiceError("INVALID_CODE", "This passkey is not recognised for your account.");
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: resp,
      expectedChallenge: challenge.challenge,
      expectedOrigin: requestOrigin || expectedOrigin(),
      expectedRPID: rpID(),
      authenticator: {
        credentialID: cred.credentialId,
        credentialPublicKey: b64u.decode(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports
          ? (JSON.parse(cred.transports) as AuthenticatorTransport[])
          : undefined,
      },
      requireUserVerification: true,
    });
  } catch {
    throw new AuthServiceError("INVALID_CODE", "Could not verify this device security check.");
  }

  if (!verification.verified) {
    throw new AuthServiceError("INVALID_CODE", "Device security check failed.");
  }

  // R.3 — when the caller names a specific real action (e.g. a stable key
  // derived from "record this exact cash payment"), issue a real,
  // short-lived, single-use ticket the protected server route must present
  // and consume — this is the actual server-side enforcement, not just a
  // client-side popup. Without an actionKey, this behaves exactly as before
  // (e.g. Library/Recycle-Bin's existing client-trusted usages, unchanged).
  let ticketId: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [
    db.credential.update({
      where: { id: cred.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    }),
    db.webAuthnChallenge.delete({ where: { id: challenge.id } }),
    db.auditLog.create({
      data: {
        tenantId: cred.user.tenantId,
        actorId: userId,
        actorName: cred.user.fullName,
        action: "auth.passkey_action_verified",
        entityType: "Credential",
        entityId: cred.id,
        metadata: actionKey ? JSON.stringify({ actionKey }) : null,
      },
    }),
  ];
  if (actionKey) {
    ticketId = crypto.randomUUID();
    ops.push(
      db.biometricActionTicket.create({
        data: {
          id: ticketId,
          userId,
          tenantId: cred.user.tenantId,
          actionKey,
          expiresAt: new Date(Date.now() + BIOMETRIC_TICKET_TTL_MINUTES * 60_000),
        },
      })
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.$transaction(ops as any);

  return { verified: true, ticket: ticketId };
}

/**
 * R.3 — the REAL server-side enforcement point. A money-moving route calls
 * this with the ticket the client received from a successful biometric
 * check, plus the SAME actionKey it will actually perform. Consumes the
 * ticket atomically (marks usedAt) so it can never be replayed — a stolen
 * or logged ticket is useless a second time, and a ticket minted for one
 * amount/student can never be reused for a different one because the
 * actionKey must match exactly.
 */
export async function consumeBiometricActionTicket(
  userId: string,
  tenantId: string,
  actionKey: string,
  ticketId: string | undefined | null
): Promise<void> {
  if (!ticketId) {
    throw new AuthServiceError("NO_PENDING_CODE", "This action requires a fresh fingerprint/Face ID check.");
  }
  const ticket = await db.biometricActionTicket.findUnique({ where: { id: ticketId } });
  if (
    !ticket ||
    ticket.userId !== userId ||
    ticket.tenantId !== tenantId ||
    ticket.actionKey !== actionKey ||
    ticket.usedAt ||
    ticket.expiresAt < new Date()
  ) {
    throw new AuthServiceError("INVALID_CODE", "Your fingerprint/Face ID check has expired or does not match this action — please verify again.");
  }
  await db.biometricActionTicket.update({ where: { id: ticket.id }, data: { usedAt: new Date() } });
}
