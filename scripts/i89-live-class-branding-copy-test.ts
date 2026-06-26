import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.89/I.90 live class branding + copy refinement test");
  const page = readFileSync("src/app/(app)/online-classes/page.tsx", "utf8");
  const room = readFileSync("src/components/online-classes/online-class-room-client.tsx", "utf8");
  const joinPage = readFileSync("src/app/(app)/online-classes/join/[roomId]/page.tsx", "utf8");

  assert(!page.includes("WebRTC"), "online classes page does not expose underlying technical provider wording");
  assert(room.includes("NEYO live class room") && !room.includes(">WebRTC live class room<"), "live room product heading says NEYO live class room, not WebRTC");
  assert(room.includes("requestFullscreen") && room.includes("Full screen"), "live room supports full screen mode");
  assert(room.includes("<NeyoLogo") && room.includes("NEYO live class"), "NEYO logo is embedded in a corner of the live video stage");
  assert(joinPage.includes("Students join from home/mobile"), "join page keeps user-facing class join copy simple");

  console.log("\n✅ I.89/I.90 live class branding + copy refinement test passed");
}

main().catch((err) => { console.error(err); process.exit(1); });
