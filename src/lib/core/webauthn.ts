/**
 * WebAuthn relying-party configuration (Feature A.1 — passkeys).
 * Dev defaults to localhost; production reads env vars.
 *
 *   WEBAUTHN_RP_ID      e.g. "neyo.co.ke"  (the registrable domain)
 *   WEBAUTHN_ORIGIN     e.g. "https://neyo.co.ke"
 */
export const RP_NAME = "NEYO";

export function rpID(): string {
  return process.env.WEBAUTHN_RP_ID || "localhost";
}

export function expectedOrigin(): string {
  return process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";
}

export const CHALLENGE_TTL_MINUTES = 5;
