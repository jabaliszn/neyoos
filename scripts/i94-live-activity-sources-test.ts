import { db } from "@/lib/db";

async function main() {
  const base = "http://localhost:3000";
  const login = await fetch(`${base}/api/auth/password/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "principal@karibuhigh.ac.ke", password: "Karibu2026!" }),
  });
  const cookie = login.headers.get("set-cookie")?.split(",").map((c) => c.split(";")[0]).join("; ") ?? "";
  if (!cookie) throw new Error("Login did not return cookies");
  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });

  const adm = `TEST-LIVE-${Date.now()}`;
  const payload = {
    source: "paste",
    rows: [
      ["Full Name", "Gender", "Class", "Admission No", "Guardian", "Phone"],
      ["Live Activity Test", "M", "Form 2 East", adm, "Test Guardian", "0712345678"],
    ],
    hasHeader: true,
    mapping: [
      { column: 0, field: "fullName" },
      { column: 1, field: "gender" },
      { column: 2, field: "className" },
      { column: 3, field: "admissionNo" },
      { column: 4, field: "guardianName" },
      { column: 5, field: "guardianPhone" },
    ],
    seedRequirements: false,
    skipInvalid: true,
  };

  const res = await fetch(`${base}/api/students/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message || "Import failed");
  console.log("  ✓ student import API completed");

  const notices = await db.notification.findMany({
    where: {
      recipientId: principal.id,
      title: { in: ["Student import running", "Student import complete"] },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (!notices.some((n) => n.title === "Student import running")) throw new Error("Missing running activity notification");
  if (!notices.some((n) => n.title === "Student import complete")) throw new Error("Missing complete activity notification");
  console.log("  ✓ student import emits running and complete live-activity notifications");

  const student = await db.student.findFirst({ where: { tenantId: principal.tenantId, admissionNo: adm } });
  if (student) {
    await db.studentGuardian.deleteMany({ where: { studentId: student.id } });
    await db.studentRequirement.deleteMany({ where: { studentId: student.id } });
    await db.student.delete({ where: { id: student.id } });
  }
  await db.notification.deleteMany({ where: { id: { in: notices.map((n) => n.id) } } });
  console.log("\n✅ I.94 live activity sources test passed");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => db.$disconnect());
