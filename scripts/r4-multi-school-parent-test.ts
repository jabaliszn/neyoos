/**
 * R.4 — Multi-School Parent Accounts, full-stack test.
 *
 * Founder's real scenario: one parent has children at TWO DIFFERENT NEYO
 * schools (Karibu High and Uhuru Academy — both real seeded tenants). Today
 * these are two completely separate, disconnected PARENT accounts. This
 * proves the real, OTP-verified linking + one-click switching works without
 * ever merging the underlying tenant-scoped accounts, and that switching is
 * genuinely restricted to real, verified links — never an arbitrary user ID.
 */
import { db } from "../src/lib/db";
import {
  myLinkedSchools,
  startSchoolLink,
  confirmSchoolLink,
  switchToLinkedSchool,
  unlinkSchool,
} from "../src/lib/services/multi-school.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  \u2713 ${message}`);
}
async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error(`FAILED: ${label} — expected an error, but it succeeded`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("FAILED:")) throw e;
    console.log(`  \u2713 ${label} (got: ${e instanceof Error ? e.message : String(e)})`);
  }
}
function extractOtpFromCode(codeHash: string) { return codeHash; }

async function main() {
  console.log("R.4 Multi-School Parent Accounts — full-stack test");

  const karibuTenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const uhuruTenant = await db.tenant.findFirstOrThrow({ where: { slug: "uhuru-academy" } });

  const createdUserIds: string[] = [];
  const createdSessionTokens: string[] = [];
  const createdLinkIds: string[] = [];
  const createdOtpIds: string[] = [];

  try {
    // ---- Real setup: two genuinely separate PARENT accounts at two real
    // different schools, sharing the SAME real phone number (the same
    // person registered as a parent at both schools independently). ----
    const sharedPhone = `+2547${Date.now().toString().slice(-8)}`;
    const parentAtKaribu = await db.user.create({
      data: {
        tenantId: karibuTenant.id,
        neyoLoginId: `KH-TEST-${Date.now()}`,
        fullName: "Wambui Test Parent",
        phone: sharedPhone,
        email: `wambui.test.${Date.now()}@example.com`,
        role: "PARENT",
        isActive: true,
      },
    });
    createdUserIds.push(parentAtKaribu.id);

    const parentAtUhuru = await db.user.create({
      data: {
        tenantId: uhuruTenant.id,
        neyoLoginId: `UA-TEST-${Date.now()}`,
        fullName: "Wambui Test Parent",
        phone: sharedPhone,
        email: `wambui.test2.${Date.now()}@example.com`,
        role: "PARENT",
        isActive: true,
      },
    });
    createdUserIds.push(parentAtUhuru.id);

    // A real session for the Karibu account, exactly as a real login would create.
    const sessionToken = `r4test-${Date.now()}`;
    await db.session.create({
      data: { token: sessionToken, userId: parentAtKaribu.id, expiresAt: new Date(Date.now() + 3600_000) },
    });
    createdSessionTokens.push(sessionToken);

    // ---- Before linking: only the current school shows up. ----
    const before = await myLinkedSchools(parentAtKaribu.id);
    assert(before.length === 1, "before linking: only the CURRENT school appears in the switcher list");
    assert(before[0].tenantSlug === "karibu-high", "before linking: the one entry is genuinely Karibu High");

    // ---- Step 1: start the link (real OTP sent to the Uhuru phone). ----
    const startResult = await startSchoolLink(parentAtKaribu.id, sharedPhone);
    assert(startResult.ok === true, "startSchoolLink sends a real OTP and returns ok:true");
    assert(typeof startResult.devCode === "string" && /^\d{6}$/.test(startResult.devCode!), "a real 6-digit dev OTP code was generated (dev-mode visibility only)");

    const otpRow = await db.otpCode.findFirstOrThrow({ where: { phone: sharedPhone, purpose: "LINK_SCHOOL" }, orderBy: { createdAt: "desc" } });
    createdOtpIds.push(otpRow.id);
    assert(otpRow.userId === parentAtUhuru.id, "the OTP is correctly bound to the REAL Uhuru parent account that owns this phone (not a guess)");

    // ---- Wrong code is rejected and increments attempts. ----
    await expectThrow(
      "confirmSchoolLink with the WRONG code is rejected",
      () => confirmSchoolLink(parentAtKaribu.id, sharedPhone, "000000")
    );
    const afterWrong = await db.otpCode.findUniqueOrThrow({ where: { id: otpRow.id } });
    assert(afterWrong.attempts === 1, "a wrong code genuinely increments the real attempts counter (not just client-side)");

    // ---- Self-link is rejected (linking a phone that resolves to your OWN account). ----
    const ownPhone = `+2547${(Date.now() + 1).toString().slice(-8)}`;
    await db.user.update({ where: { id: parentAtKaribu.id }, data: { phone: ownPhone } });
    const selfLinkStart = await startSchoolLink(parentAtKaribu.id, ownPhone);
    const selfOtpRow = await db.otpCode.findFirstOrThrow({ where: { phone: ownPhone, purpose: "LINK_SCHOOL" }, orderBy: { createdAt: "desc" } });
    createdOtpIds.push(selfOtpRow.id);
    await expectThrow(
      "confirmSchoolLink is rejected when the phone resolves to the ACTOR'S OWN account (no self-link)",
      () => confirmSchoolLink(parentAtKaribu.id, ownPhone, selfLinkStart.devCode!)
    );
    await db.user.update({ where: { id: parentAtKaribu.id }, data: { phone: sharedPhone } }); // restore for the rest of the test

    // ---- The REAL correct code succeeds and creates a genuine, verified link. ----
    const confirmResult = await confirmSchoolLink(parentAtKaribu.id, sharedPhone, startResult.devCode!);
    assert(confirmResult.linkedSchool.tenantSlug === "uhuru-academy", "confirmSchoolLink with the correct code genuinely links to Uhuru Academy");

    const linkRow = await db.linkedGuardianAccount.findFirstOrThrow({ where: { primaryUserId: parentAtKaribu.id, linkedUserId: parentAtUhuru.id } });
    createdLinkIds.push(linkRow.id);
    assert(!!linkRow.verifiedAt, "the real LinkedGuardianAccount row has a genuine verifiedAt timestamp — never created unverified");

    // ---- The SAME code cannot be reused (single-use, exactly like login OTP). ----
    await expectThrow(
      "the SAME OTP code cannot be reused a second time (already consumed)",
      () => confirmSchoolLink(parentAtKaribu.id, sharedPhone, startResult.devCode!)
    );

    // ---- After linking: BOTH schools now appear in the switcher, from EITHER side. ----
    const afterKaribu = await myLinkedSchools(parentAtKaribu.id);
    assert(afterKaribu.length === 2, "after linking: the switcher list from Karibu's side now shows BOTH real schools");
    assert(afterKaribu.some((s) => s.tenantSlug === "uhuru-academy"), "Uhuru Academy genuinely appears in Karibu's switcher list");

    const afterUhuru = await myLinkedSchools(parentAtUhuru.id);
    assert(afterUhuru.length === 2, "the link is genuinely bidirectional — Uhuru's OWN switcher list also shows both schools");
    assert(afterUhuru.some((s) => s.tenantSlug === "karibu-high"), "Karibu High genuinely appears in Uhuru's switcher list too");

    // ---- Re-linking the SAME two accounts again is a safe no-op (upsert), never a duplicate row. ----
    const startAgain = await startSchoolLink(parentAtKaribu.id, sharedPhone);
    const otpAgainRow = await db.otpCode.findFirstOrThrow({ where: { phone: sharedPhone, purpose: "LINK_SCHOOL", consumedAt: null }, orderBy: { createdAt: "desc" } });
    createdOtpIds.push(otpAgainRow.id);
    await confirmSchoolLink(parentAtKaribu.id, sharedPhone, startAgain.devCode!);
    const linkCountAfterRelink = await db.linkedGuardianAccount.count({ where: { primaryUserId: parentAtKaribu.id, linkedUserId: parentAtUhuru.id } });
    assert(linkCountAfterRelink === 1, "re-linking the SAME two already-linked accounts stays a safe no-op — no duplicate link row created");

    // ---- The REAL one-click switch: genuinely moves the session's userId. ----
    const switchResult = await switchToLinkedSchool(sessionToken, parentAtKaribu.id, parentAtUhuru.id);
    assert(switchResult.tenantSlug === "uhuru-academy", "switchToLinkedSchool returns the real target school's data");
    const sessionAfterSwitch = await db.session.findUniqueOrThrow({ where: { token: sessionToken } });
    assert(sessionAfterSwitch.userId === parentAtUhuru.id, "the REAL session row's userId is genuinely updated to the target account — this is a real server-side switch, not a client-side pretend");

    // ---- Switching back works too (bidirectional, no re-auth needed — the founder's explicit choice). ----
    const switchBack = await switchToLinkedSchool(sessionToken, parentAtUhuru.id, parentAtKaribu.id);
    assert(switchBack.tenantSlug === "karibu-high", "switching back to the original school succeeds with no re-authentication needed");

    // ---- A genuinely UN-linked account cannot be switched to. ----
    const randomOtherUser = await db.user.create({
      data: {
        tenantId: uhuruTenant.id,
        neyoLoginId: `UA-TEST2-${Date.now()}`,
        fullName: "Not Linked Parent",
        phone: `+2547${(Date.now() + 2).toString().slice(-8)}`,
        role: "PARENT",
        isActive: true,
      },
    });
    createdUserIds.push(randomOtherUser.id);
    await expectThrow(
      "switchToLinkedSchool is rejected for an account that was NEVER linked (not just any user ID the client sends)",
      () => switchToLinkedSchool(sessionToken, parentAtKaribu.id, randomOtherUser.id)
    );

    // ---- Unlinking removes the real row and the switcher list shrinks again, from BOTH sides. ----
    await unlinkSchool(parentAtKaribu.id, parentAtUhuru.id);
    const afterUnlinkKaribu = await myLinkedSchools(parentAtKaribu.id);
    assert(afterUnlinkKaribu.length === 1, "after unlinking: Karibu's switcher list is back down to just their own school");
    const afterUnlinkUhuru = await myLinkedSchools(parentAtUhuru.id);
    assert(afterUnlinkUhuru.length === 1, "after unlinking: Uhuru's switcher list is ALSO back down to just their own school (mutual removal, not one-sided)");

    await expectThrow(
      "after unlinking, switchToLinkedSchool is rejected again for the now-removed link",
      () => switchToLinkedSchool(sessionToken, parentAtKaribu.id, parentAtUhuru.id)
    );

    console.log("\n\u2705 R.4 Multi-School Parent Accounts test passed");
  } finally {
    if (createdSessionTokens.length) await db.session.deleteMany({ where: { token: { in: createdSessionTokens } } });
    if (createdLinkIds.length) await db.linkedGuardianAccount.deleteMany({ where: { id: { in: createdLinkIds } } });
    // Also delete any link rows created via re-link/upsert during the test that weren't tracked above.
    await db.linkedGuardianAccount.deleteMany({ where: { OR: createdUserIds.map((id) => ({ primaryUserId: id })) } });
    await db.linkedGuardianAccount.deleteMany({ where: { OR: createdUserIds.map((id) => ({ linkedUserId: id })) } });
    if (createdOtpIds.length) await db.otpCode.deleteMany({ where: { id: { in: createdOtpIds } } });
    if (createdUserIds.length) await db.user.deleteMany({ where: { id: { in: createdUserIds } } });

    const remainingUsers = await db.user.count({ where: { id: { in: createdUserIds } } });
    const remainingLinks = await db.linkedGuardianAccount.count({ where: { OR: [...createdUserIds.map((id) => ({ primaryUserId: id })), ...createdUserIds.map((id) => ({ linkedUserId: id }))] } });
    const remainingSessions = await db.session.count({ where: { token: { in: createdSessionTokens } } });
    if (remainingUsers > 0 || remainingLinks > 0 || remainingSessions > 0) {
      throw new Error("CLEANUP FAILED: some test rows were not actually removed (re-queried DB directly)");
    }
    console.log("  cleanup \u2713 (test users, sessions, links, OTP codes removed — confirmed via direct DB re-query)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
