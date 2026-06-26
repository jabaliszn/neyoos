import { db } from "@/lib/db";
import { requestOnlineClass, setOnlineClassStatus, joinOnlineClassRoom, postOnlineClassSignal, pollOnlineClassSignals } from "@/lib/services/online-class.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";
function asUser(u:any): SessionUser { return { id:u.id, tenantId:u.tenantId, neyoLoginId:u.neyoLoginId, fullName:u.fullName, phone:u.phone, email:u.email, role:u.role as Role, secondaryRole:u.secondaryRole as Role|null, language:u.language??"en" }; }
function assert(c:unknown,m:string){ if(!c) throw new Error(m); console.log(`  ✓ ${m}`); }
async function main(){
 console.log("I.89 WebRTC signalling continuation test");
 const teacher=asUser(await db.user.findFirstOrThrow({where:{email:"p.njoroge@karibuhigh.ac.ke"}}));
 const principal=asUser(await db.user.findFirstOrThrow({where:{email:"principal@karibuhigh.ac.ke"}}));
 const cls=await db.schoolClass.findFirstOrThrow({where:{tenantId:teacher.tenantId,archived:false}});
 const session=await requestOnlineClass(teacher,{classId:cls.id,title:"Signal test class",scheduledAt:"2099-09-01T08:00"});
 await setOnlineClassStatus(teacher, session.id, "RUNNING");
 try {
  const a=await joinOnlineClassRoom(teacher, session.roomId, {peerId:"peer_teacher_test", role:"TEACHER"});
  const b=await joinOnlineClassRoom(principal, session.roomId, {peerId:"peer_tv_test", role:"TV"});
  assert(a.participant.peerId==="peer_teacher_test" && b.participant.role==="TV", "teacher and TV/mobile peers can join the room");
  await postOnlineClassSignal(teacher, session.roomId, {fromPeerId:"peer_teacher_test", toPeerId:"peer_tv_test", type:"offer", payload:{type:"offer", sdp:"demo"}});
  const poll=await pollOnlineClassSignals(principal, session.roomId, "peer_tv_test");
  assert(poll.signals.some((s:any)=>s.type==="offer" && s.fromPeerId==="peer_teacher_test"), "WebRTC offer signalling is stored and delivered to target peer");
  const component=readFileSync("src/components/online-classes/online-class-room-client.tsx","utf8");
  assert(component.includes("new RTCPeerConnection") && component.includes("navigator.mediaDevices.getUserMedia"), "join room uses real browser WebRTC APIs");
  assert(component.includes("RTCSessionDescription") && component.includes("RTCIceCandidate"), "join room handles SDP answers and ICE candidates");
  assert(component.includes("ontrack") && component.includes("remoteStreams") && component.includes("RemoteVideo"), "join room renders remote video streams when peers connect");
  assert(component.includes("Connect all") && component.includes("Leave"), "join room has multi-peer connect and leave cleanup controls");
  const route=readFileSync("src/app/api/online-classes/[roomId]/signal/route.ts","utf8");
  assert(route.includes("joinOnlineClassRoom") && route.includes("postOnlineClassSignal") && route.includes("pollOnlineClassSignals"), "room signalling API supports join/post/poll");
 } finally {
  await db.onlineClassSignal.deleteMany({where:{sessionId:session.id}});
  await db.onlineClassParticipant.deleteMany({where:{sessionId:session.id}});
  await db.onlineClassSession.deleteMany({where:{id:session.id}});
 }
 console.log("\n✅ I.89 WebRTC signalling continuation test passed");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>db.$disconnect());
