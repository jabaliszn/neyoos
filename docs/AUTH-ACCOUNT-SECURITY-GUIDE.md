# NEYO Auth, Account IDs & Device Security Guide

_Last updated: 2026-06-18_

This guide explains how NEYO signs people in, how staff accounts are provisioned, and how device/passkey security works. It is written for a non-coder founder.

## 1. The two IDs every user can have

NEYO uses a **two-ID system**:

1. **Human contact login** — the email or phone number the school already knows.
   - Example: `principal@karibuhigh.ac.ke`
   - Example phone: `+254 712 345 678`
2. **NEYO login ID** — a system-generated internal ID that never changes even if an email or phone changes.
   - Example: `KH-U-000001` for a staff user
   - Example: `NEYO-STUD-0001` for a student login

Why this matters:

- A staff member can change their email later without breaking history.
- Audit logs always point to the same internal user.
- Imported staff/students can keep school-side IDs while NEYO still has a stable system ID.

## 2. How staff accounts are created

Staff accounts are created in these main ways:

- Seed/dev data for testing.
- Staff creation/invite flows inside NEYO.
- Staff import flows.
- Onboarding invite flows for a new school.

When a staff account is created, NEYO stores:

- Full name
- Role, and optional secondary role
- Email
- Phone
- NEYO login ID
- Password hash if a password is set
- Security settings such as 2FA/passkeys

Passwords are stored with Argon2id hashing. NEYO never stores the plain password.

## 3. Magic links — how they are delivered

Magic links are one-click sign-in links sent to the user's registered email address.

Example:

- Staff email: `principal@karibuhigh.ac.ke`
- The principal requests a magic link on the login page.
- NEYO creates a short-lived one-time token.
- NEYO sends a sign-in email to `principal@karibuhigh.ac.ke`.
- The principal opens the email and clicks the link.
- The link signs them in once, then becomes unusable.

### Development mode

On localhost, NEYO uses the email seam in `src/lib/notifications/email.ts`.

That means:

- The link is generated for real.
- It is stored and validated by the real database.
- The app may show the dev link on screen so the founder can test without a live email provider.

### Live mode

In production, NEYO sends the link through Resend once `RESEND_API_KEY` is provided.

The magic-link flow itself does not change. Only the delivery transport changes.

## 4. Device ID login security

NEYO now binds each new session to a browser/device ID.

What happens:

1. The browser gets a `neyo_device_id` cookie.
2. When the user signs in, the session stores that device ID.
3. On every protected request, NEYO checks that the session cookie and device cookie match.
4. If someone steals only the session cookie, NEYO rejects the request because the matching device ID is missing.

This is not a replacement for passkeys or 2FA. It is an extra protection layer against copied sessions.

## 5. Passkeys / Face ID / fingerprint

NEYO uses WebAuthn passkeys.

That means:

- Private keys stay on the user's device.
- NEYO stores only the public key.
- The browser/OS performs Face ID, fingerprint, PIN, or security-key verification.
- NEYO verifies the signed response with the stored public key.

Passkeys are used in two places:

1. **Passwordless sign-in** from the login page.
2. **Critical-action verification** for sensitive actions while already signed in.

Critical actions include examples like:

- Library clearance
- Permanent delete/purge
- Sensitive settings changes such as Print Station mode

If a user has not set up a passkey, NEYO now tells them to go to **Settings → Security** first. It does not fake a biometric match.

## 6. 2FA and passkeys are different

- **2FA/TOTP** means the user enters a 6-digit authenticator code.
- **Passkey/biometric** means the device signs a challenge using WebAuthn.
- **Device ID** means the browser session is tied to a specific device cookie.

They work together:

- Password protects the account.
- 2FA protects login.
- Device ID protects copied sessions.
- Passkey protects critical actions from abuse on an already-open account.

## 7. Founder test checklist

On localhost:

1. Open `/login`.
2. Use email/password login with:
   - `principal@karibuhigh.ac.ke`
   - `Karibu2026!`
3. Confirm `/dashboard` opens.
4. Open `/settings/security`.
5. Pair a passkey if your browser supports it.
6. Try a protected action, such as a biometric-gated library clearance or print-station mode change.
7. If no passkey is paired, NEYO should ask you to set one up first — it must not pretend to verify.

## Edit points

- Magic-link delivery seam: `src/lib/notifications/email.ts`
- Magic-link service: `src/lib/services/magic-link.service.ts`
- Password login service: `src/lib/services/auth.service.ts`
- Device ID helper: `src/lib/core/device-id.ts`
- Session verification: `src/lib/core/session.ts`
- Passkey service: `src/lib/services/passkey.service.ts`
- Passkey settings UI: `src/components/settings/passkeys-card.tsx`
- Critical-action gate UI: `src/components/auth/biometric-gate.tsx`
