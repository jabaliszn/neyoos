const fs = require('fs');
let code = fs.readFileSync('src/lib/validations/academics.ts', 'utf8');

const oldLessonPlanSchema = `export const lessonPlanSchema = z.object({
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  date: dateYmd,
  topic: z.string().trim().min(2).max(160),
  objectives: z.string().trim().max(1000).optional().or(z.literal("")),
  activities: z.string().trim().max(1000).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});`;

const newLessonPlanSchema = `export const lessonPlanSchema = z.object({
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  date: dateYmd,
  topic: z.string().trim().min(2).max(160),
  objectives: z.string().trim().max(1000).optional().nullable().or(z.literal("")),
  activities: z.string().trim().max(1000).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().nullable().or(z.literal("")),
  strandId: z.string().cuid().optional().nullable(),
  competencyId: z.string().cuid().optional().nullable(),
  assessmentPlanId: z.string().cuid().optional().nullable(),
  resources: z.array(z.object({ fileUrl: z.string().url(), fileName: z.string().optional() })).optional(),
});`;

code = code.replace(oldLessonPlanSchema, newLessonPlanSchema);
fs.writeFileSync('src/lib/validations/academics.ts', code);
