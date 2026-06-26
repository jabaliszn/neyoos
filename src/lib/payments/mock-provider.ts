/**
 * Mock payment provider (dev only). Lets the full STK flow be tested without
 * real Daraja credentials: STK "succeeds", and we simulate a callback that the
 * webhook route can process. Replaced automatically once creds are configured.
 */
import type {
  PaymentProvider,
  ProviderCredentials,
  StkPushInput,
  StkPushResult,
  StatusQueryResult,
} from "./provider";

export class MockProvider implements PaymentProvider {
  readonly key = "mock";

  async stkPush(
    _creds: ProviderCredentials,
    _input: StkPushInput
  ): Promise<StkPushResult> {
    void _creds;
    void _input;
    return {
      ok: true,
      checkoutRequestId: `MOCK-${Date.now().toString(36).toUpperCase()}`,
      message: "Mock STK push accepted (dev). Use the simulate-callback endpoint.",
    };
  }

  async queryStatus(): Promise<StatusQueryResult> {
    return { ok: true, status: "PAID", mpesaRef: `MOCK${Date.now()}`, resultCode: "0" };
  }

  parseCallback(body: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = body as any;
    return {
      checkoutRequestId: b?.checkoutRequestId ?? null,
      status: (b?.success ? "PAID" : "FAILED") as "PAID" | "FAILED",
      mpesaRef: b?.mpesaRef ?? `MOCK${Date.now()}`,
      resultCode: b?.success ? "0" : "1",
      resultDesc: b?.success ? "Success" : "Failed",
    };
  }
}
