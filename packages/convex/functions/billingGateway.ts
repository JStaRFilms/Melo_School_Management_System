import { ConvexError } from "convex/values";

export interface PaymentLinkInput {
  amount: number;
  email: string;
  schoolId: string;
  invoiceId: string;
  invoiceNumber?: string;
  schoolSlug?: string;
  description: string;
  reference: string;
  callbackUrl?: string;
  providerMode?: "test" | "live";
}

export interface PaymentLinkResult {
  provider: "paystack";
  reference: string;
  authorizationUrl: string | null;
  accessCode: string | null;
  checkoutPayload: Record<string, unknown>;
}

export interface PaymentVerificationResult {
  provider: "paystack";
  reference: string;
  status: string;
  amount: number;
  currency: string;
  raw: unknown;
}

export interface PaymentGateway {
  createPaymentLink(input: PaymentLinkInput): Promise<PaymentLinkResult>;
  verifyPayment(reference: string): Promise<PaymentVerificationResult>;
}

export interface BillingGatewayAdapterInput {
  provider: "paystack";
  secretKey: string;
  mode?: "test" | "live";
}

export type BillingGatewayFailureKind = "definitive_rejection" | "transient";

export class BillingGatewayError extends ConvexError<string> {
  readonly failureKind: BillingGatewayFailureKind;

  constructor(failureKind: BillingGatewayFailureKind, message: string) {
    super(message);
    this.name = "BillingGatewayError";
    this.failureKind = failureKind;
  }
}

export function isDefinitiveBillingGatewayRejection(error: unknown): boolean {
  return error instanceof BillingGatewayError && error.failureKind === "definitive_rejection";
}

function toNairaAmount(amount: number) {
  return Math.round(amount * 100);
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function normalizeGatewayReference(reference: string) {
  const trimmed = reference.trim();
  if (!trimmed) {
    throw new ConvexError("Payment reference is required");
  }

  return trimmed;
}

function gatewayFailureKind(response: Response, payload: unknown): BillingGatewayFailureKind {
  const providerStatus = recordValue(payload)?.status;
  const unavailableStatus = response.status === 401
    || response.status === 403
    || response.status === 404
    || response.status === 408
    || response.status === 425
    || response.status === 429
    || response.status >= 500;
  return providerStatus === false && !unavailableStatus ? "definitive_rejection" : "transient";
}

function transientGatewayMessage(operation: "initialize" | "verify"): string {
  return operation === "initialize"
    ? "Payment provider is temporarily unavailable"
    : "Payment verification is temporarily unavailable";
}

async function requestGateway(url: string, init: RequestInit, operation: "initialize" | "verify"): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new BillingGatewayError("transient", transientGatewayMessage(operation));
  }
}

function throwGatewayFailure(response: Response, payload: unknown, operation: "initialize" | "verify"): never {
  const failureKind = gatewayFailureKind(response, payload);
  const message = operation === "initialize" && failureKind === "definitive_rejection"
    ? "Payment provider rejected the initialization request"
    : transientGatewayMessage(operation);
  throw new BillingGatewayError(failureKind, message);
}

function buildPaystackGateway(secretKey: string, mode: "test" | "live" = "test"): PaymentGateway {
  const baseUrl = "https://api.paystack.co";

  return {
    async createPaymentLink(input: PaymentLinkInput) {
      const reference = normalizeGatewayReference(input.reference);
      const response = await requestGateway(`${baseUrl}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: toNairaAmount(input.amount),
          email: input.email,
          reference,
          callback_url: input.callbackUrl,
          metadata: {
            schoolId: input.schoolId,
            schoolSlug: input.schoolSlug,
            invoiceId: input.invoiceId,
            invoiceNumber: input.invoiceNumber,
            description: input.description,
            paymentProviderMode: input.providerMode ?? mode,
          },
        }),
      }, "initialize");

      const payload = await parseJsonSafe(response);
      const root = recordValue(payload);
      if (!response.ok || root?.status !== true) throwGatewayFailure(response, payload, "initialize");
      const data = recordValue(root.data);

      return {
        provider: "paystack",
        reference,
        authorizationUrl: typeof data?.authorization_url === "string" ? data.authorization_url : null,
        accessCode: typeof data?.access_code === "string" ? data.access_code : null,
        checkoutPayload: root,
      };
    },

    async verifyPayment(reference: string) {
      const normalizedReference = normalizeGatewayReference(reference);
      const response = await requestGateway(
        `${baseUrl}/transaction/verify/${encodeURIComponent(normalizedReference)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        },
        "verify",
      );

      const payload = await parseJsonSafe(response);
      const root = recordValue(payload);
      if (!response.ok || root?.status !== true) throwGatewayFailure(response, payload, "verify");
      const data = recordValue(root.data);
      const verifiedReference = typeof data?.reference === "string" ? data.reference.trim() : "";
      if (!verifiedReference) throw new BillingGatewayError("transient", "Payment verification response was incomplete");
      return {
        provider: "paystack",
        reference: verifiedReference,
        status: String(data?.status ?? "unknown"),
        amount: typeof data?.amount === "number" ? data.amount / 100 : 0,
        currency: String(data?.currency ?? "NGN"),
        raw: payload,
      };
    },
  };
}

export function createBillingGatewayAdapter(input: BillingGatewayAdapterInput): PaymentGateway {
  switch (input.provider) {
    case "paystack":
      return buildPaystackGateway(input.secretKey, input.mode ?? "test");
    default:
      throw new Error(`Unsupported payment provider: ${input.provider}`);
  }
}
