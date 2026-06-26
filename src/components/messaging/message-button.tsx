"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/**
 * H.5 Quick-Action Messaging Button — a small inline button that opens (or
 * reuses) a direct conversation with one person and jumps straight into the
 * thread. Drop it anywhere a recipient is shown (staff directory, guardians…).
 */
export function MessageButton({
  recipientId,
  recipientName,
  label,
  variant = "ghost",
  className,
}: {
  recipientId: string;
  recipientName?: string;
  label?: string;
  variant?: "ghost" | "solid";
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DIRECT", participantIds: [recipientId] }),
      });
      const json = await res.json();
      if (json.ok && json.data?.id) {
        router.push(`/messages?open=${json.data.id}`);
      } else {
        toast({ title: json.error?.message || "Couldn't start the conversation", tone: "error" });
      }
    } catch {
      toast({ title: "Network error", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const base =
    variant === "solid"
      ? "bg-green-600 text-white hover:bg-green-700"
      : "border border-navy-200 text-navy-700 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-200 dark:hover:bg-navy-800";

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      title={recipientName ? `Message ${recipientName}` : "Message"}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 " +
        base +
        (className ? " " + className : "")
      }
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
      {label ?? "Message"}
    </button>
  );
}
