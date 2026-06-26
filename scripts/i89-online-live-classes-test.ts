import { db } from "@/lib/db";
import { onlineClassBoard, requestOnlineClass, setOnlineClassStatus } from "@/lib/services/online-class.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";

function asUser(u: any): SessionUser { return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" }; }
function assert(c: unknown, m: string) { if (!c) throw new Error(m); console.log(`  ✓ ${m}`); }

async function main() {
  console.log("I.89 online live classes test");
  const teacher = asUser(await db.user.findFirstOrThrow({ where: { email: "p.njoroge@karibuhigh.ac.ke" } }));
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: teacher.tenantId, archived: false } });
  const session = await requestOnlineClass(teacher, { classId: cls.id, title: "Form revision live", scheduledAt: "2099-09-01T08:00" });
  assert(session.status === "SCHEDULED" && session.joinUrl.includes(session.roomId), "teacher requests an online class with WebRTC room URL");
  assert(Boolean(session.tvAccessCode), "session includes a TV access code for classroom TVs");
  const running = await setOnlineClassStatus(teacher, session.id, "RUNNING");
  assert(running.status === "RUNNING" && running.startedAt, "teacher can start the live class");
  const board = await onlineClassBoard(teacher);
  assert(board.runningByClass.some((r) => r.classId === cls.id), "board shows Online class running in this class");
  const notif = await db.notification.findFirst({ where: { tenantId: teacher.tenantId, title: { contains: "Online class" } }, orderBy: { createdAt: "desc" } });
  assert(Boolean(notif?.channels?.includes("push")), "class join messages use in-app plus native push channel");
  const ended = await setOnlineClassStatus(teacher, session.id, "ENDED");
  assert(ended.status === "ENDED" && ended.endedAt, "teacher can end the online class");

  const service = readFileSync("src/lib/services/online-class.service.ts", "utf8");
  assert(service.includes("channels: [\"in_app\", \"push\"]") && service.includes("tvAccessCode"), "service notifies class with native push and TV/mobile join support");
  const ui = readFileSync("src/components/online-classes/online-classes-client.tsx", "utf8");
  assert(ui.includes("Online class running in this class") && ui.includes("Request class + notify") && ui.includes("TV code"), "UI supports request, running banner and TV code");

  await db.onlineClassSession.deleteMany({ where: { id: session.id } });
  console.log("\n✅ I.89 online live classes test passed");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => db.$disconnect());
