import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/core/session";
import { ok, handleError, fail } from "@/lib/api/respond";
import { db } from "@/lib/db";
import {
  neyoBuildLogSchema,
  neyoMetricSnapshotSchema,
  neyoFounderOpsEntrySchema,
  neyoCustomerInterviewSchema,
  founderOpsListQuerySchema,
  founderOpsIdSchema,
} from "@/lib/validations/founder-ops";
import { getPricingCatalog, savePricingCatalog } from "@/lib/services/pricing-catalog.service";
import { getLandingContent, saveLandingContent } from "@/lib/services/landing-content.service";
import { getGoogleWorkspaceStorageConfig, saveGoogleWorkspaceStorageConfig, provisionGoogleWorkspaceVault, googleWorkspaceStorageConfigSchema } from "@/lib/services/google-workspace-storage.service";
import { listIntegrationCredentialStatuses, saveIntegrationCredential, integrationCredentialSaveSchema } from "@/lib/services/integration-credentials.service";
import { runSubscriptionStateMachine } from "@/lib/services/billing.service";
import { listNeyoYoutubePosts, upsertNeyoYoutubePost, updateNeyoYoutubePostStatus, deleteNeyoYoutubePost, neyoYoutubePostSchema, neyoYoutubeStatusSchema } from "@/lib/services/neyo-youtube.service";
import { listNeyoContracts, upsertNeyoContract, updateNeyoContractStatus, deleteNeyoContract, neyoContractSchema, neyoContractStatusSchema } from "@/lib/services/neyo-contract.service";
import { listCustomerThreads, addCustomerThreadMessage, updateCustomerThreadStatus, customerReplySchema, customerThreadStatusSchema } from "@/lib/services/neyo-customer-hub.service";
import {
  founderOpsDashboard,
  listBuildLogs,
  upsertBuildLog,
  deleteBuildLog,
  listMetricSnapshots,
  upsertMetricSnapshot,
  deleteMetricSnapshot,
  listFounderOpsEntries,
  upsertFounderOpsEntry,
  deleteFounderOpsEntry,
  listCustomerInterviews,
  createCustomerInterview,
  updateCustomerInterview,
  deleteCustomerInterview,
} from "@/lib/services/founder-ops.service";

export const dynamic = "force-dynamic";

const viewSchema = z.enum(["dashboard", "build_logs", "metrics", "entries", "interviews", "settings"]);
const actionSchema = z.object({
  action: z.enum([
    "upsert_build_log",
    "delete_build_log",
    "upsert_metric",
    "delete_metric",
    "upsert_entry",
    "delete_entry",
    "create_interview",
    "update_interview",
    "delete_interview",
    "update_platform_setting",
    "update_school_subscription",
    "run_billing_enforcement",
    "send_broadcast",
    "update_pricing_catalog",
    "update_landing_content",
    "update_google_workspace_storage_config",
    "provision_google_workspace_storage_vault",
    "save_integration_credential",
    "upsert_youtube_post",
    "update_youtube_post_status",
    "delete_youtube_post",
    "upsert_contract",
    "update_contract_status",
    "delete_contract",
    "reply_customer_thread",
    "update_customer_thread_status",
    "create_idea",
    "update_idea",
  ]),
  id: z.string().optional(),
  data: z.unknown().optional(),
});

function parseId(id: string | undefined) {
  return founderOpsIdSchema.parse({ id }).id;
}

/**
 * GET /api/founder-ops
 * NEYO company internal ops. SUPER_ADMIN only.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN");
    const url = new URL(req.url);
    const view = viewSchema.parse(url.searchParams.get("view") || "dashboard");
    const limit = Number(url.searchParams.get("limit") || 50);

    if (view === "dashboard") return ok({ dashboard: await founderOpsDashboard() });
    if (view === "build_logs") return ok({ buildLogs: await listBuildLogs(limit) });
    if (view === "metrics") return ok({ metrics: await listMetricSnapshots(limit) });
    
    if (view === "settings") {
      // Retrieve Platform settings (maintenance switches, legal copy, tier pricing)
      const settings = await db.platformSetting.findMany({
        orderBy: { key: "asc" },
      });
      // Retrieve all registered school accounts and active subscription plans
      const schools = await db.tenant.findMany({
        include: {
          subscription: true,
        },
        orderBy: { onboardedAt: "desc" },
      });
      // Retrieve NEYO Waitlist and Demo Requests (G.22/G.31 integration)
      const waitlist = await db.neyoFounderOpsEntry.findMany({
        where: { kind: "WAITLIST" },
        orderBy: { createdAt: "desc" },
      });
      const subscriptionPayments = await db.subscriptionPayment.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
      const paymentSummary = {
        totalKes: subscriptionPayments.reduce((sum, p) => sum + p.amount, 0),
        paidKes: subscriptionPayments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0),
        pendingKes: subscriptionPayments.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + p.amount, 0),
        failedKes: subscriptionPayments.filter((p) => p.status === "FAILED").reduce((sum, p) => sum + p.amount, 0),
        count: subscriptionPayments.length,
        recent: subscriptionPayments.slice(0, 8).map((p) => ({ id: p.id, tenantId: p.tenantId, amount: p.amount, status: p.status, method: p.method, mpesaRef: p.mpesaRef, createdAt: p.createdAt })),
      };
      const graceNow = new Date();
      const graceWarningCutoff = new Date(graceNow.getTime() + 3 * 24 * 3600_000);
      const graceSummary = {
        graceCount: schools.filter((school) => school.subscription?.status === "GRACE").length,
        graceEndingSoon: schools.filter((school) => school.subscription?.status === "GRACE" && school.subscription?.graceEndsAt && school.subscription.graceEndsAt <= graceWarningCutoff).length,
        suspendedCount: schools.filter((school) => school.subscription?.status === "SUSPENDED").length,
        expiredGraceCount: schools.filter((school) => school.subscription?.status === "GRACE" && school.subscription?.graceEndsAt && school.subscription.graceEndsAt < graceNow).length,
      };
      const neyoStaff = await db.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true, fullName: true, email: true, phone: true, createdAt: true } });
      const ideas = await db.neyoIdea.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }], take: 100 });
      const youtubePosts = await listNeyoYoutubePosts();
      const contracts = await listNeyoContracts();
      const customerThreads = await listCustomerThreads();
      const pricingCatalog = await getPricingCatalog();
      const landingContent = await getLandingContent();
      const googleWorkspaceStorage = await getGoogleWorkspaceStorageConfig();
      const integrationCredentials = await listIntegrationCredentialStatuses();
      return ok({ settings, schools, waitlist, paymentSummary, graceSummary, neyoStaff, ideas, youtubePosts, contracts, customerThreads, pricingCatalog, landingContent, googleWorkspaceStorage, integrationCredentials });
    }

    if (view === "entries") {
      const query = founderOpsListQuerySchema.parse({
        kind: url.searchParams.get("kind") || undefined,
        status: url.searchParams.get("status") || undefined,
        limit,
      });
      return ok({ entries: await listFounderOpsEntries(query) });
    }
    if (view === "interviews") {
      return ok({ interviews: await listCustomerInterviews(limit, url.searchParams.get("status") || undefined) });
    }

    return ok({ dashboard: await founderOpsDashboard() });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/founder-ops — mutate NEYO company ops records. SUPER_ADMIN only. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const body = actionSchema.parse(await req.json().catch(() => ({})));

    switch (body.action) {
      case "upsert_build_log":
        return ok({ buildLog: await upsertBuildLog(user, neyoBuildLogSchema.parse(body.data)) });
      case "delete_build_log":
        return ok(await deleteBuildLog(parseId(body.id)));

      case "upsert_metric":
        return ok({ metric: await upsertMetricSnapshot(user, neyoMetricSnapshotSchema.parse(body.data)) });
      case "delete_metric":
        return ok(await deleteMetricSnapshot(parseId(body.id)));

      case "upsert_entry":
        return ok({ entry: await upsertFounderOpsEntry(user, neyoFounderOpsEntrySchema.parse(body.data)) });
      case "delete_entry":
        return ok(await deleteFounderOpsEntry(parseId(body.id)));

      case "create_interview":
        return ok({ interview: await createCustomerInterview(user, neyoCustomerInterviewSchema.parse(body.data)) }, 201);
      case "update_interview":
        return ok({ interview: await updateCustomerInterview(parseId(body.id), neyoCustomerInterviewSchema.parse(body.data)) });
      case "delete_interview":
        return ok(await deleteCustomerInterview(parseId(body.id)));

      case "update_platform_setting": {
        const inputSetting = z.object({
          key: z.string().min(1),
          value: z.string(),
        }).parse(body.data);

        const updated = await db.platformSetting.upsert({
          where: { key: inputSetting.key },
          create: { key: inputSetting.key, value: inputSetting.value, updatedBy: user.fullName },
          update: { value: inputSetting.value, updatedBy: user.fullName },
        });

        // Audit Log Entry
        await db.auditLog.create({
          data: {
            tenantId: user.tenantId,
            actorId: user.id,
            actorName: user.fullName,
            action: "platform.setting_updated",
            entityType: "PlatformSetting",
            entityId: updated.key,
            metadata: JSON.stringify({ key: inputSetting.key, valueLength: inputSetting.value.length }),
          },
        });

        return ok({ success: true, setting: updated });
      }

      case "run_billing_enforcement": {
        const changed = await runSubscriptionStateMachine();
        await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "platform.billing_enforcement_run", entityType: "Subscription", metadata: JSON.stringify({ changed }) } });
        return ok({ success: true, changed });
      }

      case "update_school_subscription": {
        const inputSub = z.object({
          tenantId: z.string().min(1),
          planKey: z.string(),
          status: z.string(),
          grandfatheredPrice: z.coerce.number().int(),
          gracePeriodDays: z.coerce.number().int(),
        }).parse(body.data);

        // Calculate grace period expiration if status is "GRACE"
        const graceEndsAt = inputSub.status === "GRACE"
          ? new Date(Date.now() + inputSub.gracePeriodDays * 24 * 3600_000)
          : null;

        const updatedSub = await db.subscription.upsert({
          where: { tenantId: inputSub.tenantId },
          create: {
            tenantId: inputSub.tenantId,
            planKey: inputSub.planKey,
            status: inputSub.status,
            grandfatheredPrice: inputSub.grandfatheredPrice,
            currentPeriodEnd: new Date(Date.now() + 120 * 24 * 3600_000), // Default 120-day term limits
            graceEndsAt,
          },
          update: {
            planKey: inputSub.planKey,
            status: inputSub.status,
            grandfatheredPrice: inputSub.grandfatheredPrice,
            graceEndsAt,
          },
        });

        // Audit Log Entry
        await db.auditLog.create({
          data: {
            tenantId: user.tenantId,
            actorId: user.id,
            actorName: user.fullName,
            action: "platform.subscription_override",
            entityType: "Subscription",
            entityId: updatedSub.id,
            metadata: JSON.stringify({ ...inputSub, graceEndsAt }),
          },
        });

        return ok({ success: true, subscription: updatedSub });
      }


      case "update_pricing_catalog": {
        const pricingCatalog = await savePricingCatalog(body.data, { id: user.id, fullName: user.fullName, tenantId: user.tenantId });
        return ok({ success: true, pricingCatalog });
      }

      case "update_landing_content": {
        const landingContent = await saveLandingContent(body.data, { id: user.id, fullName: user.fullName, tenantId: user.tenantId });
        return ok({ success: true, landingContent });
      }

      case "update_google_workspace_storage_config": {
        const googleWorkspaceStorage = await saveGoogleWorkspaceStorageConfig(user, googleWorkspaceStorageConfigSchema.parse(body.data));
        return ok({ success: true, googleWorkspaceStorage });
      }

      case "provision_google_workspace_storage_vault": {
        const input = z.object({ tenantId: z.string().min(1) }).parse(body.data);
        const provider = await provisionGoogleWorkspaceVault(user, input.tenantId);
        return ok({ success: true, provider });
      }

      case "save_integration_credential": {
        const credential = await saveIntegrationCredential(user, integrationCredentialSaveSchema.parse(body.data));
        return ok({ success: true, credential });
      }

      case "upsert_youtube_post": {
        const id = body.id ? parseId(body.id) : undefined;
        const post = await upsertNeyoYoutubePost(user, neyoYoutubePostSchema.parse(body.data), id);
        return ok({ post }, id ? 200 : 201);
      }

      case "update_youtube_post_status": {
        const post = await updateNeyoYoutubePostStatus(user, neyoYoutubeStatusSchema.parse(body.data));
        return ok({ post });
      }

      case "delete_youtube_post": {
        return ok(await deleteNeyoYoutubePost(user, parseId(body.id)));
      }

      case "upsert_contract": {
        const id = body.id ? parseId(body.id) : undefined;
        const contract = await upsertNeyoContract(user, neyoContractSchema.parse(body.data), id);
        return ok({ contract }, id ? 200 : 201);
      }

      case "update_contract_status": {
        const contract = await updateNeyoContractStatus(user, neyoContractStatusSchema.parse(body.data));
        return ok({ contract });
      }

      case "delete_contract": {
        return ok(await deleteNeyoContract(user, parseId(body.id)));
      }

      case "reply_customer_thread": {
        const message = await addCustomerThreadMessage({ id: user.id, fullName: user.fullName, role: user.role, tenantId: user.tenantId }, customerReplySchema.parse({ ...(body.data as any), direction: "NEYO" }));
        return ok({ message }, 201);
      }

      case "update_customer_thread_status": {
        const thread = await updateCustomerThreadStatus(user, customerThreadStatusSchema.parse(body.data));
        return ok({ thread });
      }

      case "create_idea": {
        const inputIdea = z.object({
          title: z.string().trim().min(3).max(160),
          description: z.string().trim().max(1000).optional(),
          priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
          ownerName: z.string().trim().max(100).optional(),
          linkedFeatureKey: z.string().trim().max(40).optional(),
        }).parse(body.data);
        const idea = await db.neyoIdea.create({ data: { ...inputIdea, createdById: user.id, createdByName: user.fullName } });
        await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "platform.idea_created", entityType: "NeyoIdea", entityId: idea.id, metadata: JSON.stringify({ title: idea.title, priority: idea.priority }) } });
        return ok({ idea }, 201);
      }

      case "update_idea": {
        const inputIdea = z.object({
          id: z.string().min(1),
          status: z.enum(["IDEA", "PLANNED", "BUILDING", "SHIPPED", "PARKED"]),
        }).parse(body.data);
        const idea = await db.neyoIdea.update({ where: { id: inputIdea.id }, data: { status: inputIdea.status } });
        await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "platform.idea_status_updated", entityType: "NeyoIdea", entityId: idea.id, metadata: JSON.stringify({ status: idea.status }) } });
        return ok({ idea });
      }

      case "send_broadcast": {
        const inputBroadcast = z.object({
          message: z.string().min(1),
          segment: z.enum(["all", "active", "trial", "past_due", "grace", "suspended"]).default("all"),
        }).parse(body.data);

        const { sendSms } = await import("@/lib/notifications/sms");
        const { createInApp } = await import("@/lib/services/notification.service");

        const tenants = await db.tenant.findMany({ include: { subscription: true }, orderBy: { name: "asc" } });
        const activeTenants = tenants.filter((tenant) => {
          const status = tenant.subscription?.status ?? "ACTIVE";
          if (inputBroadcast.segment === "all") return true;
          if (inputBroadcast.segment === "active") return status === "ACTIVE";
          if (inputBroadcast.segment === "trial") return tenant.subscription?.planKey === "free_karibu";
          if (inputBroadcast.segment === "past_due") return status === "PAST_DUE";
          if (inputBroadcast.segment === "grace") return status === "GRACE";
          if (inputBroadcast.segment === "suspended") return status === "SUSPENDED";
          return true;
        });

        let sentSms = 0;
        let sentInApp = 0;
        let skippedSms = 0;
        for (const tenant of activeTenants) {
          const recipients = await db.user.findMany({
            where: {
              tenantId: tenant.id,
              isActive: true,
              OR: [
                { role: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } },
                { secondaryRole: { in: ["SCHOOL_OWNER", "PRINCIPAL"] } },
              ],
            },
            select: { id: true },
          });
          for (const recipient of recipients) {
            await createInApp({
              tenantId: tenant.id,
              recipientId: recipient.id,
              title: "Message from NEYO",
              body: inputBroadcast.message,
              category: "system",
              href: "/dashboard",
            });
            sentInApp++;
          }
          if (tenant.phone) {
            const sms = await sendSms(tenant.phone, `NEYO: ${inputBroadcast.message}`);
            if (sms.ok) sentSms++; else skippedSms++;
          } else {
            skippedSms++;
          }
        }

        await db.auditLog.create({
          data: {
            tenantId: user.tenantId,
            actorId: user.id,
            actorName: user.fullName,
            action: "platform.subscriber_broadcast_sent",
            entityType: "PlatformSetting",
            metadata: JSON.stringify({ messageLength: inputBroadcast.message.length, segment: inputBroadcast.segment, tenantCount: activeTenants.length, sentSms, sentInApp, skippedSms }),
          },
        });

        return ok({ success: true, count: activeTenants.length, sentSms, sentInApp, skippedSms });
      }
    }
  } catch (err) {
    return handleError(err);
  }
}
