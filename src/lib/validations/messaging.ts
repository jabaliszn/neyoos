import { z } from "zod";

/** Create a conversation (A.8). */
export const createConversationSchema = z.object({
  type: z.enum(["DIRECT", "GROUP", "ANNOUNCEMENT"]).default("DIRECT"),
  title: z.string().trim().max(120).optional(),
  participantIds: z.array(z.string()).min(1, "Pick at least one person"),
});

/** Send a message (A.8 + I.85 acknowledgement/fallback options). */
export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().trim().min(1, "Type a message").max(4000),
  attachmentUrl: z.string().url().optional(),
  attachmentName: z.string().max(200).optional(),
  requiresAck: z.boolean().optional(),
  urgentAfterHours: z.union([z.literal(6), z.literal(12), z.literal(24)]).optional(),
});

export const messageActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ack"), messageId: z.string().min(1) }),
  z.object({ action: z.literal("disappear"), messageId: z.string().min(1) }),
]);

export const searchMessagesSchema = z.object({
  conversationId: z.string().min(1),
  q: z.string().trim().min(1).max(100),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
