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

function getPaystackSecretKey() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new ConvexError("PAYSTACK_SECRET_KEY is not configured on the Convex deployment.");
  }
  return secretKey;
}

function toNairaAmount(amount: number) {
  return Math.round(amount * 100);
}

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeGatewayReference(reference: string) {
  const trimmed = reference.trim();
  if (!trimmed) {
    throw new ConvexError("Payment reference is required");
  }

  return trimmed;
}

function buildPaystackGateway(): PaymentGateway {
  const secretKey = getPaystackSecretKey();
  const baseUrl = "https://api.paystack.co";

  return {
    async createPaymentLink(input: PaymentLinkInput) {
      const reference = normalizeGatewayReference(input.reference);
      const response = await fetch(`${baseUrl}/transaction/initialize`, {
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
          },
        }),
      });

      const payload = await parseJsonSafe(response);
      if (!response.ok || !payload?.status) {
        throw new ConvexError(payload?.message ?? "Unable to initialize the payment link");
      }

      return {
        provider: "paystack",
        reference,
        authorizationUrl: payload?.data?.authorization_url ?? null,
        accessCode: payload?.data?.access_code ?? null,
        checkoutPayload: payload,
      };
    },

    async verifyPayment(reference: string) {
      const normalizedReference = normalizeGatewayReference(reference);
      const response = await fetch(
        `${baseUrl}/transaction/verify/${encodeURIComponent(normalizedReference)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        }
      );

      const payload = await parseJsonSafe(response);
      if (!response.ok || !payload?.status) {
        throw new ConvexError(payload?.message ?? "Unable to verify the payment");
      }

      const data = payload?.data ?? {};
      return {
        provider: "paystack",
        reference: normalizedReference,
        status: String(data.status ?? payload?.status ?? "unknown"),
        amount: typeof data.amount === "number" ? data.amount / 100 : 0,
        currency: String(data.currency ?? "NGN"),
        raw: payload,
      };
    },
  };
}

export function createBillingGatewayAdapter(provider: "paystack" = "paystack") {
  switch (provider) {
    case "paystack":
      return buildPaystackGateway();
    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
}
