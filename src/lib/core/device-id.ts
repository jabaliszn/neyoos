import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const DEVICE_COOKIE = "neyo_device_id";
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const DEVICE_ID_RE = /^dev_[a-zA-Z0-9_-]{16,80}$/;

export function newDeviceId(): string {
  return `dev_${crypto.randomBytes(24).toString("base64url")}_${Date.now()}`;
}

export function cleanDeviceId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return DEVICE_ID_RE.test(trimmed) ? trimmed : null;
}

export function deviceIdFromRequest(req: NextRequest): string {
  return (
    cleanDeviceId(req.cookies.get(DEVICE_COOKIE)?.value) ||
    cleanDeviceId(req.headers.get("x-neyo-device-id")) ||
    newDeviceId()
  );
}

export function setDeviceCookie(response: NextResponse, deviceId: string) {
  response.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
  });
}
