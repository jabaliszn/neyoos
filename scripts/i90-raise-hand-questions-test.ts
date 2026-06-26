import { db } from "@/lib/db";
import { requestOnlineClass, setOnlineClassStatus, joinOnlineClassRoom, raiseOnlineClassHand, decideOnlineClassQuestion, pollOnlineClassSignals, updateOnlineClassControls } from "@/lib/services/online-class.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
function assert(c:unknown,m:string){ if(!c) throw new Error(m); console.log(`  ✓ ${m}`); }
async function main(){
 console.log("I.90 raise-hand / approved speaker test");
 const teacher=asUser(await db.user.findFirstOrThrow({where:{email:"p.njoroge@karibuhigh.ac.ke"}}));
 const studentUser=asUser(await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}}));
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:teacher.tenantId,archived:false}});
 const session=await requestOnlineClass(teacher,{classId:cls.id,title:"Raise hand test",scheduledAt:"2099-09-01T08:00"});
 await setOnlineClassStatus(teacher, session.id, "RUNNING");
 try {
  await joinOnlineClassRoom(teacher, session.roomId, {peerId:"peer_teacher_hand", role:"TEACHER"});
  await joinOnlineClassRoom(studentUser, session.roomId, {peerId:"peer_student_hand", role:"STUDENT"});
  await updateOnlineClassControls(teacher, session.roomId, {fromPeerId:"peer_teacher_hand", muteAllStudents:true});
  const q=await raiseOnlineClassHand(studentUser, session.roomId, {peerId:"peer_student_hand", question:"May I answer number two?"});
  assert(q.status === "PENDING" && q.question.includes("number two"), "student can raise hand and ask a question/comment");
  const approved=await decideOnlineClassQuestion(teacher, session.roomId, {fromPeerId:"peer_teacher_hand", questionId:q.id, status:"APPROVED"});
  assert(approved.status === "APPROVED" && approved.approvedById === teacher.id, "teacher can approve the raised hand");
  const poll=await pollOnlineClassSignals(studentUser, session.roomId, "peer_student_hand");
  assert(poll.signals.some((s:any)=>s.type === "question-decision" && s.payload.approvedSpeakerPeerId === "peer_student_hand"), "approved student receives targeted decision signal to speak");
  assert(poll.signals.some((s:any)=>s.type === "control" && s.payload.approvedSpeakerPeerId === "peer_student_hand"), "room broadcasts approved speaker control while others remain muted");
  const ui=readFileSync("src/components/online-classes/online-class-room-client.tsx","utf8");
  assert(ui.includes("Raise hand / ask") && ui.includes("Let speak") && ui.includes("Teacher approved you"), "UI has raise hand, teacher approve and student unmuted copy");
  const api=readFileSync("src/app/api/online-classes/[roomId]/signal/route.ts","utf8");
  assert(api.includes("questionDecision") && api.includes("raiseOnlineClassHand") && api.includes("decideOnlineClassQuestion"), "signalling API supports question and teacher decision actions");
 } finally {
  await db.onlineClassQuestion.deleteMany({where:{sessionId:session.id}});
  await db.onlineClassSignal.deleteMany({where:{sessionId:session.id}});
  await db.onlineClassParticipant.deleteMany({where:{sessionId:session.id}});
  await db.onlineClassSession.deleteMany({where:{id:session.id}});
 }
 console.log("\n✅ I.90 raise-hand / approved speaker test passed");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>db.$disconnect());
