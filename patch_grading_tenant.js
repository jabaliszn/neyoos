const fs = require('fs');
let code = fs.readFileSync('src/lib/services/grading-engine.service.ts', 'utf8');

if (!code.includes('import { withTenant }')) {
  code = code.replace('import { tenantDb } from "@/lib/core/tenant-db";', 'import { tenantDb } from "@/lib/core/tenant-db";\nimport { withTenant } from "@/lib/core/tenant-context";');
  
  // Wrap exports
  code = code.replace('export async function getSubjectPaperConfigs(user: SessionUser, subjectId: string, classId?: string) {', 'export async function getSubjectPaperConfigs(user: SessionUser, subjectId: string, classId?: string) {\n  return withTenant(user.tenantId, async () => {');
  code = code.replace(/return configs;\n}/, 'return configs;\n  });\n}');

  code = code.replace('export async function configureSubjectPapers(user: SessionUser, subjectId: string, classId: string | null, papers: { name: string; outOfMarks: number; weightPct: number }[]) {', 'export async function configureSubjectPapers(user: SessionUser, subjectId: string, classId: string | null, papers: { name: string; outOfMarks: number; weightPct: number }[]) {\n  return withTenant(user.tenantId, async () => {');
  code = code.replace(/return getSubjectPaperConfigs\(user, subjectId, classId \|\| undefined\);\n}/, 'return getSubjectPaperConfigs(user, subjectId, classId || undefined);\n  });\n}');

  code = code.replace('export async function assertTeacherCanMark(user: SessionUser, classId: string, subjectId: string) {', 'export async function assertTeacherCanMark(user: SessionUser, classId: string, subjectId: string) {\n  return withTenant(user.tenantId, async () => {');
  code = code.replace(/return true;\n}/, 'return true;\n  });\n}');

  code = code.replace('export async function savePaperResults(user: SessionUser, examId: string, subjectId: string, classId: string, results: { studentId: string, paperConfigId: string, marksScored: number | null }[]) {', 'export async function savePaperResults(user: SessionUser, examId: string, subjectId: string, classId: string, results: { studentId: string, paperConfigId: string, marksScored: number | null }[]) {\n  return withTenant(user.tenantId, async () => {');
  code = code.replace(/return { success: true, count: results\.length };\n}/, 'return { success: true, count: results.length };\n  });\n}');

  code = code.replace('export async function getMarksGrid(user: SessionUser, examId: string, subjectId: string, classId: string) {', 'export async function getMarksGrid(user: SessionUser, examId: string, subjectId: string, classId: string) {\n  return withTenant(user.tenantId, async () => {');
  code = code.replace(/return { configs, gridData };\n}/, 'return { configs, gridData };\n  });\n}');

  fs.writeFileSync('src/lib/services/grading-engine.service.ts', code);
}
