"use client";

import * as React from "react";
import {
  Send,
  Loader2,
  MessageSquare,
  Plus,
  Megaphone,
  Users,
  ArrowLeft,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { FileUpload, AttachmentChip, type UploadedFile } from "@/components/ui/file-upload";
import { ClassVoiceRoom } from "@/components/messaging/class-voice-room";

interface Convo {
  id: string;
  type: string;
  title: string;
  classId?: string | null;
  lastMessage: string | null;
  lastAt: string;
  unread: number;
}
interface ReceiptPerson {
  userId: string;
  name: string;
  role?: string;
  readAt?: string;
  acknowledgedAt?: string;
}
interface Msg {
  id: string;
  senderName: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  requiresAck?: boolean;
  urgentFallbackAt?: string | null;
  fallbackSmsSentAt?: string | null;
  acknowledgedByMe?: boolean;
  readBy?: ReceiptPerson[];
  ackBy?: ReceiptPerson[];
  createdAt: string;
  mine: boolean;
}
interface Recipient {
  id: string;
  fullName: string;
  roleLabel: string;
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessagesClient() {
  const { toast } = useToast();
  const [convos, setConvos] = React.useState<Convo[]>([]);
  const [active, setActive] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [draft, setDraft] = React.useState("");
  const [attachment, setAttachment] = React.useState<UploadedFile | null>(null);
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingThread, setLoadingThread] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [composing, setComposing] = React.useState(false);
  const [recipients, setRecipients] = React.useState<Recipient[]>([]);
  const [activeType, setActiveType] = React.useState<string>("DIRECT");
  const [activeTitle, setActiveTitle] = React.useState<string>("Conversation");
  const [activeClassId, setActiveClassId] = React.useState<string | null>(null);
  const [requiresAck, setRequiresAck] = React.useState(false);
  const [urgentAfterHours, setUrgentAfterHours] = React.useState<"" | "6" | "12" | "24">("");
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportLoading, setReportLoading] = React.useState(false);
  const [deliveryReport, setDeliveryReport] = React.useState<any | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const loadList = React.useCallback(async () => {
    const res = await fetch("/api/conversations");
    const json = await res.json();
    if (json.ok) setConvos(json.data.conversations);
    setLoadingList(false);
  }, []);

  React.useEffect(() => {
    loadList();
  }, [loadList]);

  const openConvo = React.useCallback(async (id: string) => {
    setActive(id);
    setLoadingThread(true);
    const res = await fetch(`/api/conversations/${id}/messages`);
    const json = await res.json();
    if (json.ok) {
      setMessages(json.data.messages);
      setActiveType(json.data.conversation.type);
      setActiveTitle(json.data.conversation.title || "Conversation");
      setActiveClassId(json.data.conversation.classId || null);
    }
    setLoadingThread(false);
    loadList(); // refresh unread badges
  }, [loadList]);

  // G.19/I.12 deep-links:
  // /messages?open=<conversationId> opens a known thread.
  // /messages?to=<userId> creates/reuses the 1:1 thread, then opens it.
  const openedFromUrl = React.useRef(false);
  React.useEffect(() => {
    if (openedFromUrl.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("open");
    const to = params.get("to");
    if (id) {
      openedFromUrl.current = true;
      openConvo(id);
      window.history.replaceState(null, "", "/messages");
      return;
    }
    if (to) {
      openedFromUrl.current = true;
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DIRECT", participantIds: [to] }),
      })
        .then((r) => r.json())
        .then(async (json) => {
          if (json.ok && json.data?.id) {
            await loadList();
            openConvo(json.data.id);
          }
        })
        .finally(() => window.history.replaceState(null, "", "/messages"));
    }
  }, [loadList, openConvo]);

  // Live updates for the open thread (SSE).
  React.useEffect(() => {
    if (!active) return;
    const es = new EventSource(`/api/conversations/${active}/stream`);
    let lastCount = messages.length;
    es.addEventListener("tick", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        if (d.count !== lastCount) {
          lastCount = d.count;
          fetch(`/api/conversations/${active}/messages`)
            .then((r) => r.json())
            .then((j) => j.ok && setMessages(j.data.messages));
        }
      } catch { /* ignore */ }
    });
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if ((!draft.trim() && !attachment) || !active) return;
    setSending(true);
    const body = draft || (attachment ? attachment.fileName : "");
    const att = attachment;
    setDraft("");
    setAttachment(null);
    try {
      const res = await fetch(`/api/conversations/${active}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          attachmentUrl: att?.url,
          attachmentName: att?.fileName,
          requiresAck,
          urgentAfterHours: urgentAfterHours ? Number(urgentAfterHours) : undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Could not send.", tone: "error" });
        setDraft(body);
        setAttachment(att);
        return;
      }
      setRequiresAck(false);
      setUrgentAfterHours("");
      await openConvo(active);
    } finally {
      setSending(false);
    }
  }

  async function acknowledge(messageId: string) {
    if (!active) return;
    try {
      const res = await fetch(`/api/conversations/${active}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ack", messageId }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Could not acknowledge.", tone: "error" });
        return;
      }
      toast({ title: "Marked as received", tone: "success" });
      await openConvo(active);
    } catch {
      toast({ title: "Network error", tone: "error" });
    }
  }

  async function openDeliveryReport(messageId: string) {
    if (!active) return;
    setReportOpen(true);
    setReportLoading(true);
    setDeliveryReport(null);
    try {
      const res = await fetch(`/api/conversations/${active}/messages?report=${messageId}`);
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Could not load delivery report", tone: "error" });
        setReportOpen(false);
        return;
      }
      setDeliveryReport(json.data);
    } finally {
      setReportLoading(false);
    }
  }

  async function startCompose() {
    setComposing(true);
    const res = await fetch("/api/conversations/recipients");
    const json = await res.json();
    if (json.ok) setRecipients(json.data.recipients);
  }

  async function startConversation(recipientId: string) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "DIRECT", participantIds: [recipientId] }),
    });
    const json = await res.json();
    if (json.ok) {
      setComposing(false);
      await loadList();
      openConvo(json.data.id);
    }
  }

  const TypeIcon = (t: string) =>
    t === "ANNOUNCEMENT" ? Megaphone : t === "GROUP" ? Users : MessageSquare;

  return (
    <div className="grid h-[calc(100vh-12rem)] grid-cols-1 overflow-hidden rounded-2xl border border-navy-100 bg-white dark:border-navy-800 dark:bg-navy-900 md:grid-cols-[20rem_1fr]">
      {/* List pane */}
      <div
        className={cn(
          "flex flex-col border-r border-navy-100 dark:border-navy-800",
          active && "hidden md:flex"
        )}
      >
        <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3 dark:border-navy-800">
          <h2 className="text-sm font-semibold text-navy-900 dark:text-navy-50">
            Messages
          </h2>
          <Button size="sm" onClick={startCompose}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="skeleton h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-1/2" />
                    <div className="skeleton h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : convos.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <MessageSquare className="h-8 w-8 text-navy-300 dark:text-navy-600" />
              <p className="mt-3 text-sm font-medium text-navy-700 dark:text-navy-200">
                No conversations yet
              </p>
              <p className="mt-0.5 text-xs text-navy-400 dark:text-navy-500">
                Start one with a colleague or parent.
              </p>
              <Button className="mt-4" size="sm" onClick={startCompose}>
                <Plus className="h-4 w-4" /> New message
              </Button>
            </div>
          ) : (
            <ul>
              {convos.map((c) => {
                const Icon = TypeIcon(c.type);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => openConvo(c.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-navy-50 dark:hover:bg-navy-800",
                        active === c.id && "bg-navy-50 dark:bg-navy-800"
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-100 text-navy-500 dark:bg-navy-700 dark:text-navy-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-medium text-navy-900 dark:text-navy-50">
                            {c.title}
                          </p>
                          {c.unread > 0 && (
                            <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-[11px] font-semibold text-white">
                              {c.unread}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-navy-500 dark:text-navy-400">
                          {c.lastMessage ?? "No messages yet"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Thread pane */}
      <div className={cn("flex flex-col", !active && "hidden md:flex")}>
        {composing ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-navy-100 px-4 py-3 dark:border-navy-800">
              <button onClick={() => setComposing(false)} className="md:hidden">
                <ArrowLeft className="h-5 w-5 text-navy-500" />
              </button>
              <h3 className="text-sm font-semibold text-navy-900 dark:text-navy-50">
                New message
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {recipients.map((r) => (
                <button
                  key={r.id}
                  onClick={() => startConversation(r.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-navy-50 dark:hover:bg-navy-800"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700 dark:bg-green-900/50 dark:text-green-300">
                    {r.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy-900 dark:text-navy-50">
                      {r.fullName}
                    </p>
                    <p className="text-xs text-navy-400 dark:text-navy-500">
                      {r.roleLabel}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : !active ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <MessageSquare className="h-10 w-10 text-navy-200 dark:text-navy-700" />
            <p className="mt-3 text-sm text-navy-500 dark:text-navy-400">
              Select a conversation to start messaging
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-navy-100 px-4 py-3 dark:border-navy-800">
              <button onClick={() => setActive(null)} className="md:hidden">
                <ArrowLeft className="h-5 w-5 text-navy-500" />
              </button>
              <p className="text-sm font-semibold text-navy-900 dark:text-navy-50">
                {convos.find((c) => c.id === active)?.title ?? "Conversation"}
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {activeType === "GROUP" && activeClassId && (
                <ClassVoiceRoom
                  conversationId={active}
                  conversationTitle={activeTitle}
                  className="mb-4"
                />
              )}
              {loadingThread ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton h-10 w-2/3 rounded-2xl" />
                  ))}
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("flex", m.mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                        m.mine
                          ? "bg-green-500 text-white"
                          : "bg-navy-100 text-navy-900 dark:bg-navy-800 dark:text-navy-50"
                      )}
                    >
                      {!m.mine && (
                        <p className="mb-0.5 text-[11px] font-medium opacity-70">
                          {m.senderName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      {m.attachmentName === "voice_note:disappearing" ? (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                          This old disappearing voice note has been replaced by live class voice rooms. NEYO does not keep class voice recordings.
                        </div>
                      ) : m.attachmentUrl && (
                        <a
                          href={m.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            "mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs underline",
                            m.mine ? "bg-green-600/40" : "bg-navy-200/60 dark:bg-navy-700"
                          )}
                        >
                          📎 {m.attachmentName ?? "Attachment"}
                        </a>
                      )}

                      {m.requiresAck && !m.mine && !m.acknowledgedByMe && (
                        <button
                          onClick={() => acknowledge(m.id)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-green-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> I received this
                        </button>
                      )}
                      {m.requiresAck && !m.mine && m.acknowledgedByMe && (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Received confirmed
                        </p>
                      )}
                      {m.urgentFallbackAt && !m.fallbackSmsSentAt && (
                        <p className={cn("mt-1 flex items-center gap-1 text-[10px]", m.mine ? "text-green-50/80" : "text-amber-600 dark:text-amber-300")}>
                          <Clock className="h-3 w-3" /> SMS fallback if unread by {time(m.urgentFallbackAt)}
                        </p>
                      )}
                      {m.fallbackSmsSentAt && (
                        <p className={cn("mt-1 flex items-center gap-1 text-[10px]", m.mine ? "text-green-50/80" : "text-amber-600 dark:text-amber-300")}>
                          <AlertTriangle className="h-3 w-3" /> SMS fallback sent {time(m.fallbackSmsSentAt)}
                        </p>
                      )}
                      
                      <div className="flex flex-col gap-0.5">
                        <p
                          className={cn(
                            "mt-1 text-[10px] text-right",
                            m.mine ? "text-green-50/80" : "text-navy-400"
                          )}
                        >
                          {time(m.createdAt)}
                        </p>
                        {m.mine && (
                          <div className="mt-0.5 space-y-0.5 text-right text-[9px] text-green-100/90">
                            {m.readBy && m.readBy.length > 0 ? (
                              <p className="font-semibold italic">
                                Seen by {m.readBy.slice(0, 3).map((r) => `${r.name} ${r.readAt ? `(${time(r.readAt)})` : ""}`).join(", ")}{m.readBy.length > 3 ? ` +${m.readBy.length - 3}` : ""}
                              </p>
                            ) : (
                              <p className="italic opacity-75">Not seen yet</p>
                            )}
                            {m.requiresAck && (
                              <p className="font-semibold">
                                {m.ackBy && m.ackBy.length > 0
                                  ? `Received by ${m.ackBy.map((a) => `${a.name}${a.acknowledgedAt ? ` (${time(a.acknowledgedAt)})` : ""}`).join(", ")}`
                                  : "Awaiting receipt confirmation"}
                              </p>
                            )}
                            {(m.requiresAck || m.urgentFallbackAt) && (
                              <button
                                onClick={() => openDeliveryReport(m.id)}
                                className="mt-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide hover:bg-white/25"
                              >
                                View delivery report
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {activeType !== "ANNOUNCEMENT" && (
              <div className="border-t border-navy-100 p-3 dark:border-navy-800">
                {attachment && (
                  <div className="mb-2">
                    <AttachmentChip file={attachment} onRemove={() => setAttachment(null)} />
                  </div>
                )}
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-navy-100 bg-navy-50/50 px-3 py-2 text-xs dark:border-navy-800 dark:bg-navy-950/40">
                    <label className="inline-flex items-center gap-2 font-medium text-navy-600 dark:text-navy-300">
                      <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} className="h-4 w-4 rounded border-navy-300 text-green-600" />
                      Add “I received this” button
                    </label>
                    <select
                      value={urgentAfterHours}
                      onChange={(e) => setUrgentAfterHours(e.target.value as "" | "6" | "12" | "24")}
                      className="rounded-full border border-navy-200 bg-white px-3 py-1 text-xs dark:border-navy-700 dark:bg-navy-900"
                    >
                      <option value="">No SMS fallback</option>
                      <option value="6">SMS non-readers after 6h</option>
                      <option value="12">SMS non-readers after 12h</option>
                      <option value="24">SMS non-readers after 24h</option>
                    </select>
                  </div>
                <div className="flex items-end gap-2">
                  <FileUpload category="attachment" onUploaded={setAttachment} />
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    placeholder="Type a message…"
                    className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 outline-none focus:ring-2 focus:ring-green-500/30 dark:border-navy-700 dark:bg-navy-900 dark:text-navy-50"
                  />

                  <Button onClick={send} disabled={sending || (!draft.trim() && !attachment)} className="h-11 w-11 !px-0">
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    {reportOpen && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/45 p-4 backdrop-blur-md">
        <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-white p-5 shadow-pop dark:bg-navy-950">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-600">Delivery report</p>
              <h3 className="mt-1 text-lg font-semibold text-navy-900 dark:text-white">Who read and confirmed</h3>
            </div>
            <button onClick={() => setReportOpen(false)} className="rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold dark:border-navy-700">Close</button>
          </div>
          {reportLoading ? (
            <div className="flex items-center gap-2 rounded-2xl bg-navy-50 p-4 text-sm text-navy-500 dark:bg-navy-900">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
            </div>
          ) : deliveryReport?.pending ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              The 24-hour report is not ready yet. It will be ready around {time(deliveryReport.dueAt)}.
            </div>
          ) : deliveryReport?.report ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ReportTile label="Recipients" value={deliveryReport.report.recipientCount} />
                <ReportTile label="Read" value={deliveryReport.report.readCount} />
                <ReportTile label="Received" value={deliveryReport.report.ackCount} />
                <ReportTile label="Unread" value={deliveryReport.report.unreadCount} />
              </div>
              <p className="rounded-2xl bg-green-50 p-3 text-sm font-medium text-green-800 dark:bg-green-900/20 dark:text-green-200">{deliveryReport.report.summary}</p>
              {deliveryReport.report.unread?.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-400">Not read / not confirmed</p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {deliveryReport.report.unread.map((u: any) => (
                      <li key={u.userId} className="rounded-2xl border border-navy-100 p-3 text-sm dark:border-navy-800">
                        <span className="font-semibold text-navy-900 dark:text-white">{u.name}</span>
                        {u.phone ? <span className="ml-2 text-xs text-navy-400">{u.phone}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-navy-500">Everyone has read or confirmed this message.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    )}
    </div>
  );
}

function ReportTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-navy-50 p-3 text-center dark:border-navy-800 dark:bg-navy-900">
      <p className="text-lg font-bold text-navy-900 dark:text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-navy-400">{label}</p>
    </div>
  );
}
