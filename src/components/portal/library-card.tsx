"use client";

/**
 * B.15 — "Library books" card on the family portal: the child's reading
 * history with live fines on overdue books.
 */
import * as React from "react";
import { Library, MessagesSquare, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

interface Row {
  id: string; title: string; author: string | null;
  issuedAt: string; dueDate: string; returnedAt: string | null;
  fineKes: number; finePaid: boolean; stillOut: boolean; fineSoFarKes: number;
}

export function LibraryCard({ studentId }: { studentId: string }) {
  const [rows, setRows] = React.useState<Row[] | null>(null);

  React.useEffect(() => {
    fetch(`/api/library/history?studentId=${studentId}`)
      .then((r) => r.json())
      .then((j) => j.ok && setRows(j.data.history))
      .catch(() => setRows([]));
  }, [studentId]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Library className="h-4 w-4 text-navy-400" /> Library books</CardTitle></CardHeader>
      <CardContent>
        {rows === null ? (
          <Skeleton className="h-14 rounded-2xl" />
        ) : rows.length === 0 ? (
          <p className="py-3 text-center text-sm text-navy-400">Borrowed books appear here.</p>
        ) : (
          <ul className="divide-y divide-navy-50 dark:divide-navy-800">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-navy-900 dark:text-navy-50">{r.title}</p>
                  <p className="text-xs text-navy-400">{r.stillOut ? `due back ${r.dueDate}` : `returned ${new Date(r.returnedAt!).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`}</p>
                </div>
                {r.stillOut ? (
                  r.fineSoFarKes > 0
                    ? <Badge tone="red">overdue · {kes(r.fineSoFarKes)}</Badge>
                    : <Badge tone="blue">out</Badge>
                ) : r.fineKes > 0 && !r.finePaid ? (
                  <Badge tone="amber">fine {kes(r.fineKes)} unpaid</Badge>
                ) : (
                  <Badge tone="green">returned ✓</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** G.19 — "Class group chat" button: opens/syncs the class group and jumps to /messages. */
export function ClassChatButton({ classId }: { classId: string }) {
  const [busy, setBusy] = React.useState(false);
  async function open() {
    setBusy(true);
    try {
      const res = await fetch("/api/class-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      const json = await res.json();
      if (json.ok) window.location.href = `/messages?open=${json.data.conversationId}`;
    } finally { setBusy(false); }
  }
  return (
    <button
      onClick={open}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors duration-200 ease-apple hover:bg-green-700 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessagesSquare className="h-3.5 w-3.5" />} Class group chat
    </button>
  );
}
