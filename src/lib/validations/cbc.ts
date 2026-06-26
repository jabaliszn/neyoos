/**
 * B.6 CBC Management — validation + real KICD strand presets.
 * Rubric: 4=EE Exceeding · 3=ME Meeting · 2=AE Approaching · 1=BE Below.
 */
import { z } from "zod";

export const strandSchema = z.object({
  subjectId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  learningOutcome: z.string().trim().max(300).optional().or(z.literal("")),
});

export const assessSchema = z.object({
  strandId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(
    z.object({
      studentId: z.string().min(1),
      level: z.coerce.number().int().min(1).max(4).nullable(), // null = skip
      comment: z.string().trim().max(200).optional().or(z.literal("")),
    })
  ).min(1).max(200),
});

export const LEVEL_LABELS: Record<number, { code: string; label: string; parent: string }> = {
  4: { code: "EE", label: "Exceeding Expectations", parent: "is going beyond what is expected — keep encouraging this" },
  3: { code: "ME", label: "Meeting Expectations", parent: "is doing what is expected at this level" },
  2: { code: "AE", label: "Approaching Expectations", parent: "is getting there — a little more practice will help" },
  1: { code: "BE", label: "Below Expectations", parent: "needs support — please work closely with the teacher" },
};

/** Real KICD strands for common CBC learning areas (preset quick-add). */
export const KICD_STRAND_PRESETS: Record<string, { name: string; learningOutcome: string }[]> = {
  ENG: [
    { name: "Listening and Speaking", learningOutcome: "Listen actively and respond appropriately in a variety of contexts." },
    { name: "Reading", learningOutcome: "Read a variety of texts fluently and with comprehension." },
    { name: "Writing", learningOutcome: "Write legibly and creatively for different purposes and audiences." },
    { name: "Grammar in Use", learningOutcome: "Use grammatical forms accurately in oral and written communication." },
  ],
  KIS: [
    { name: "Kusikiliza na Kuzungumza", learningOutcome: "Kusikiliza kwa makini na kuzungumza kwa ufasaha katika miktadha mbalimbali." },
    { name: "Kusoma", learningOutcome: "Kusoma matini mbalimbali kwa ufasaha na ufahamu." },
    { name: "Kuandika", learningOutcome: "Kuandika kwa hati nadhifu na ubunifu kwa madhumuni mbalimbali." },
  ],
  MAT: [
    { name: "Numbers", learningOutcome: "Apply number concepts and operations in real-life situations." },
    { name: "Measurement", learningOutcome: "Use measurement units and tools in practical contexts." },
    { name: "Geometry", learningOutcome: "Identify and use geometric shapes and spatial relationships." },
    { name: "Data Handling", learningOutcome: "Collect, represent and interpret simple data." },
  ],
  ISC: [
    { name: "Living Things and Their Environment", learningOutcome: "Explore living things and their interdependence with the environment." },
    { name: "Force and Energy", learningOutcome: "Investigate force and energy and their everyday applications." },
    { name: "Health Education", learningOutcome: "Practise habits that promote personal and community health." },
  ],
  SST: [
    { name: "Natural and Built Environments", learningOutcome: "Describe and care for natural and built environments." },
    { name: "People and Relationships", learningOutcome: "Demonstrate respect for self, others and diversity." },
    { name: "Citizenship", learningOutcome: "Demonstrate responsible citizenship in day-to-day life." },
  ],
};
