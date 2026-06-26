import { readCompanySecret } from "@/lib/services/company-secret.service";

export async function getWebRtcIceServers() {
  const turnUrl = (await readCompanySecret("turn_server_url")) || process.env.TURN_SERVER_URL || "";
  const username = (await readCompanySecret("turn_server_username")) || process.env.TURN_SERVER_USERNAME || "";
  const credential = (await readCompanySecret("turn_server_secret")) || process.env.TURN_SERVER_SECRET || "";
  const stunUrl = (await readCompanySecret("stun_server_url")) || process.env.STUN_SERVER_URL || "stun:stun.l.google.com:19302";
  const iceServers: RTCIceServer[] = [];
  if (stunUrl) iceServers.push({ urls: stunUrl });
  if (turnUrl && username && credential) iceServers.push({ urls: turnUrl, username, credential });
  return { iceServers, turnConfigured: Boolean(turnUrl && username && credential), stunUrl, turnUrl: turnUrl || null };
}
