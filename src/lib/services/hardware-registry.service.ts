import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class HardwareRegistryError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID", message: string) { super(message); this.name = "HardwareRegistryError"; }
}

export const HARDWARE_TYPES = ["GPS", "BARCODE", "THERMAL_PRINTER", "RFID", "FINGERPRINT", "CCTV", "FACE_CAMERA"] as const;
export type HardwareTypeKey = (typeof HARDWARE_TYPES)[number];

const DEFAULTS: { deviceType: HardwareTypeKey; label: string }[] = [
  { deviceType: "GPS", label: "Bus GPS tracker feed" },
  { deviceType: "BARCODE", label: "Library barcode scanner wedge" },
  { deviceType: "THERMAL_PRINTER", label: "80mm / 58mm ESC/POS receipt printer" },
  { deviceType: "RFID", label: "RFID attendance / meal card reader" },
  { deviceType: "FINGERPRINT", label: "Fingerprint attendance reader" },
  { deviceType: "CCTV", label: "CCTV / NVR stream connector" },
  { deviceType: "FACE_CAMERA", label: "Face attendance camera connector" },
];

async function audit(user: SessionUser, action: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action, entityType: "hardwareDeviceConnection", entityId, metadata: metadata ? JSON.stringify(metadata) : null } });
}

export async function hardwareBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    for (const d of DEFAULTS) {
      await db.hardwareDeviceConnection.upsert({
        where: { tenantId_deviceType_label: { tenantId: user.tenantId, deviceType: d.deviceType, label: d.label } },
        create: { tenantId: user.tenantId, deviceType: d.deviceType, label: d.label, status: "NOT_CONNECTED" },
        update: {},
      });
    }
    const [devices, gpsLatest, cameras] = await Promise.all([
      tenantDb().hardwareDeviceConnection.findMany({ orderBy: [{ deviceType: "asc" }, { label: "asc" }] }),
      tenantDb().gpsBusLocation.findMany({ orderBy: { recordedAt: "desc" }, take: 20 }),
      tenantDb().cctvCamera.findMany({ orderBy: { name: "asc" } }),
    ]);
    return { devices, gpsLatest, cameras };
  });
}

export async function setHardwareStatus(user: SessionUser, input: { deviceType: HardwareTypeKey; label: string; status: string; deviceName?: string; metadata?: unknown }) {
  return withTenant(user.tenantId, async () => {
    if (!HARDWARE_TYPES.includes(input.deviceType)) throw new HardwareRegistryError("INVALID", "Unknown hardware type.");
    const row = await db.hardwareDeviceConnection.upsert({
      where: { tenantId_deviceType_label: { tenantId: user.tenantId, deviceType: input.deviceType, label: input.label } },
      create: { tenantId: user.tenantId, deviceType: input.deviceType, label: input.label, status: input.status, deviceName: input.deviceName || null, lastSeenAt: input.status === "CONNECTED" ? new Date() : null, metadataJson: input.metadata ? JSON.stringify(input.metadata) : null, updatedById: user.id, updatedByName: user.fullName },
      update: { status: input.status, deviceName: input.deviceName || null, lastSeenAt: input.status === "CONNECTED" ? new Date() : null, metadataJson: input.metadata ? JSON.stringify(input.metadata) : null, updatedById: user.id, updatedByName: user.fullName },
    });
    await audit(user, "hardware.status_updated", row.id, { deviceType: input.deviceType, status: input.status });
    return row;
  });
}

export async function ingestGpsBusLocation(tenantId: string, input: { trackerId: string; vehicleId?: string; vehicleRegNo?: string; lat: number; lng: number; speedKph?: number; headingDeg?: number }) {
  return withTenant(tenantId, async () => {
    const row = await db.gpsBusLocation.create({ data: { tenantId, trackerId: input.trackerId, vehicleId: input.vehicleId || null, vehicleRegNo: input.vehicleRegNo || null, lat: input.lat, lng: input.lng, speedKph: input.speedKph ?? null, headingDeg: input.headingDeg ?? null } });
    await db.hardwareDeviceConnection.upsert({
      where: { tenantId_deviceType_label: { tenantId, deviceType: "GPS", label: "Bus GPS tracker feed" } },
      create: { tenantId, deviceType: "GPS", label: "Bus GPS tracker feed", status: "CONNECTED", deviceName: input.trackerId, lastSeenAt: new Date() },
      update: { status: "CONNECTED", deviceName: input.trackerId, lastSeenAt: new Date() },
    });
    return row;
  });
}

export async function registerCctvCamera(user: SessionUser, input: { name: string; location: string; streamUrl?: string }) {
  return withTenant(user.tenantId, async () => {
    const row = await db.cctvCamera.upsert({
      where: { tenantId_name: { tenantId: user.tenantId, name: input.name } },
      create: { tenantId: user.tenantId, name: input.name, location: input.location, streamUrl: input.streamUrl || null, status: input.streamUrl ? "READY_TO_PAIR" : "NOT_CONNECTED" },
      update: { location: input.location, streamUrl: input.streamUrl || null, status: input.streamUrl ? "READY_TO_PAIR" : "NOT_CONNECTED" },
    });
    await audit(user, "hardware.cctv_registered", row.id, { name: input.name, location: input.location });
    return row;
  });
}
