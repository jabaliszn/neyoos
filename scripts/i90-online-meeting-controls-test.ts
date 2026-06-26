import { db } from "@/lib/db";
import { requestOnlineClass, setOnlineClassStatus, joinOnlineClassRoom, updateOnlineClassControls, pollOnlineClassSignals } from "@/lib/services/online-class.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
function assert(c:unknown,m:string){ if(!c) throw new Error(m); console.log(`  ✓ ${m}`); }
async function main(){
 console.log("I.90 online meeting controls test");
 const teacher=asUser(await db.user.findFirstOrThrow({where:{email:"p.njoroge@karibuhigh.ac.ke"}}));
 const principal=asUser(await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}}));
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:teacher.tenantId,archived:false}});
 const session=await requestOnlineClass(teacher,{classId:cls.id,title:"Controls test",scheduledAt:"2099-09-01T08:00"});
 await setOnlineClassStatus(teacher, session.id, "RUNNING");
 try {
  await joinOnlineClassRoom(teacher, session.roomId, {peerId:"peer_teacher_i90", role:"TEACHER"});
  await joinOnlineClassRoom(principal, session.roomId, {peerId:"peer_student_i90", role:"STUDENT"});
  const updated=await updateOnlineClassControls(teacher, session.roomId, {fromPeerId:"peer_teacher_i90", muteAllStudents:true, studentVideoDisabled:true, screenSharePeerId:"peer_teacher_i90", recordingAllowed:false});
  assert(updated.muteAllStudents && updated.studentVideoDisabled && updated.screenSharePeerId==="peer_teacher_i90" && updated.recordingAllowed===false, "teacher can set mute-all, disable student video, screen-share peer and no-recording policy");
  const poll=await pollOnlineClassSignals(principal, session.roomId, "peer_student_i90");
  assert(poll.signals.some((s:any)=>s.type==="control" && s.payload.muteAllStudents && s.payload.studentVideoDisabled), "meeting controls are broadcast to participants as control signals");
  const component=readFileSync("src/components/online-classes/online-class-room-client.tsx","utf8");
  assert(component.includes("getDisplayMedia") && component.includes("replaceTrack"), "online class room supports screen sharing");
  assert(component.includes("Mute all students") && component.includes("Disable student video"), "instructor has mute-all and disable-video controls");
  assert(component.includes("NEYO does not save class video") && component.includes("own device/external drive"), "room states no-recording-by-NEYO policy with local-only saving notice");
 } finally {
  await db.onlineClassSignal.deleteMany({where:{sessionId:session.id}});
  await db.onlineClassParticipant.deleteMany({where:{sessionId:session.id}});
  await db.onlineClassSession.deleteMany({where:{id:session.id}});
 }
 console.log("\n✅ I.90 online meeting controls test passed");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>db.$disconnect());
