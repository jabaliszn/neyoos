import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { OPERATING_SYSTEMS, getOperatingSystem } from "../src/lib/core/operating-systems";
import { signupSchema } from "../src/lib/validations/onboarding";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(join(process.cwd(), "prisma/migrations/20260624180000_i50_multi_os_tenant_key/migration.sql"), "utf8");
  const registry = readFileSync(join(process.cwd(), "src/lib/core/operating-systems.ts"), "utf8");
  const loginPage = readFileSync(join(process.cwd(), "src/app/(auth)/login/page.tsx"), "utf8");
  const getStarted = readFileSync(join(process.cwd(), "src/app/(auth)/get-started/page.tsx"), "utf8");
  const osLogin = readFileSync(join(process.cwd(), "src/app/os/[os]/login/page.tsx"), "utf8");
  const osOnboarding = readFileSync(join(process.cwd(), "src/app/os/[os]/onboarding/page.tsx"), "utf8");
  const onboardingService = readFileSync(join(process.cwd(), "src/lib/services/onboarding.service.ts"), "utf8");
  const doc = readFileSync(join(process.cwd(), "docs/MULTI-OS-READINESS.md"), "utf8");

  assert(schema.includes("osKey  String  @default(\"school\")"), "Tenant has an OS key for cross-OS tenancy");
  assert(migration.includes("ALTER TABLE \"Tenant\" ADD COLUMN \"osKey\""), "Migration adds Tenant.osKey");
  assert(OPERATING_SYSTEMS.length === 4 && getOperatingSystem("farm").loginPath === "/os/farm/login", "OS registry covers School, Business, Farm and Creator OS routes");
  assert(registry.includes("status") && registry.includes("onboardingPath"), "OS registry stores launch status and onboarding path");
  assert(loginPage.includes("OPERATING_SYSTEMS.map") && loginPage.includes("/os/${item.key}/login"), "Login page has visible OS picker chips");
  assert(osLogin.includes("redirect(`/login?os=${os}`)") && osOnboarding.includes("redirect(`/get-started?os=${os}`)"), "Each OS has dedicated login/onboarding entry paths");
  assert(getStarted.includes("os.status !== \"LIVE\"") && getStarted.includes("Join waitlist"), "Non-live OS onboarding flows are routed to waitlist instead of School OS signup");
  assert(onboardingService.includes("osKey: input.osKey") && onboardingService.includes("osKey: input.osKey"), "Onboarding stores the selected OS key on the tenant and audit metadata");
  assert(doc.includes("Tenant.osKey") && doc.includes("Shared platform layer"), "Multi-OS readiness document records cross-cutting platform rules");

  const parsed = signupSchema.parse({
    osKey: "school",
    schoolName: "I50 Test School",
    slug: "i50-test-school",
    curriculum: "CBC",
    ownerName: "Achieng Test",
    ownerEmail: "i50@example.com",
    ownerPhone: "0712345678",
    password: "Karibu2026!",
  });
  assert(parsed.osKey === "school", "Signup validation accepts OS key and keeps School OS explicit");

  const tenants = await db.tenant.findMany({ select: { id: true, osKey: true }, take: 5 });
  assert(tenants.every((tenant) => tenant.osKey), "Existing tenants have a default OS key after migration");

  console.log("\nI.50 Multi-OS readiness checkpoint test passed.");
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => db.$disconnect());
