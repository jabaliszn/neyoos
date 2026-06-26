/**
 * App command + shortcut registry (Features G.4 + G.7).
 * Commands appear in the ⌘K palette (permission-filtered) and the "?" help
 * overlay. Each navigates somewhere; some require a permission.
 */
export interface AppCommand {
  id: string;
  label: string;
  href: string;
  /** Permission required to see/run this command (optional). */
  permission?: string;
  /** Keywords to match in the palette. */
  keywords?: string[];
}

export const APP_COMMANDS: AppCommand[] = [
  { id: "go-dashboard", label: "Go to Dashboard", href: "/dashboard", keywords: ["home"] },
  { id: "go-messages", label: "Open Messages", href: "/messages", keywords: ["chat", "inbox"] },
  {
    id: "new-student",
    label: "New student",
    href: "/students?new=1",
    permission: "student.create",
    keywords: ["register", "admit", "enrol", "enroll", "add student"],
  },
  {
    id: "import-students",
    label: "Import students (CSV / Excel / Sheets)",
    href: "/students/import",
    permission: "student.create",
    keywords: ["bulk", "upload", "csv", "excel", "sheets"],
  },
  {
    id: "view-students",
    label: "View students",
    href: "/students",
    permission: "student.view",
    keywords: ["learners", "pupils", "class"],
  },
  {
    id: "record-payment",
    label: "Record a payment",
    href: "/finance/payments",
    permission: "finance.record_payment",
    keywords: ["fees", "mpesa", "pay"],
  },
  {
    id: "view-payments",
    label: "View payments",
    href: "/finance/payments",
    permission: "finance.view",
    keywords: ["fees", "receipts"],
  },
  {
    id: "send-message",
    label: "Send a message",
    href: "/messages",
    permission: "comms.send",
    keywords: ["sms", "announce"],
  },
  {
    id: "manage-modules",
    label: "Manage modules",
    href: "/settings/modules",
    permission: "tenant.manage_modules",
  },
  {
    id: "billing",
    label: "Billing & plan",
    href: "/settings/billing",
    keywords: ["plan", "subscription", "invoice"],
  },
  {
    id: "payments-setup",
    label: "Set up M-Pesa",
    href: "/settings/payments",
    permission: "tenant.manage_settings",
    keywords: ["daraja", "paybill"],
  },
  { id: "security", label: "Security & 2FA", href: "/settings/security", keywords: ["passkey", "password"] },
  {
    id: "export-data",
    label: "Export school data",
    href: "/settings/data",
    permission: "tenant.export_data",
  },
  // Module Navigation Commands (H.3)
  {
    id: "go-transport",
    label: "Go to Transport & Buses",
    href: "/transport",
    permission: "transport.view",
    keywords: ["bus", "routes", "drivers", "vehicles", "fuel"],
  },
  {
    id: "go-library",
    label: "Go to Library & Book Catalog",
    href: "/library",
    permission: "library.view",
    keywords: ["books", "borrow", "fines", "isbn", "barcode"],
  },
  {
    id: "go-hostel",
    label: "Go to Hostel & Boarding",
    href: "/hostel",
    permission: "hostel.view",
    keywords: ["dorms", "rooms", "beds", "boarders", "curfew"],
  },
  {
    id: "go-clinic",
    label: "Go to Medical Clinic & Sick Bay",
    href: "/clinic",
    permission: "clinic.view",
    keywords: ["medical", "allergies", "nurse", "medications", "doses"],
  },
  {
    id: "go-cafeteria",
    label: "Go to Cafeteria & Meals",
    href: "/cafeteria",
    permission: "cafeteria.view",
    keywords: ["food", "menu", "githeri", "lunch", "meal cards"],
  },
  {
    id: "go-inventory",
    label: "Go to Inventory & Assets",
    href: "/inventory",
    permission: "inventory.view",
    keywords: ["stores", "stock", "assets", "suppliers", "procurement", "expenses"],
  },
  {
    id: "go-discipline",
    label: "Go to Student Discipline",
    href: "/discipline",
    permission: "discipline.view",
    keywords: ["incidents", "demerits", "suspensions", "counseling"],
  },
  {
    id: "go-exams",
    label: "Go to Exams & Results Summary",
    href: "/exams",
    permission: "exam.view",
    keywords: ["marks", "grading", "stream mean", "positions"],
  },
  {
    id: "go-cbc",
    label: "Go to CBC Management",
    href: "/cbc",
    permission: "academics.view",
    keywords: ["cbc strands", "rubrics", "competency", "formative"],
  },
  {
    id: "go-staff",
    label: "Go to Staff & HR Directory",
    href: "/staff",
    permission: "staff.view",
    keywords: ["hr", "employees", "contracts", "leave", "recruitment"],
  },
  {
    id: "go-payroll",
    label: "Go to Payroll & Salaries",
    href: "/payroll",
    permission: "reports.view",
    keywords: ["salaries", "basic pay", "payslips", "paye", "nssf", "shif"],
  },

  { id: "go-attendance", label: "Go to Attendance", href: "/attendance", permission: "attendance.view", keywords: ["register", "present", "absent"] },
  { id: "go-calendar", label: "Go to Calendar", href: "/calendar", permission: "calendar.view", keywords: ["events", "term dates"] },
  { id: "go-learning-videos", label: "Go to Learning Videos", href: "/learning-videos", keywords: ["youtube", "videos", "projector", "tv", "cast"] },
  { id: "go-exam-timetable", label: "Go to Exam Timetable", href: "/exam-timetable", permission: "exam.view", keywords: ["exam schedule", "papers", "materials"] },
  { id: "go-syllabus", label: "Go to Syllabus Coverage", href: "/syllabus", permission: "academics.view", keywords: ["scope", "coverage", "topics"] },
  { id: "go-gate", label: "Go to Security Gate", href: "/gate", permission: "security.view", keywords: ["pickup", "gate pass", "security"] },
  { id: "go-online-classes", label: "Go to Online Classes", href: "/online-classes", permission: "academics.view", keywords: ["live class", "screen share", "tv"] },
];

/** Keyboard shortcuts shown in the "?" help overlay. */
export const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "⌘ K  /  Ctrl K", description: "Open search & commands" },
  { keys: "?", description: "Show this help" },
  { keys: "Esc", description: "Close dialogs" },
  { keys: "↑ ↓", description: "Move between results" },
  { keys: "Enter", description: "Open the selected result" },
  { keys: "D", description: "Dashboard" },
  { keys: "F", description: "Finance" },
  { keys: "A", description: "Attendance" },
  { keys: "S", description: "Students" },
  { keys: "L", description: "Learning videos" },
  { keys: "V", description: "Library" },
  { keys: "? then Command", description: "Open full command search" },
];
