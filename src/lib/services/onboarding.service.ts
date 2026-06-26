/**
 * First-run onboarding service (Feature G.3).
 * Creates a brand-new school end-to-end and signs the owner in. Reuses:
 *  - slug validation (A.2.5), Argon2id password (A.1.2), DEK (A.2.7),
 *    modules (A.2.6), ID generation prefix (A.4).
 */
import crypto from "crypto";
import { hash as argonHash } from "@node-rs/argon2";
import { db } from "@/lib/db";
import { assertSlugUsable } from "@/lib/services/tenant.service";
import { ensureTenantDek } from "@/lib/services/encryption.service";
import { initialiseModules } from "@/lib/services/module.service";
import { generateNeyoLoginId } from "@/lib/services/identity.service";
import { SESSION_TTL_DAYS } from "@/lib/core/session";
import type { SignupInput } from "@/lib/validations/onboarding";

export class OnboardingError extends Error {
  constructor(public code: "EMAIL_TAKEN" | "SLUG_TAKEN", message: string) {
    super(message);
    this.name = "OnboardingError";
  }
}

export interface SignupResult {
  tenantId: string;
  tenantSlug: string;
  ownerId: string;
  ownerName: string;
  sessionToken: string;
  sessionExpiry: Date;
}

/**
 * Create a school + first owner + provisioning, and return a session token to
 * set as the login cookie. Throws if slug/email taken.
 */
export async function signupSchool(
  input: SignupInput,
  ctx?: { userAgent?: string; ipAddress?: string }
): Promise<SignupResult> {
  // Validate slug uniqueness (throws SlugError if taken/invalid).
  const slug = await assertSlugUsable(input.slug);

  // Email must be globally unique among users.
  const emailClash = await db.user.findFirst({
    where: { email: input.ownerEmail },
    select: { id: true },
  });
  if (emailClash) {
    throw new OnboardingError(
      "EMAIL_TAKEN",
      "An account with that email already exists. Try signing in."
    );
  }

  const passwordHash = await argonHash(input.password);

  // 1) Create the tenant.
  const tenant = await db.tenant.create({
    data: {
      name: input.schoolName,
      slug,
      osKey: input.osKey,
      county: input.county,
      phone: input.ownerPhone,
      email: input.ownerEmail,
      curriculum: input.curriculum,
      onboardedAt: new Date(),
    },
  });

  // 2) Provision encryption + modules.
  await ensureTenantDek(tenant.id);
  await initialiseModules(tenant.id);
  if (input.modules?.length) {
    for (const key of input.modules) {
      await db.tenantModule.upsert({
        where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: key } },
        update: { enabled: true },
        create: { tenantId: tenant.id, moduleKey: key, enabled: true },
      });
    }
  }

  // 3) Create the first user (SCHOOL_OWNER).
  const neyoLoginId = await generateNeyoLoginId();
  const owner = await db.user.create({
    data: {
      tenantId: tenant.id,
      neyoLoginId,
      fullName: input.ownerName,
      email: input.ownerEmail,
      phone: input.ownerPhone,
      role: "SCHOOL_OWNER",
      passwordHash,
    },
  });

  // 4) Create a login session + audit.
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiry = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  await db.$transaction([
    db.session.create({
      data: {
        token: sessionToken,
        userId: owner.id,
        userAgent: ctx?.userAgent ?? null,
        ipAddress: ctx?.ipAddress ?? null,
        expiresAt: sessionExpiry,
      },
    }),
    db.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorId: owner.id,
        actorName: owner.fullName,
        action: "tenant.created",
        entityType: "Tenant",
        entityId: tenant.id,
        metadata: JSON.stringify({ slug, curriculum: input.curriculum, osKey: input.osKey }),
      },
    }),
    db.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorId: owner.id,
        actorName: owner.fullName,
        action: "auth.login",
        entityType: "Session",
        metadata: JSON.stringify({ method: "signup" }),
      },
    }),
  ]);

  return {
    tenantId: tenant.id,
    tenantSlug: slug,
    ownerId: owner.id,
    ownerName: owner.fullName,
    sessionToken,
    sessionExpiry,
  };
}

/** Invite staff (creates inactive-until-first-login accounts with temp IDs). */
export async function inviteStaff(
  tenantId: string,
  invites: { fullName: string; email: string; role: string }[]
): Promise<{ created: number }> {
  let created = 0;
  for (const inv of invites) {
    const exists = await db.user.findFirst({
      where: { email: inv.email },
      select: { id: true },
    });
    if (exists) continue;
    const neyoLoginId = await generateNeyoLoginId();
    await db.user.create({
      data: {
        tenantId,
        neyoLoginId,
        fullName: inv.fullName,
        email: inv.email,
        role: inv.role,
        // No password yet — they'll set one via magic link / reset on first login.
      },
    });
    created++;
  }
  return { created };
}
