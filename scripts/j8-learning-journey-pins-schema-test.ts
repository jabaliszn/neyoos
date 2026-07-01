import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const tenant = await prisma.tenant.create({
    data: {
      name: "J.8 Pins Test School",
      slug: `j8-pins-${Date.now()}`,
      osKey: "school",
    },
  });

  const student = await prisma.student.create({
    data: {
      tenantId: tenant.id,
      admissionNo: `PIN-${Date.now()}`,
      firstName: "Akinyi",
      lastName: "Odhiambo",
      gender: "F",
      status: "ACTIVE",
      boardingType: "DAY",
    },
  });

  const pin = await prisma.learnerJourneyPin.create({
    data: {
      tenantId: tenant.id,
      studentId: student.id,
      sourceModule: "ASSESSMENT",
      sourceRecordId: "assessment-record-1",
      entryId: "journey-entry-1",
      note: "Important turnaround moment",
      visibility: "STAFF",
      pinnedById: "user-principal-1",
      pinnedByName: "Wanjiru Kamau",
    },
  });

  assert(pin.entryId === "journey-entry-1", "Pin should store stable journey entry id.");
  assert(pin.sourceModule === "ASSESSMENT", "Pin should store source module.");
  assert(pin.visibility === "STAFF", "Pin should keep visibility.");
  assert(pin.pinnedAt instanceof Date, "Pin should timestamp when it was pinned.");

  const fetched = await prisma.learnerJourneyPin.findUnique({
    where: { tenantId_studentId_entryId: { tenantId: tenant.id, studentId: student.id, entryId: "journey-entry-1" } },
    include: { tenant: true, student: true },
  });

  assert(fetched?.tenant.id === tenant.id, "Pin should belong to the tenant.");
  assert(fetched?.student.id === student.id, "Pin should belong to the learner.");

  let uniqueBlocked = false;
  try {
    await prisma.learnerJourneyPin.create({
      data: {
        tenantId: tenant.id,
        studentId: student.id,
        sourceModule: "ASSESSMENT",
        entryId: "journey-entry-1",
        visibility: "STAFF",
        pinnedById: "user-principal-2",
        pinnedByName: "Deputy Njoroge",
      },
    });
  } catch {
    uniqueBlocked = true;
  }
  assert(uniqueBlocked, "Duplicate pin for the same learner journey entry must be blocked.");

  await prisma.learnerJourneyPin.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.student.delete({ where: { id: student.id } });
  await prisma.tenant.delete({ where: { id: tenant.id } });

  console.log("J.8 pinned milestones schema test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
