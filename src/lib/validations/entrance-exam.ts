import { z } from "zod";

const storedFileUrl = z.string().min(1).refine((value) => {
  if (value.startsWith("/api/files/serve?key=")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}, "Use an uploaded PDF/DOC file from the NEYO file uploader.");

export const entranceExamPaperSchema = z.object({
  classId: z.string().min(1, "Choose the exact class/stream."),
  title: z.string().trim().min(3, "Paper title is required.").max(120).default("Entrance interview paper"),
  fileUrl: storedFileUrl,
  fileName: z.string().trim().min(2, "Filename required.").max(180),
  hardcopyLocation: z.string().trim().min(3, "Hard-copy file location is required.").max(160),
}).strict();

export type EntranceExamPaperInput = z.infer<typeof entranceExamPaperSchema>;
