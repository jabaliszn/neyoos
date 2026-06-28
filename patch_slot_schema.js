const fs = require('fs');
let code = fs.readFileSync('src/lib/validations/academics.ts', 'utf8');

const oldSlotSchema = `export const slotSchema = z.object({
  classId: z.string().cuid(),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  period: z.coerce.number().int().min(1).max(20),
  subjectId: z.string().cuid().optional(),
  teacherId: z.string().cuid().optional(),
  venue: z.string().max(30).optional(),
  slotType: z.enum(["ACADEMIC", "REMEDIAL", "PREP", "SATURDAY"]).default("ACADEMIC"),
  weekRotation: z.enum(["ALL", "WEEK_A", "WEEK_B"]).default("ALL"),
  isCombined: z.boolean().default(false),
  combinedDetails: z.string().max(100).optional()
});`;

const newSlotSchema = `export const slotSchema = z.object({
  classId: z.string().cuid(),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  period: z.coerce.number().int().min(1).max(20),
  subjectId: z.string().cuid().optional(),
  activityCategoryId: z.string().cuid().optional(),
  teacherId: z.string().cuid().optional(),
  venue: z.string().max(30).optional(),
  slotType: z.enum(["ACADEMIC", "REMEDIAL", "PREP", "SATURDAY", "ACTIVITY"]).default("ACADEMIC"),
  weekRotation: z.enum(["ALL", "WEEK_A", "WEEK_B"]).default("ALL"),
  isCombined: z.boolean().default(false),
  combinedDetails: z.string().max(100).optional()
});`;

code = code.replace(oldSlotSchema, newSlotSchema);
fs.writeFileSync('src/lib/validations/academics.ts', code);
