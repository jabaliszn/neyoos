import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { hardwareBoard, ingestGpsBusLocation, registerCctvCamera, setHardwareStatus } from "@/lib/services/hardware-registry.service";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`✓ ${message}`); }
function asUser(u: any): SessionUser { return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" }; }

async function main() {
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  await db.hardwareDeviceConnection.deleteMany({ where: { tenantId: principal.tenantId } });
  const board = await hardwareBoard(principal);
  const types = new Set(board.devices.map((d: any) => d.deviceType));
  for (const t of ["GPS", "BARCODE", "THERMAL_PRINTER", "RFID", "FINGERPRINT", "CCTV", "FACE_CAMERA"]) assert(types.has(t), `${t} software connection seam exists`);
  assert(board.devices.every((d: any) => d.status !== "CONNECTED"), "hardware board does not fake connected devices by default");

  const gps = await ingestGpsBusLocation(principal.tenantId, { trackerId: "TEST-GPS-47", vehicleRegNo: "KDA 456B", lat: -1.2921, lng: 36.8219, speedKph: 21 });
  assert(gps.trackerId === "TEST-GPS-47", "GPS tracker feed stores real bus location rows");
  const cctv = await registerCctvCamera(principal, { name: "Gate camera I47", location: "Main gate", streamUrl: "rtsp://nvr.local/gate" });
  assert(cctv.status === "READY_TO_PAIR", "CCTV seam stores camera/NVR endpoint without pretending it is connected");
  const face = await setHardwareStatus(principal, { deviceType: "FACE_CAMERA", label: "Face attendance camera connector", status: "READY_TO_PAIR", deviceName: "Connect camera when purchased" });
  assert(face.status === "READY_TO_PAIR", "face attendance camera seam can be staged without fake recognition");

  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const registry = readFileSync(join(process.cwd(), "src/lib/services/hardware-registry.service.ts"), "utf8");
  const browserHardware = readFileSync(join(process.cwd(), "src/lib/services/hardware.service.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/settings/hardware-settings-client.tsx"), "utf8");
  const gpsApi = readFileSync(join(process.cwd(), "src/app/api/hardware/gps/route.ts"), "utf8");
  const libraryUi = readFileSync(join(process.cwd(), "src/components/library/library-client.tsx"), "utf8");
  const transportUi = readFileSync(join(process.cwd(), "src/components/transport/transport-client.tsx"), "utf8");

  assert(schema.includes("model HardwareDeviceConnection") && schema.includes("model GpsBusLocation") && schema.includes("model CctvCamera"), "schema has hardware registry, GPS feed and CCTV models");
  assert(registry.includes("HARDWARE_TYPES") && registry.includes("FACE_CAMERA") && registry.includes("CCTV"), "hardware registry covers all deferred hardware types");
  assert(browserHardware.includes("connectBluetoothDevice") && browserHardware.includes("connectWifiDevice") && browserHardware.includes("No thermal printer connected") && browserHardware.includes("No fingerprint reader connected") && !browserHardware.includes("Simulated Thermal Receipt Printer"), "browser hardware service supports Bluetooth/Wi-Fi and no longer marks simulated devices as connected");
  assert(ui.includes("Nothing is shown as connected until") && ui.includes("Wi-Fi/LAN endpoint responds") && ui.includes("Bluetooth pairing attempted") && ui.includes("Pair USB/Serial"), "hardware settings UI supports truthful USB/Serial, Bluetooth and Wi-Fi connection paths");
  assert(gpsApi.includes("HARDWARE_FEED_TOKEN") && gpsApi.includes("ingestGpsBusLocation"), "GPS tracker feed API has token seam and real ingest function");
  assert(libraryUi.includes("External hardware scanner: not connected") && libraryUi.includes("Built-in scanner"), "library scanner seam is truthful and includes inbuilt scanner");
  assert(transportUi.includes("GPS bus tracking arrives with tracker hardware"), "transport UI still flags GPS tracking as hardware-activated, never faked");

  await db.gpsBusLocation.deleteMany({ where: { id: gps.id } });
  await db.cctvCamera.deleteMany({ where: { id: cctv.id } });
  await db.hardwareDeviceConnection.deleteMany({ where: { tenantId: principal.tenantId, label: "Face attendance camera connector" } });
  console.log("\nI.47 Hardware Deferred Features test passed.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => db.$disconnect());
