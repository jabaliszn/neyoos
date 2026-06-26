import { z } from "zod";

/**
 * I.9 — Class-group disappearing voice validation.
 *
 * The feature stores ONLY room/signalling metadata. Browser audio travels through
 * WebRTC between participants; these schemas intentionally reject audio/file URL
 * fields so nobody can turn this into permanent voice-note storage by accident.
 */

export const CLASS_VOICE_MODE = "DISAPPEARING" as const;
export const CLASS_VOICE_ROOM_STATUS = ["ACTIVE", "ENDED", "EXPIRED"] as const;
export const CLASS_VOICE_SIGNAL_TYPES = ["join", "leave", "offer", "answer", "ice", "control"] as const;

// Keep rooms short-lived. If a school needs a long lesson, they should use the
// proper Online Classes module; class-group voice is for quick disappearing calls.
export const CLASS_VOICE_ROOM_TTL_MINUTES = 15;
export const CLASS_VOICE_SIGNAL_TTL_MINUTES = 20;
export const CLASS_VOICE_MAX_SIGNAL_PAYLOAD_CHARS = 12_000;

export const classVoicePeerIdSchema = z
  .string()
  .trim()
  .min(3, "Voice connection id is missing.")
  .max(120, "Voice connection id is too long.")
  .regex(/^[A-Za-z0-9:_-]+$/, "Voice connection id has invalid characters.");

export const classVoiceRoomKeySchema = z
  .string()
  .trim()
  .min(8, "Voice room key is missing.")
  .max(120, "Voice room key is too long.")
  .regex(/^cvr_[A-Za-z0-9_-]+$/, "Voice room key is invalid.");

export const startClassVoiceRoomSchema = z
  .object({
    conversationId: z.string().trim().min(1, "Class group conversation is required."),
    peerId: classVoicePeerIdSchema,
  })
  .strict();

export const joinClassVoiceRoomSchema = z
  .object({
    roomKey: classVoiceRoomKeySchema,
    peerId: classVoicePeerIdSchema,
  })
  .strict();

export const endClassVoiceRoomSchema = z
  .object({
    roomKey: classVoiceRoomKeySchema,
  })
  .strict();

const signalPayloadSchema = z.record(z.unknown()).superRefine((payload, ctx) => {
  const json = JSON.stringify(payload ?? {});
  if (json.length > CLASS_VOICE_MAX_SIGNAL_PAYLOAD_CHARS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Voice connection payload is too large.",
    });
  }

  // Defensive storage guard: signalling may contain SDP/ICE/control data, but it
  // must never include persistent audio/file references.
  const lower = json.toLowerCase();
  const forbidden = ["audiourl", "attachmenturl", "fileurl", "recordingurl", "bloburl"];
  if (forbidden.some((token) => lower.includes(token))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Voice rooms do not accept stored audio or file URLs.",
    });
  }
});

export const postClassVoiceSignalSchema = z
  .object({
    roomKey: classVoiceRoomKeySchema,
    fromPeerId: classVoicePeerIdSchema,
    toPeerId: classVoicePeerIdSchema.nullish(),
    type: z.enum(CLASS_VOICE_SIGNAL_TYPES),
    payload: signalPayloadSchema.default({}),
  })
  .strict();

export const pollClassVoiceSignalsSchema = z
  .object({
    roomKey: classVoiceRoomKeySchema,
    peerId: classVoicePeerIdSchema,
    sinceId: z.string().trim().min(1).max(120).nullish(),
  })
  .strict();

export const classVoiceActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), conversationId: z.string().trim().min(1), peerId: classVoicePeerIdSchema }).strict(),
  z.object({ action: z.literal("join"), roomKey: classVoiceRoomKeySchema, peerId: classVoicePeerIdSchema }).strict(),
  z.object({ action: z.literal("end"), roomKey: classVoiceRoomKeySchema }).strict(),
]);

export type StartClassVoiceRoomInput = z.infer<typeof startClassVoiceRoomSchema>;
export type JoinClassVoiceRoomInput = z.infer<typeof joinClassVoiceRoomSchema>;
export type EndClassVoiceRoomInput = z.infer<typeof endClassVoiceRoomSchema>;
export type PostClassVoiceSignalInput = z.infer<typeof postClassVoiceSignalSchema>;
export type PollClassVoiceSignalsInput = z.infer<typeof pollClassVoiceSignalsSchema>;
export type ClassVoiceActionInput = z.infer<typeof classVoiceActionSchema>;
