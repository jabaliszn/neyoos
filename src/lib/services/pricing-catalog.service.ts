import { z } from "zod";
import { db } from "@/lib/db";
import { ADD_ONS, PLANS, type AddOnDef, type PlanDef } from "@/lib/core/plans";

export const PRICING_CATALOG_SETTING_KEY = "neyo_pricing_catalog";

const nonEmptyStringArray = z.array(z.string().trim().min(1)).min(1);

export const pricingPlanSchema = z.object({
  key: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().min(2).max(160),
  pricePerTerm: z.coerce.number().int().min(0).max(10_000_000),
  perStudentPerTerm: z.coerce.number().int().min(0).max(100_000),
  limits: z.object({
    students: z.coerce.number().int().min(1).max(1_000_000),
    staff: z.coerce.number().int().min(1).max(100_000),
    smsPerTerm: z.coerce.number().int().min(0).max(0).default(0),
  }),
  includedModules: nonEmptyStringArray.max(40),
  maxAddOns: z.coerce.number().int().min(0).max(50),
  overageAllowance: z.coerce.number().min(1).max(3),
  support: z.string().trim().min(2).max(120),
  highlights: nonEmptyStringArray.max(12),
});

export const pricingAddOnSchema = z.object({
  key: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(100),
  pricePerTerm: z.coerce.number().int().min(0).max(10_000_000),
  description: z.string().trim().min(2).max(240),
});

export const pricingCatalogSchema = z.object({
  version: z.literal(1).default(1),
  currency: z.literal("KES").default("KES"),
  termLabel: z.string().trim().min(2).max(40).default("term"),
  smsPolicy: z.string().trim().min(5).max(240).default("SMS is not included inside NEYO packages. Schools buy SMS as a separate top-up bundle."),
  plans: z.array(pricingPlanSchema).min(1).max(12).superRefine((plans, ctx) => {
    const seen = new Set<string>();
    for (const [index, plan] of plans.entries()) {
      if (seen.has(plan.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate plan key: ${plan.key}`, path: [index, "key"] });
      seen.add(plan.key);
      if (plan.limits.smsPerTerm !== 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SMS must stay outside packages. Use SMS top-up add-ons instead.", path: [index, "limits", "smsPerTerm"] });
      const hasSmsHighlight = plan.highlights.some((h) => /\bsms\b/i.test(h));
      if (hasSmsHighlight) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Package highlights cannot include SMS; SMS is a separate top-up.", path: [index, "highlights"] });
    }
  }),
  addOns: z.array(pricingAddOnSchema).min(1).max(30).superRefine((addOns, ctx) => {
    const seen = new Set<string>();
    for (const [index, addOn] of addOns.entries()) {
      if (seen.has(addOn.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate add-on key: ${addOn.key}`, path: [index, "key"] });
      seen.add(addOn.key);
    }
    if (!addOns.some((addOn) => /sms/i.test(`${addOn.key} ${addOn.name} ${addOn.description}`))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one SMS top-up add-on is required because SMS is outside packages.", path: ["addOns"] });
    }
  }),
});

export type PricingCatalog = z.infer<typeof pricingCatalogSchema>;

export function defaultPricingCatalog(): PricingCatalog {
  return pricingCatalogSchema.parse({
    version: 1,
    currency: "KES",
    termLabel: "term",
    smsPolicy: "SMS is not included inside NEYO packages. Schools buy SMS as a separate top-up bundle.",
    plans: PLANS.map((plan) => ({ ...plan, limits: { ...plan.limits, smsPerTerm: 0 } })),
    addOns: ADD_ONS,
  });
}

export async function getPricingCatalog(): Promise<PricingCatalog> {
  const setting = await db.platformSetting.findUnique({ where: { key: PRICING_CATALOG_SETTING_KEY } });
  if (!setting?.value) return defaultPricingCatalog();
  try {
    return pricingCatalogSchema.parse(JSON.parse(setting.value));
  } catch {
    return defaultPricingCatalog();
  }
}

export async function getPlanFromCatalog(key: string): Promise<PlanDef | undefined> {
  const catalog = await getPricingCatalog();
  return catalog.plans.find((plan) => plan.key === key) as PlanDef | undefined;
}

export async function listPlansFromCatalog(): Promise<PlanDef[]> {
  const catalog = await getPricingCatalog();
  return catalog.plans as PlanDef[];
}

export async function getAddOnFromCatalog(key: string): Promise<AddOnDef | undefined> {
  const catalog = await getPricingCatalog();
  return catalog.addOns.find((addOn) => addOn.key === key) as AddOnDef | undefined;
}

export async function savePricingCatalog(input: unknown, actor: { id: string; fullName: string; tenantId: string }) {
  const catalog = pricingCatalogSchema.parse(input);
  const setting = await db.platformSetting.upsert({
    where: { key: PRICING_CATALOG_SETTING_KEY },
    create: { key: PRICING_CATALOG_SETTING_KEY, value: JSON.stringify(catalog), updatedBy: actor.fullName },
    update: { value: JSON.stringify(catalog), updatedBy: actor.fullName },
  });

  await db.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "platform.pricing_catalog_updated",
      entityType: "PlatformSetting",
      entityId: setting.key,
      metadata: JSON.stringify({
        planKeys: catalog.plans.map((plan) => plan.key),
        addOnKeys: catalog.addOns.map((addOn) => addOn.key),
        smsOutsidePackages: catalog.plans.every((plan) => plan.limits.smsPerTerm === 0),
      }),
    },
  });

  return catalog;
}
