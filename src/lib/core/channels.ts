/**
 * Notification channel registry (Feature A.7).
 * Defines the cascade order, per-message cost (KES), and whether each channel
 * is configured (real keys present). The cascade tries channels in order until
 * one succeeds, respecting user opt-outs and the requested channel set.
 */
import { WHATSAPP_CONFIGURED } from "@/lib/notifications/whatsapp";
import { PUSH_CONFIGURED } from "@/lib/notifications/push";

export type Channel = "in_app" | "push" | "whatsapp" | "sms" | "email";

export interface ChannelDef {
  key: Channel;
  label: string;
  costKes: number; // estimated cost per message
  configured: boolean; // real transport available (dev console always "works")
}

/** Cascade order: cheapest/most-immediate first (A.7). */
export const CASCADE_ORDER: Channel[] = [
  "in_app",
  "push",
  "whatsapp",
  "sms",
  "email",
];

export function channelDefs(): Record<Channel, ChannelDef> {
  return {
    in_app: { key: "in_app", label: "In-app", costKes: 0, configured: true },
    push: { key: "push", label: "Push", costKes: 0, configured: PUSH_CONFIGURED },
    whatsapp: {
      key: "whatsapp",
      label: "WhatsApp",
      costKes: 0.5,
      configured: WHATSAPP_CONFIGURED,
    },
    sms: {
      key: "sms",
      label: "SMS",
      costKes: 0.8, // ~Africa's Talking bulk rate
      configured: Boolean(process.env.AT_API_KEY),
    },
    email: {
      key: "email",
      label: "Email",
      costKes: 0,
      configured: Boolean(process.env.RESEND_API_KEY),
    },
  };
}

/** Cost (KES) to send `count` messages over a channel. */
export function channelCost(channel: Channel, count: number): number {
  return channelDefs()[channel].costKes * count;
}
