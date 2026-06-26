/**
 * I.88 — Respectful communication filter shared by every messaging surface.
 * Blocks abusive/harmful language across direct messages, class chats,
 * announcements/broadcasts, and learning forum discussions.
 */
export class ContentModerationError extends Error {
  constructor(public code: "CONTENT_MODERATED", message: string, public matched?: string) {
    super(message);
    this.name = "ContentModerationError";
  }
}

const BLOCKED_TERMS = [
  "fuck", "bitch", "bastard", "asshole", "shit",
  "malaya", "pumbavu", "mjinga", "matusi", "shenzi",
  "kuma", "mboro", "kahaba",
  "kill yourself", "go die", "i will kill you", "nitakuua",
  "terrorist", "rape", "nude", "porn",
];

function normalize(text: string) {
  return text.toLowerCase().replace(/[0-9]/g, (d) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" }[d] ?? d)).replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function moderationResult(text: string): { ok: true } | { ok: false; matched: string } {
  const n = normalize(text || "");
  for (const term of BLOCKED_TERMS) {
    const t = normalize(term);
    if (!t) continue;
    const regex = new RegExp(`(^|\\s)${t.replace(/\s+/g, "\\s+")}(\\s|$)`, "i");
    if (regex.test(n)) return { ok: false, matched: term };
  }
  return { ok: true };
}

export function assertRespectfulContent(text: string, surface = "message") {
  const res = moderationResult(text);
  if (!res.ok) {
    throw new ContentModerationError(
      "CONTENT_MODERATED",
      `Content moderation warning: this ${surface} contains language that violates NEYO's respectful communication policy.`,
      res.matched
    );
  }
}
