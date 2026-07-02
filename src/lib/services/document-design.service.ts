import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";

export type DocumentDesign = {
  idCardWidthMm: number;
  idCardHeightMm: number;
  idTemplate: "emerald" | "frost" | "navy";
  documentTemplate: "classic" | "modern" | "compact";
  smallTimetableLogo: boolean;
  poweredByNeyo: boolean;
  /** N.1 — overlay the real G.25 digital school stamp on printed ID cards. */
  idStampEnabled: boolean;
};

export const DEFAULT_DOCUMENT_DESIGN: DocumentDesign = {
  idCardWidthMm: 74,
  idCardHeightMm: 105,
  idTemplate: "emerald",
  documentTemplate: "modern",
  smallTimetableLogo: true,
  poweredByNeyo: true,
  idStampEnabled: false,
};

function normalize(input: Partial<DocumentDesign> | null | undefined): DocumentDesign {
  return {
    idCardWidthMm: Math.max(45, Math.min(120, Math.trunc(input?.idCardWidthMm ?? DEFAULT_DOCUMENT_DESIGN.idCardWidthMm))),
    idCardHeightMm: Math.max(45, Math.min(160, Math.trunc(input?.idCardHeightMm ?? DEFAULT_DOCUMENT_DESIGN.idCardHeightMm))),
    idTemplate: ["emerald", "frost", "navy"].includes(input?.idTemplate ?? "") ? input!.idTemplate! : DEFAULT_DOCUMENT_DESIGN.idTemplate,
    documentTemplate: ["classic", "modern", "compact"].includes(input?.documentTemplate ?? "") ? input!.documentTemplate! : DEFAULT_DOCUMENT_DESIGN.documentTemplate,
    smallTimetableLogo: input?.smallTimetableLogo ?? true,
    poweredByNeyo: input?.poweredByNeyo ?? true,
    idStampEnabled: input?.idStampEnabled ?? DEFAULT_DOCUMENT_DESIGN.idStampEnabled,
  };
}


export async function getDocumentDesign(tenantId: string) {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { documentDesignJson: true } });
  try { return normalize(tenant.documentDesignJson ? JSON.parse(tenant.documentDesignJson) : null); } catch { return DEFAULT_DOCUMENT_DESIGN; }
}

export async function saveDocumentDesign(user: SessionUser, input: Partial<DocumentDesign>) {
  const design = normalize(input);
  await db.tenant.update({ where: { id: user.tenantId }, data: { documentDesignJson: JSON.stringify(design) } });
  await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "documents.design_updated", entityType: "tenant", entityId: user.tenantId, metadata: JSON.stringify(design) } });
  return design;
}
