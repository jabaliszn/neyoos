"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Keyboard, X, Navigation2, Search } from "lucide-react";
import { SHORTCUTS } from "@/lib/core/commands";
import { usePermissions } from "@/components/auth/permissions-provider";

// Map single letters to routes
type HotkeyInfo = { route: string; label: string; permission?: string; help?: string };

// Single-letter quick navigation. Permission is checked before navigation so a
// staff member never jumps to an area they do not hold.
const HOTKEY_MAP: Record<string, HotkeyInfo> = {
  d: { route: "/dashboard", label: "Dashboard", help: "home" },
  m: { route: "/messages", label: "Messages", help: "chat" },
  s: { route: "/students", label: "Students", permission: "student.view", help: "learners" },
  n: { route: "/students?new=1", label: "New student", permission: "student.create", help: "register learner" },
  f: { route: "/finance", label: "Finance", permission: "finance.view", help: "fees" },
  a: { route: "/attendance", label: "Attendance", permission: "attendance.view", help: "register" },
  r: { route: "/reception", label: "Front Desk", permission: "reception.operate", help: "visitors / desk" },
  b: { route: "/comms", label: "Broadcast", permission: "comms.send", help: "send message" },
  c: { route: "/calendar", label: "Calendar", permission: "calendar.view", help: "events" },
  e: { route: "/exams", label: "Exams", permission: "exam.view", help: "marks" },
  q: { route: "/exam-timetable", label: "Exam timetable", permission: "exam.view", help: "exam schedule" },
  k: { route: "/cbc", label: "CBE", permission: "academics.view", help: "competencies" },
  y: { route: "/syllabus", label: "Syllabus", permission: "academics.view", help: "coverage" },
  l: { route: "/learning-videos", label: "Learning Videos", help: "class videos" },
  o: { route: "/online-classes", label: "Online Classes", permission: "academics.view", help: "live classes" },
  h: { route: "/hostel", label: "Hostel", permission: "hostel.view", help: "dorms" },
  t: { route: "/transport", label: "Transport", permission: "transport.view", help: "buses" },
  v: { route: "/library", label: "Library", permission: "library.view", help: "books" },
  i: { route: "/inventory", label: "Inventory", permission: "inventory.view", help: "stores" },
  j: { route: "/cafeteria", label: "Cafeteria", permission: "cafeteria.view", help: "meals" },
  x: { route: "/discipline", label: "Discipline", permission: "discipline.view", help: "incidents" },
  z: { route: "/clinic", label: "Clinic", permission: "clinic.view", help: "sick bay" },
  g: { route: "/gate", label: "Security Gate", permission: "security.view", help: "passes" },
  p: { route: "/payroll", label: "Payroll", permission: "staff.manage", help: "salaries" },
  w: { route: "/staff", label: "Staff", permission: "staff.view", help: "HR" },
  u: { route: "/settings", label: "Settings", help: "account" },
  "1": { route: "/teacher", label: "My Classes", permission: "portal.teacher", help: "teacher portal" },
  "2": { route: "/portal", label: "My children", permission: "portal.parent", help: "family portal" },
  "3": { route: "/owner", label: "My School", permission: "owner.dashboard", help: "owner metrics" },
  "0": { route: "/founder", label: "NEYO Ops", permission: "platform.founder_ops", help: "company cockpit" },
};

/**
 * Help / keyboard shortcuts overlay (G.4). Opens when the user presses "?"
 * (outside an input) or via the "neyo:open-help" event.
 * Also handles global single-letter hotkey navigation (e.g. "D" -> Dashboard).
 */
export function HelpOverlay() {
  const router = useRouter();
  const { has } = usePermissions();
  const [open, setOpen] = React.useState(false);

  const visibleHotkeys = React.useMemo(() => Object.entries(HOTKEY_MAP).filter(([, info]) => !info.permission || has(info.permission)), [has]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      
      if (typing) return;

      // Handle help popup trigger
      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
      }

      if (e.key === "Escape") {
        setOpen(false);
      }

      // Handle single-letter navigation keys (ignores modifiers like Command, Control, Alt)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase();
        const target = HOTKEY_MAP[key];
        if (target && (!target.permission || has(target.permission))) {
          e.preventDefault();
          router.push(target.route);
        }
      }
    }

    function onOpen() {
      setOpen(true);
    }

    document.addEventListener("keydown", onKey);
    window.addEventListener("neyo:open-help", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("neyo:open-help", onOpen);
    };
  }, [router, has]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-md animate-fade-in rounded-2xl border border-navy-100 bg-white p-6 shadow-pop dark:border-navy-700 dark:bg-navy-900">
        <div className="mb-4 flex items-center justify-between border-b border-navy-50 pb-3 dark:border-navy-800">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-green-600" />
            <h2 className="text-base font-semibold text-navy-900 dark:text-navy-50">
              NEYO Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={() => window.dispatchEvent(new Event("neyo:open-search"))}
            className="mr-2 rounded-full border border-navy-200 px-3 py-1 text-xs font-bold text-navy-600 hover:bg-navy-50 dark:border-navy-700 dark:text-navy-200"
          >
            <Search className="mr-1 inline h-3.5 w-3.5" /> Command
          </button>
          <button
            onClick={() => setOpen(false)}
            className="text-navy-400 hover:text-navy-700 dark:hover:text-navy-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Section 1: System controls */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500 mb-2">
              System Operations
            </h3>
            <ul className="space-y-2">
              {SHORTCUTS.map((s) => (
                <li key={s.description} className="flex items-center justify-between">
                  <span className="text-sm text-navy-600 dark:text-navy-300">
                    {s.description}
                  </span>
                  <kbd className="rounded-md border border-navy-200 bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-200">
                    {s.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 2: Single-key navigation hotkeys */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Navigation2 className="h-3.5 w-3.5 text-green-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-navy-400 dark:text-navy-500">
                1-Key Quick Navigation
              </h3>
            </div>
            <p className="text-[11px] text-navy-400 mb-2.5">
              Press any of these letters when you are not actively typing to navigate instantly:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {visibleHotkeys.map(([key, info]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-navy-50 bg-navy-50/40 p-2.5 hover:border-green-100 dark:border-navy-800 dark:bg-navy-950/40"
                >
                  <span className="min-w-0 truncate text-xs text-navy-600 dark:text-navy-300 font-medium">
                    {info.label}<span className="ml-1 text-[10px] font-normal text-navy-400">{info.help}</span>
                  </span>
                  <kbd className="h-5 w-5 flex items-center justify-center rounded border border-navy-200 bg-white text-xs font-bold uppercase text-green-700 shadow-sm dark:border-navy-700 dark:bg-navy-800 dark:text-green-400">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
