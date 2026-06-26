import { requireUser } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import { getWebRtcIceServers } from "@/lib/services/webrtc-config.service";

export const dynamic = "force-dynamic";

/** GET /api/webrtc/ice — signed-in TURN/STUN config for browser WebRTC. */
export async function GET() {
  try {
    await requireUser();
    return ok(await getWebRtcIceServers());
  } catch (error) {
    return handleError(error);
  }
}
