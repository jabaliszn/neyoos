/**
 * M-Pesa Daraja provider (Feature A.6). REAL Safaricom Daraja API calls.
 * Activates automatically once a tenant has credentials configured.
 *
 * Endpoints used:
 *   - OAuth token:      /oauth/v1/generate?grant_type=client_credentials
 *   - STK push:         /mpesa/stkpush/v1/processrequest
 *   - STK query:        /mpesa/stkpushquery/v1/query
 */
import crypto from "crypto";
import type {
  PaymentProvider,
  ProviderCredentials,
  StkPushInput,
  StkPushResult,
  StatusQueryResult,
} from "./provider";
import { appBaseUrl } from "@/lib/notifications/email";

function baseUrl(env: string): string {
  return env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/** Daraja wants 2547XXXXXXXX (no +). */
function darajaMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("254")) return digits;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

async function getToken(creds: ProviderCredentials): Promise<string> {
  const auth = Buffer.from(
    `${creds.consumerKey}:${creds.consumerSecret}`
  ).toString("base64");
  const res = await fetch(
    `${baseUrl(creds.environment)}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Daraja returned no access token");
  return json.access_token;
}

export class DarajaProvider implements PaymentProvider {
  readonly key = "mpesa_daraja";

  async stkPush(
    creds: ProviderCredentials,
    input: StkPushInput
  ): Promise<StkPushResult> {
    try {
      const token = await getToken(creds);
      const ts = timestamp();
      const password = Buffer.from(
        `${creds.shortcode}${creds.passkey}${ts}`
      ).toString("base64");

      const res = await fetch(
        `${baseUrl(creds.environment)}/mpesa/stkpush/v1/processrequest`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            BusinessShortCode: creds.shortcode,
            Password: password,
            Timestamp: ts,
            TransactionType: "CustomerPayBillOnline",
            Amount: input.amount,
            PartyA: darajaMsisdn(input.phone),
            PartyB: creds.shortcode,
            PhoneNumber: darajaMsisdn(input.phone),
            CallBackURL: input.callbackUrl || `${appBaseUrl()}/api/payments/webhook/daraja`,
            AccountReference: input.accountRef.slice(0, 12),
            TransactionDesc: input.description.slice(0, 13),
          }),
        }
      );
      const json = (await res.json()) as {
        CheckoutRequestID?: string;
        ResponseDescription?: string;
        errorMessage?: string;
      };
      if (json.CheckoutRequestID) {
        return {
          ok: true,
          checkoutRequestId: json.CheckoutRequestID,
          message: json.ResponseDescription ?? "STK push sent",
        };
      }
      return { ok: false, message: json.errorMessage ?? "STK push failed" };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async queryStatus(
    creds: ProviderCredentials,
    checkoutRequestId: string
  ): Promise<StatusQueryResult> {
    try {
      const token = await getToken(creds);
      const ts = timestamp();
      const password = Buffer.from(
        `${creds.shortcode}${creds.passkey}${ts}`
      ).toString("base64");
      const res = await fetch(
        `${baseUrl(creds.environment)}/mpesa/stkpushquery/v1/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            BusinessShortCode: creds.shortcode,
            Password: password,
            Timestamp: ts,
            CheckoutRequestID: checkoutRequestId,
          }),
        }
      );
      const json = (await res.json()) as {
        ResultCode?: string;
        ResultDesc?: string;
      };
      const code = json.ResultCode;
      return {
        ok: true,
        status: code === "0" ? "PAID" : code === undefined ? "PENDING" : "FAILED",
        resultCode: code,
        resultDesc: json.ResultDesc,
      };
    } catch (e) {
      return { ok: false, status: "PENDING", resultDesc: (e as Error).message };
    }
  }

  parseCallback(body: unknown) {
    // Daraja STK callback shape: Body.stkCallback.{CheckoutRequestID,ResultCode,ResultDesc,CallbackMetadata.Item[]}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cb = (body as any)?.Body?.stkCallback ?? {};
    const items: Array<{ Name: string; Value?: string | number }> =
      cb?.CallbackMetadata?.Item ?? [];
    const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
    const code = cb.ResultCode != null ? String(cb.ResultCode) : null;
    return {
      checkoutRequestId: cb.CheckoutRequestID ?? null,
      status: code === "0" ? ("PAID" as const) : ("FAILED" as const),
      mpesaRef: receipt != null ? String(receipt) : null,
      resultCode: code,
      resultDesc: cb.ResultDesc ?? null,
    };
  }
}

/** Verify a webhook came from Safaricom. Daraja has no HMAC, so we use a
 *  shared secret path token (set DARAJA_WEBHOOK_TOKEN) + IP allow-listing in
 *  prod. Exposed here for the route to call. */
export function verifyWebhookToken(provided: string | null): boolean {
  const expected = process.env.DARAJA_WEBHOOK_TOKEN;
  if (!expected) return true; // not configured (dev) -> accept
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
