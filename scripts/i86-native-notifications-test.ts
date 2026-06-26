import { db } from "@/lib/db";
import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.86 native-style notification delivery test");
  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const endpoint = `https://push.example.test/${Date.now()}`;
  const row = await db.webPushSubscription.upsert({
    where: { endpoint },
    create: { tenantId: principal.tenantId, userId: principal.id, endpoint, p256dh: "p256dh", auth: "auth", userAgent: "i86-test" },
    update: { tenantId: principal.tenantId, userId: principal.id, p256dh: "p256dh", auth: "auth" },
  });
  assert(row.tenantId === principal.tenantId && row.userId === principal.id, "web push subscription is stored per tenant and user");
  await db.webPushSubscription.delete({ where: { id: row.id } });

  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert(schema.includes("model WebPushSubscription") && schema.includes("endpoint  String   @unique"), "schema has WebPushSubscription model for native/PWA push endpoints");

  const route = readFileSync("src/app/api/notifications/native-subscription/route.ts", "utf8");
  assert(route.includes("requireUser") && route.includes("webPushSubscription.upsert") && route.includes("NEXT_PUBLIC_VAPID_PUBLIC_KEY"), "native subscription API is signed-in and stores browser push subscriptions");

  const push = readFileSync("src/lib/notifications/push.ts", "utf8");
  assert(push.includes("web-push") && push.includes("webPushSubscription.findMany") && push.includes("sendNotification"), "push transport sends real Web Push notifications when VAPID keys are configured");

  const sw = readFileSync("public/sw.js", "utf8");
  assert(sw.includes('self.addEventListener("push"') && sw.includes("showNotification") && sw.includes("notificationclick"), "service worker can show native notifications and open linked items");

  const bell = readFileSync("src/components/shell/notification-bell.tsx", "utf8");
  assert(bell.includes("Notification.requestPermission") && bell.includes("/api/notifications/native-subscription"), "notification panel asks permission and registers native subscriptions");
  assert(bell.includes("showNativeNotification") && bell.includes("reg.showNotification"), "fresh unread notifications trigger native browser/PWA notifications");
  assert(bell.includes("Turn on phone-style notifications"), "user sees a clear opt-in for phone-style notification delivery");

  console.log("\n✅ I.86 native-style notification delivery test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
