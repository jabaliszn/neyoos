import {
  LayoutDashboard,
  ConciergeBell,
  CalendarDays,
  MessageSquare,
  GraduationCap,
  UserPlus,
  CalendarCheck,
  Wallet,
  BookOpen,
  Users,
  Settings,
  ShieldCheck,
  BedDouble,
  Bus,
  Library,
  SlidersHorizontal,
  Database,
  HardDrive,
  CreditCard,
  Smartphone,
  Trash2,
  Palette,
  ClipboardList,
  Layers,
  Banknote,
  HeartHandshake,
  Building2,
  Webhook,
  School,
  Megaphone,
  Cpu,
  Boxes,
  UtensilsCrossed,
  ShieldAlert,
  ListChecks,
  Stethoscope,
  Printer,
  DoorClosed,
  Feather,
  LineChart,
  BriefcaseBusiness,
  Globe2,
  Youtube,
  Compass,
  Brain,
  type LucideIcon,
} from "lucide-react";

/**
 * Filter navigation by enabled modules (A.2.6) AND user permissions (A.3.6).
 * An item shows only if:
 *   - it has no moduleKey OR that module is enabled, AND
 *   - it has no permission OR the user holds that permission.
 * Items without either tag (Dashboard, Settings, Security) always show.
 */
export function filterNavigation(
  sections: NavSection[],
  enabled: Set<string>,
  hasPermission: (perm: string) => boolean = () => true,
  /**
   * H.2 Role-Based Visibility: return true if this item's href is hidden for the
   * current user by the school's owner-configured visibility rules.
   */
  isHidden: (href: string) => boolean = () => false
): NavSection[] {
  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter(
        (i) =>
          (!i.moduleKey || enabled.has(i.moduleKey)) &&
          (!i.permission || hasPermission(i.permission)) &&
          !isHidden(i.href)
      ),
    }))
    .filter((s) => s.items.length > 0);
}

/**
 * Sidebar navigation (Odoo structure). Role-filtering (A.3) will read `roles`.
 * For now everything is visible; each feature chunk wires the real pages.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** If set, this item is only shown when the module is enabled (A.2.6). */
  moduleKey?: string;
  /** If set, this item is only shown when the user has this permission (A.3.6). */
  permission?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "My School", href: "/owner", icon: LineChart, permission: "owner.dashboard" },
      { label: "NEYO Ops", href: "/founder", icon: BriefcaseBusiness, permission: "platform.founder_ops" },
      { label: "My children", href: "/portal", icon: HeartHandshake, permission: "portal.parent" },
      { label: "My Classes", href: "/teacher", icon: School, permission: "portal.teacher" },
      { label: "Front Desk", href: "/reception", icon: ConciergeBell, permission: "reception.operate" },
      { label: "Print Station", href: "/print-station", icon: Printer, permission: "reception.operate" },
      { label: "Calendar", href: "/calendar", icon: CalendarDays, permission: "calendar.view" },
      { label: "Messages", href: "/messages", icon: MessageSquare },
      { label: "Broadcast", href: "/comms", icon: Megaphone, permission: "comms.send" },
      // B.23 Bundi Layer — hidden while the "bundi" module is platform-paused
      // (G.22). Appears for everyone the day NEYO releases it. Never "AI".
      { label: "Bundi", href: "/bundi", icon: Feather, moduleKey: "bundi" },
    ],
  },
  {
    title: "School OS",
    items: [
      { label: "Students", href: "/students", icon: GraduationCap, moduleKey: "students", permission: "student.view" },
      { label: "Admissions", href: "/admissions", icon: UserPlus, moduleKey: "students", permission: "student.create" },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck, moduleKey: "attendance", permission: "attendance.view" },
      { label: "Finance", href: "/finance", icon: Wallet, moduleKey: "finance", permission: "finance.view" },
      { label: "Academics", href: "/academics", icon: BookOpen, moduleKey: "academics", permission: "academics.view" },
      { label: "Exams", href: "/exams", icon: ClipboardList, moduleKey: "academics", permission: "exam.view" },
      { label: "Exam Timetable", href: "/exam-timetable", icon: CalendarDays, moduleKey: "academics", permission: "exam.view" },
      { label: "CBC", href: "/cbc", icon: Layers, moduleKey: "academics", permission: "academics.view" },
      { label: "Assessments", href: "/assessments", icon: ClipboardList, moduleKey: "academics", permission: "academics.view" },
      { label: "Competencies", href: "/competencies", icon: Brain, moduleKey: "academics", permission: "academics.view" },
      { label: "Syllabus", href: "/syllabus", icon: BookOpen, moduleKey: "academics", permission: "academics.view" },
      { label: "Staff", href: "/staff", icon: Users, moduleKey: "staff", permission: "staff.view" },
      { label: "Payroll", href: "/payroll", icon: Banknote, moduleKey: "staff", permission: "staff.manage" },
      { label: "Hostel", href: "/hostel", icon: BedDouble, moduleKey: "hostel", permission: "hostel.view" },
      { label: "Transport", href: "/transport", icon: Bus, moduleKey: "transport", permission: "transport.view" },
      { label: "Library", href: "/library", icon: Library, moduleKey: "library", permission: "library.view" },
      { label: "Inventory", href: "/inventory", icon: Boxes, moduleKey: "inventory", permission: "inventory.view" },
      { label: "Cafeteria", href: "/cafeteria", icon: UtensilsCrossed, moduleKey: "cafeteria", permission: "cafeteria.view" },
      { label: "Discipline", href: "/discipline", icon: ShieldAlert, permission: "discipline.view" },
      { label: "Clinic", href: "/clinic", icon: Stethoscope, permission: "clinic.view" },
      { label: "Security", href: "/gate", icon: DoorClosed, permission: "security.view" },
      { label: "Learning", href: "/lms", icon: GraduationCap, moduleKey: "lms", permission: "academics.view" },
      { label: "Learning Videos", href: "/learning-videos", icon: Youtube, moduleKey: "lms" },
      { label: "Online Classes", href: "/online-classes", icon: GraduationCap, moduleKey: "lms", permission: "academics.view" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "School Profile", href: "/settings/school", icon: Building2, permission: "tenant.manage_settings" },
      { label: "Curriculum", href: "/settings/curriculum", icon: Compass, moduleKey: "academics", permission: "academics.view" },
      { label: "Rubrics", href: "/settings/rubrics", icon: ListChecks, moduleKey: "academics", permission: "academics.view" },
      { label: "Public Website", href: "/settings/public-site", icon: Globe2, permission: "tenant.manage_settings" },
      { label: "Modules", href: "/settings/modules", icon: SlidersHorizontal, permission: "tenant.manage_modules" },
      { label: "Billing", href: "/settings/billing", icon: CreditCard, permission: "owner.dashboard" },
      { label: "Payments", href: "/settings/payments", icon: Smartphone, permission: "tenant.manage_settings" },
      { label: "Storage", href: "/settings/storage", icon: HardDrive, permission: "tenant.manage_settings" },
      { label: "Data", href: "/settings/data", icon: Database, permission: "tenant.export_data" },
      { label: "Recycle Bin", href: "/settings/recycle-bin", icon: Trash2, permission: "tenant.manage_settings" },
      { label: "Developer", href: "/settings/developer", icon: Webhook, permission: "api.manage" },
      { label: "Hardware & Biometrics", href: "/settings/hardware", icon: Cpu, permission: "tenant.manage_settings" },
      { label: "Security", href: "/settings/security", icon: ShieldCheck }, // self-service: all roles
      { label: "Brand", href: "/brand", icon: Palette }, // A.20 style guide
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];
