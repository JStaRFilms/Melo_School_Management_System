import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { matchesPaymentDispatchProviderModeV1 } from "./foundation/paymentDispatch";

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

function extractPayloadMetadata(payload: any) {
  const data = payload?.data ?? {};
  const metadata = data?.metadata ?? payload?.metadata ?? {};

  return {
    schoolId: normalizeWebhookText(metadata.schoolId ?? payload?.schoolId),
    invoiceId: normalizeWebhookText(metadata.invoiceId),
    invoiceNumber: normalizeWebhookText(metadata.invoiceNumber),
    gatewayReference: normalizeWebhookText(
      data.reference ?? data.gateway_reference ?? data?.transaction?.reference ?? payload?.reference
    ),
    providerMode: normalizeWebhookText(metadata.paymentProviderMode ?? payload?.paymentProviderMode),
    amountReceived:
      typeof data.amount === "number"
        ? data.amount / 100
        : typeof payload?.amount === "number"
          ? payload.amount
          : undefined,
    payerEmail: normalizeWebhookText(
      data?.customer?.email ?? data?.authorization?.customer_email ?? metadata.email
    ),
    payerName: normalizeWebhookText(
      data?.customer?.name ?? metadata.payerName ?? data?.customer?.first_name
    ),
  };
}

function buildPaystackEventId(payload: any) {
  const data = payload?.data ?? {};
  const reference = normalizeWebhookText(data.reference ?? data?.transaction?.reference ?? payload?.reference) ?? "unknown";
  const eventMarker = normalizeWebhookText(data.id ?? payload?.event_id) ?? reference;
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
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, message: "Webhook body must be valid JSON." }, 400);
  }

  const metadata = extractPayloadMetadata(payload);
  const reference =
    metadata.gatewayReference ??
    normalizeWebhookText(payload?.data?.reference) ??
    buildPaystackEventId(payload);

  const referenceContext: any = await ctx.runQuery(
    (internal as any).functions.foundation.paymentDispatch.resolvePaymentDispatchContextInternal,
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

  const gatewayContext: any = await ctx.runQuery(
    (internal as any).functions.billingProviders.resolveSchoolPaystackGatewaySecretContextInternal,
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
  const eventType = normalizeWebhookText(payload?.event) ?? "payment.webhook";

  if (referenceContext.domain === "admissions") {
    const receipt = payload?.data ?? {};
    const supported = new Set(["charge.success", "charge.failed", "charge.pending", "refund.pending", "refund.processed", "refund.failed", "charge.refund", "charge.reversed", "charge.reversal", "chargeback.created", "chargeback.resolved", "charge.dispute.create", "charge.dispute.remind", "charge.dispute.resolve"]);
    if (!supported.has(eventType)) return jsonResponse({ ok: false, message: "Unsupported admissions payment event." }, 400);
    if (eventType === "charge.success") {
      const amountMinor = typeof receipt.amount === "number" && Number.isInteger(receipt.amount) ? receipt.amount : null;
      const currency = normalizeWebhookText(receipt.currency)?.toUpperCase();
      if (receipt.status !== "success" || amountMinor !== referenceContext.amountMinor || currency !== referenceContext.currency.toUpperCase()) {
        return jsonResponse({ ok: false, message: "Webhook payment receipt does not match the expected successful admissions payment." }, 400);
      }
    }
  }

  const receivedAt = Date.now();
  if (referenceContext.domain === "billing") {
    await ctx.runMutation(
      (internal as any).functions.billing.recordVerifiedGatewayEventInternal,
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
    // Admissions payloads never persist raw webhook bodies. Supported signed
    // finance lifecycle events are reduced to a digest and replay ledger.
    const recorded: any = await ctx.runMutation(
      (internal as any).functions.foundation.paymentDispatch.recordVerifiedAdmissionsPaymentEventInternal,
      {
        schoolId: referenceContext.schoolId,
        purchaseAttemptId: referenceContext.purchaseAttemptId,
        provider: "paystack",
        providerMode: referenceContext.providerMode,
        providerEventId: eventId,
        eventType,
        bodyDigest: await sha256Hex(rawBody),
        receivedAt,
      }
    );
    await ctx.runMutation(
      (internal as any).functions.admissions.payments.fulfilVerifiedEvent,
      { paymentEventId: recorded.eventId }
    );
  }

  return jsonResponse({ ok: true });
});
