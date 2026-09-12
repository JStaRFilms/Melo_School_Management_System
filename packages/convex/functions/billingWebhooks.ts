import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { matchesPaymentDispatchProviderModeV1 } from "./foundation/paymentDispatch";
import { recordVerifiedPaymentRef } from "./admissions/refs";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function getHeaderValue(request: Request, name: string) {
  return request.headers.get(name) ?? request.headers.get(name.toLowerCase());
}

function normalizeWebhookText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}

function extractPayloadMetadata(payload: unknown) {
  const root = objectValue(payload);
  const data = objectValue(root.data);
  const metadata = objectValue(data.metadata ?? root.metadata);
  const customer = objectValue(data.customer);
  const authorization = objectValue(data.authorization);
  return {
    schoolId: normalizeWebhookText(metadata.schoolId ?? root.schoolId),
    invoiceId: normalizeWebhookText(metadata.invoiceId),
    invoiceNumber: normalizeWebhookText(metadata.invoiceNumber),
    gatewayReference: normalizeWebhookText(data.reference ?? data.gateway_reference ?? root.reference),
    providerMode: normalizeWebhookText(metadata.paymentProviderMode ?? root.paymentProviderMode),
    amountReceived: typeof data.amount === "number" ? data.amount / 100 : typeof root.amount === "number" ? root.amount : undefined,
    amountMinor: typeof data.amount === "number" && Number.isSafeInteger(data.amount) ? data.amount : undefined,
    currency: normalizeWebhookText(data.currency)?.toUpperCase(),
    payerEmail: normalizeWebhookText(customer.email ?? authorization.customer_email ?? metadata.email),
    payerName: normalizeWebhookText(customer.name ?? metadata.payerName ?? customer.first_name),
  };
}

function buildPaystackEventId(payload: unknown) {
  const root = objectValue(payload);
  const data = objectValue(root.data);
  const reference = normalizeWebhookText(data.reference ?? root.reference) ?? "unknown";
  const marker = data.id ?? root.event_id;
  const eventMarker = typeof marker === "number" ? String(marker) : normalizeWebhookText(marker) ?? reference;
  return `paystack:${eventMarker}`;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secret: string
) {
  if (!signature || typeof crypto?.subtle === "undefined") {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody)
  );
  const actual = Array.from(new Uint8Array(signatureBytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const provided = signature.trim().toLowerCase();

  if (provided.length !== actual.length) {
    return false;
  }

  return actual === provided;
}

export const handlePaymentWebhook = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405);
  }

  const providerHeader = normalizeWebhookText(getHeaderValue(request, "x-payment-provider"));
  const paystackSignature = getHeaderValue(request, "x-paystack-signature");
  const provider = providerHeader?.toLowerCase() === "flutterwave"
    ? "flutterwave"
    : providerHeader?.toLowerCase() === "stripe"
      ? "stripe"
      : "paystack";

  if (provider !== "paystack") {
    return jsonResponse(
      { ok: false, message: "This webhook foundation currently supports Paystack payloads only." },
      501
    );
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonResponse({ ok: false, message: "Webhook body must be valid JSON." }, 400);
  }

  const metadata = extractPayloadMetadata(payload);
  const reference = metadata.gatewayReference ?? buildPaystackEventId(payload);

  const referenceContext = await ctx.runQuery(
    internal.functions.foundation.paymentDispatch.resolvePaymentDispatchContextInternal,
    { reference }
  );

  if (!referenceContext) {
    return jsonResponse(
      {
        ok: false,
        message: "Webhook payload must include a resolvable payment reference.",
      },
      400
    );
  }

  if (metadata.schoolId && String(metadata.schoolId) !== String(referenceContext.schoolId)) {
    return jsonResponse(
      { ok: false, message: "Webhook invoice reference does not belong to the resolved school." },
      400
    );
  }

  if (!matchesPaymentDispatchProviderModeV1(referenceContext, provider, metadata.providerMode)) {
    return jsonResponse(
      { ok: false, message: "Webhook payment reference does not match the resolved provider or merchant mode." },
      400
    );
  }

  const gatewayContext = await ctx.runQuery(
    internal.functions.billingProviders.resolveSchoolPaystackGatewaySecretContextInternal,
    {
      schoolId: referenceContext.schoolId,
      mode: referenceContext.providerMode,
      purpose: "webhook_verification",
    }
  );

  if (!gatewayContext || !gatewayContext.activeSecretKey) {
    return jsonResponse(
      {
        ok: false,
        message: "Paystack credentials are not configured for the resolved school and mode.",
      },
      400
    );
  }

  const signatureValid = await verifyPaystackSignature(rawBody, paystackSignature, gatewayContext.activeSecretKey);
  if (!signatureValid) {
    return jsonResponse({ ok: false, message: "Invalid payment signature." }, 401);
  }

  const eventId = buildPaystackEventId(payload);
  const eventType = normalizeWebhookText(objectValue(payload).event) ?? "payment.webhook";

  const receivedAt = Date.now();
  if (referenceContext.domain === "billing") {
    await ctx.runMutation(
      internal.functions.billing.recordVerifiedGatewayEventInternal,
      {
        schoolId: referenceContext.schoolId,
        provider: "paystack",
        providerMode: referenceContext.providerMode,
        eventId,
        eventType,
        reference,
        invoiceId: referenceContext.invoiceId,
        invoiceNumber: referenceContext.invoiceNumber,
        gatewayReference: metadata.gatewayReference ?? reference,
        amountReceived: metadata.amountReceived,
        payerName: metadata.payerName,
        payerEmail: metadata.payerEmail,
        rawBody,
        payload,
        signatureValid: true,
        verificationMessage: "Paystack signature verified",
        attemptReconciliationSource: "webhook",
        receivedAt,
      }
    );
  } else {
    // Admissions payloads never persist raw webhook bodies. The signed,
    // merchant-resolved envelope is fulfilled transactionally and replay-safe.
    if (metadata.amountMinor === undefined || !metadata.currency) {
      return jsonResponse({ ok: false, message: "Verified admissions payment metadata is incomplete." }, 400);
    }
    await ctx.runMutation(
      recordVerifiedPaymentRef,
      {
        schoolId: referenceContext.schoolId,
        purchaseAttemptId: referenceContext.purchaseAttemptId,
        provider: "paystack",
        providerMode: referenceContext.providerMode,
        providerEventId: eventId,
        eventType,
        bodyDigest: await sha256Hex(rawBody),
        amountMinor: metadata.amountMinor,
        currency: metadata.currency,
        receivedAt,
      }
    );
  }

  return jsonResponse({ ok: true });
});
