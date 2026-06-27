import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import {
  createCurriculum,
  createEducationLevel,
  createGradeBand,
  createLearningArea,
  curriculumBoard,
  CurriculumError,
  mapExistingCurriculumRecords,
  updateCurriculum,
} from "../src/lib/services/curriculum.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function expectCurriculumError(code: CurriculumError["code"], fn: () => Promise<unknown>, message: string) {
  try {
    await fn();
  } catch (error) {
    assert(error instanceof CurriculumError && error.code === code, message);
    return;
  }
  throw new Error(`Expected CurriculumError ${code}: ${message}`);
}

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    neyoLoginId: user.neyoLoginId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role as SessionUser["role"],
    secondaryRole: (user.secondaryRole as SessionUser["secondaryRole"]) ?? null,
    language: user.language ?? "en",
  };
}

async function cleanup(tenantId: string) {
  const curricula = await db.curriculum.findMany({ where: { tenantId, name: { startsWith: "J2 Service" } }, select: { id: true } });
  const ids = curricula.map((c) => c.id);
  if (ids.length) {
    await db.subject.updateMany({ where: { tenantId, curriculumId: { in: ids } }, data: { curriculumId: null, learningAreaId: null } });
    await db.schoolClass.updateMany({ where: { tenantId, curriculumId: { in: ids } }, data: { curriculumId: null, gradeBandId: null } });
    await db.academicTerm.updateMany({ where: { tenantId, curriculumId: { in: ids } }, data: { curriculumId: null } });
    await db.cbcStrand.updateMany({ where: { tenantId, learningArea: { curriculumId: { in: ids } } }, data: { learningAreaId: null } });
    await db.curriculum.deleteMany({ where: { tenantId, id: { in: ids } } });
  }
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const [principalRow, teacherRow, bursarRow] = await Promise.all([
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "p.njoroge@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "bursar@karibuhigh.ac.ke" } }),
  ]);
  const principal = toSessionUser(principalRow);
  const teacher = toSessionUser(teacherRow);
  const bursar = toSessionUser(bursarRow);

  await cleanup(tenant.id);

  const curriculum = await createCurriculum(principal, {
    name: "J2 Service CBC Kenya",
    country: "Kenya",
    context: "Future-proof junior and senior school",
    activeVersion: "2026",
    effectiveFrom: "2026-01-01",
    isActive: true,
    notes: "Service test curriculum.",
  });
  assert(curriculum.tenantId === tenant.id && curriculum.name === "J2 Service CBC Kenya", "service creates Curriculum with real tenant DB row");

  await expectCurriculumError("DUPLICATE", () => createCurriculum(principal, {
    name: "J2 Service CBC Kenya",
    country: "Kenya",
    activeVersion: "2026",
    isActive: true,
  }), "duplicate curriculum name/version is blocked gracefully");

  const updated = await updateCurriculum(principal, { id: curriculum.id, context: "Updated configurable Education OS", activeVersion: "2026" });
  assert(updated.context === "Updated configurable Education OS", "service updates Curriculum through validation");

  const level = await createEducationLevel(principal, {
    curriculumId: curriculum.id,
    name: "Junior School",
    levelKey: "junior",
    sequence: 3,
    description: "Grades 7 to 9",
  });
  assert(level.curriculumId === curriculum.id, "service creates EducationLevel linked to Curriculum");

  await expectCurriculumError("DUPLICATE", () => createEducationLevel(principal, {
    curriculumId: curriculum.id,
    name: "Junior School",
    levelKey: "junior",
    sequence: 4,
  }), "duplicate EducationLevel in a curriculum is blocked gracefully");

  const grade = await createGradeBand(principal, {
    curriculumId: curriculum.id,
    educationLevelId: level.id,
    name: "Year 9",
    shortName: "Y9",
    sequence: 9,
    entryAge: 13,
    exitAge: 14,
  });
  assert(grade.name === "Year 9" && grade.educationLevelId === level.id, "service creates custom GradeBand names like Year 9");

  const learningArea = await createLearningArea(principal, {
    curriculumId: curriculum.id,
    name: "Mathematics",
    code: "mat",
    description: "Mathematics learning area",
  });
  assert(learningArea.code === "MAT", "service creates LearningArea with normalized code");

  const [subject, schoolClass, term, strand] = await Promise.all([
    db.subject.findFirstOrThrow({ where: { tenantId: tenant.id } }),
    db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id } }),
    db.academicTerm.findFirstOrThrow({ where: { tenantId: tenant.id } }),
    db.cbcStrand.findFirst({ where: { tenantId: tenant.id } }),
  ]);

  const result = await mapExistingCurriculumRecords(principal, {
    subjects: [{ subjectId: subject.id, learningAreaId: learningArea.id }],
    classes: [{ classId: schoolClass.id, gradeBandId: grade.id }],
    terms: [{ termId: term.id, curriculumId: curriculum.id }],
    strands: strand ? [{ strandId: strand.id, learningAreaId: learningArea.id }] : [],
  });
  assert(result.subjects === 1 && result.classes === 1 && result.terms === 1, "service maps existing Subject/Class/Term rows without replacing them");

  const [mappedSubject, mappedClass, mappedTerm, mappedStrand] = await Promise.all([
    db.subject.findUniqueOrThrow({ where: { id: subject.id } }),
    db.schoolClass.findUniqueOrThrow({ where: { id: schoolClass.id } }),
    db.academicTerm.findUniqueOrThrow({ where: { id: term.id } }),
    strand ? db.cbcStrand.findUnique({ where: { id: strand.id } }) : Promise.resolve(null),
  ]);
  assert(mappedSubject.curriculumId === curriculum.id && mappedSubject.learningAreaId === learningArea.id, "Subject stores Curriculum + LearningArea mapping");
  assert(mappedClass.curriculumId === curriculum.id && mappedClass.gradeBandId === grade.id, "SchoolClass stores Curriculum + GradeBand mapping");
  assert(mappedTerm.curriculumId === curriculum.id, "AcademicTerm stores Curriculum mapping");
  if (strand) assert(mappedStrand?.learningAreaId === learningArea.id, "CBC strand stores LearningArea mapping");

  const board = await curriculumBoard(principal);
  assert(board.canManage && board.curricula.some((c) => c.id === curriculum.id), "curriculumBoard returns created curriculum and manage flag for principal");

  const teacherBoard = await curriculumBoard(teacher);
  assert(!teacherBoard.canManage, "teacher can read curriculum board but cannot manage it");

  await expectCurriculumError("FORBIDDEN", () => curriculumBoard(bursar), "bursar cannot access curriculum setup board");
  await expectCurriculumError("FORBIDDEN", () => createLearningArea(teacher, { curriculumId: curriculum.id, name: "Science", code: "SCI" }), "teacher cannot mutate curriculum setup");

  const audits = await db.auditLog.findMany({
    where: { tenantId: tenant.id, action: { in: ["curriculum.created", "curriculum.level_created", "curriculum.grade_band_created", "curriculum.learning_area_created", "curriculum.mappings_updated"] } },
  });
  assert(audits.length >= 5, "service writes audit logs for curriculum changes");

  await cleanup(tenant.id);
  console.log("\nJ.2 Chunk 3 curriculum service test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
