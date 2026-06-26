# NEYO Payments & Developer Guide

_Last updated: 2026-06-23_

This guide explains, in non-coder language, how to test Payments, where M-Pesa/Daraja credentials go, and what the Developer section is for.

## 1. Two different payment credential locations

NEYO has two payment contexts. They must not be mixed.

### A) School fee collection credentials

These are the school's own M-Pesa Paybill/Till credentials.

They are entered by the school at:

```txt
Settings → Payments
/settings/payments
```

They are stored in:

```txt
PaymentCredential
```

Important details:

- One row per school/tenant.
- Used when parents pay school fees, meal cards, transport, boarding, Mzazi Card QR/STK, and front-desk STK.
- The money goes directly to the school's own Paybill/Till.
- Secrets are encrypted with the school's tenant encryption key.
- The plaintext Daraja keys are never shown again after saving.

### B) NEYO company subscription credentials

These are NEYO's own central M-Pesa credentials for schools paying NEYO subscription fees.

They must **not** be entered in a school's Settings → Payments page.

Current status:

```txt
The subscription billing service has a payment seam.
In local/dev it auto-confirms subscription payments for testing.
Live NEYO central payment credentials are planned under I.49 / I.110 NEYO Ops billing.
```

Recommended production location when NEYO company payments are activated:

```txt
NEYO Ops → Billing / Revenue / Company Payment Credentials
```

Implementation rule:

- Store NEYO company credentials as company-level configuration, not tenant-owned school configuration.
- Use `PlatformSetting` or a dedicated NEYO-company credential model.
- Gate access by `SUPER_ADMIN` only.
- Audit every update.
- Never expose secret values again after saving.

## 2. How to test school payments today

### Local/dev testing

In development, if no real Daraja credentials are saved, NEYO uses the mock provider.

That means this works without Safaricom credentials:

1. Login as Principal/Bursar/Receptionist.
2. Open Finance or Front Desk.
3. Send an STK push to a parent phone.
4. Use the dev callback simulation endpoint/test scripts to mark the payment as PAID.
5. Confirm the invoice ledger updates.
6. Confirm receipt/invoice print jobs queue.

Main flows to test:

```txt
Finance → Invoice → M-Pesa
Front Desk → M-Pesa fees
Parent Portal → Pay fees
Mzazi Card QR → Send M-Pesa prompt
```

### Live Daraja testing

To test against real Safaricom Daraja:

1. Get the school's Daraja credentials from Safaricom:
   - Paybill/Till shortcode
   - Consumer key
   - Consumer secret
   - Lipa na M-Pesa passkey
2. Open:

```txt
Settings → Payments
```

3. Enter the credentials.
4. Choose `sandbox` or `production`.
5. Save.
6. Set these deployment environment variables:

```txt
APP_BASE_URL=https://your-live-domain
DARAJA_WEBHOOK_TOKEN=<strong shared callback token>
```

7. In the Safaricom/Daraja portal, set the callback URL to:

```txt
https://your-live-domain/api/payments/webhook/<school-slug>?t=<DARAJA_WEBHOOK_TOKEN>
```

Example:

```txt
https://app.neyo.co.ke/api/payments/webhook/karibu-high?t=secret-token
```

8. Send a small STK test.
9. Confirm:
   - Payment row becomes `PAID`.
   - M-Pesa receipt number is stored as `mpesaRef`.
   - Invoice balance reduces.
   - Receipt SMS path runs.
   - Print Station queues receipt/invoice if enabled.

## 3. What the Developer section is for

The Developer section is at:

```txt
Settings → Developer
/settings/developer
```

It is for controlled integrations with external systems.

Examples:

- A county education portal needs read-only school metrics.
- A partner system needs payment webhooks.
- A future mobile/native app needs API access.
- A BI/reporting system needs selected data.

It has two main parts.

### API keys

API keys allow another system to call NEYO's API.

Example request:

```bash
curl -H "Authorization: Bearer neyo_sk_..." https://app.neyo.co.ke/api/v1/me
```

Rules:

- Treat API keys like passwords.
- Copy the token immediately; it is shown only once.
- Revoke keys no longer in use.
- API calls are tenant-scoped and rate-limited.

### Webhooks

Webhooks let NEYO send events to another system.

Examples:

```txt
payment.recorded
payment.failed
subscription.updated
user.created
notification.sent
```

Each webhook gets a signing secret.

The receiver should verify:

```txt
X-NEYO-Signature
X-NEYO-Event
X-NEYO-Delivery
```

Rules:

- Webhooks are retried with backoff.
- Failed delivery is stored.
- Test events can be sent from the UI.
- Never point webhooks to random URLs.

## 4. Quick founder answer

If the founder asks: “Where do company payment credentials go?”

Answer:

```txt
School fee credentials go in Settings → Payments for each school.
NEYO company subscription credentials should go in NEYO Ops, not in a school settings page. Today the subscription billing seam exists and dev auto-confirms payments; I.49/I.110 will turn it into real NEYO central M-Pesa collection.
```
