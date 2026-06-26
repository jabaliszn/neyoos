/**
 * Pluggable payment provider interface (Feature A.6.1).
 * Any provider (M-Pesa/Daraja, mock, future card/bank) implements this.
 * Services depend on the interface, not a specific provider.
 */
export interface StkPushInput {
  amount: number; // KES
  phone: string; // +254...
  accountRef: string; // shown on the customer's statement
  description: string;
  /** Optional provider callback override; central NEYO billing uses its own callback route. */
  callbackUrl?: string;
}

export interface StkPushResult {
  ok: boolean;
  checkoutRequestId?: string; // correlates the async callback
  message: string;
}

export interface StatusQueryResult {
  ok: boolean;
  status: "PENDING" | "PAID" | "FAILED";
  mpesaRef?: string;
  resultCode?: string;
  resultDesc?: string;
}

/** Resolved, decrypted credentials handed to a provider at call time. */
export interface ProviderCredentials {
  shortcode: string;
  environment: "sandbox" | "production";
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
}

export interface PaymentProvider {
  readonly key: string;
  stkPush(
    creds: ProviderCredentials,
    input: StkPushInput
  ): Promise<StkPushResult>;
  queryStatus(
    creds: ProviderCredentials,
    checkoutRequestId: string
  ): Promise<StatusQueryResult>;
  /** Parse a raw webhook body into a normalized result. */
  parseCallback(body: unknown): {
    checkoutRequestId: string | null;
    status: "PAID" | "FAILED";
    mpesaRef: string | null;
    resultCode: string | null;
    resultDesc: string | null;
  };
}
