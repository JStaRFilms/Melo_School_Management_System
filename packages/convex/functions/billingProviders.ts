import { action, internalMutation, internalQuery, mutation } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { ConvexError, v } from "convex/values";
import {
  billingPaystackProviderModeStateValidator,
  billingPaystackProviderOverviewValidator,
  billingPaymentProviderModeValidator,
  billingPaymentProviderStatusValidator,
  normalizeBillingText,
} from "./billingShared";
import { createBillingGatewayAdapter } from "./billingGateway";
import { getAuthenticatedSchoolMembership } from "./academic/auth";

type PaystackMode = "test" | "live";

const paystackProviderValidator = v.literal("paystack");

const savePaystackGatewayConfigValidator = v.object({
  mode: billingPaymentProviderModeValidator,
  publicKey: v.optional(v.union(v.string(), v.null())),
  secretKey: v.optional(v.union(v.string(), v.null())),
});

const validatePaystackGatewayConfigValidator = v.object({
  mode: billingPaymentProviderModeValidator,
});

const resolvePaystackReferenceContextValidator = v.object({
  schoolId: v.id("schools"),
  invoiceId: v.id("studentInvoices"),
  invoiceNumber: v.string(),
  mode: billingPaymentProviderModeValidator,
});

const paystackGatewaySecretContextValidator = v.object({
  schoolId: v.id("schools"),
  provider: paystackProviderValidator,
  mode: billingPaymentProviderModeValidator,
  status: billingPaymentProviderStatusValidator,
  isEnabled: v.boolean(),
  activeSecretKey: v.union(v.string(), v.null()),
  secretSource: v.union(v.literal("active"), v.literal("pending"), v.null()),
  publicKey: v.union(v.string(), v.null()),
  publicKeyMasked: v.union(v.string(), v.null()),
  activeSecretMasked: v.union(v.string(), v.null()),
  pendingSecretMasked: v.union(v.string(), v.null()),
  publicKeyFingerprint: v.union(v.string(), v.null()),
  activeSecretFingerprint: v.union(v.string(), v.null()),
  pendingSecretFingerprint: v.union(v.string(), v.null()),
  lastValidatedAt: v.union(v.number(), v.null()),
  lastValidationMessage: v.union(v.string(), v.null()),
  hasActiveSecret: v.boolean(),
  hasPendingSecret: v.boolean(),
  readyForPayments: v.boolean(),
  readyForWebhookVerification: v.boolean(),
});

function assertAdmin(user: { isSchoolAdmin: boolean }) {
  if (!user.isSchoolAdmin) {
    throw new ConvexError("Admin access required");
  }
}

function getBillingSecretEncryptionKey() {
  const secret = process.env.BILLING_PROVIDER_SECRET_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new ConvexError(
      "BILLING_PROVIDER_SECRET_ENCRYPTION_KEY is not configured on the Convex deployment."
    );
  }

  return secret;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveSecretEncryptionKey() {
  const encoder = new TextEncoder();
  const material = encoder.encode(getBillingSecretEncryptionKey());
  const digest = await crypto.subtle.digest("SHA-256", material);
  return await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function computeCredentialFingerprint(value: string) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function maskCredentialValue(value: string | null | undefined) {
  const normalized = normalizeBillingText(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}••••`;
  }

  return `${normalized.slice(0, 6)}••••${normalized.slice(-4)}`;
}

type SecretEnvelope = {
  version: 1;
  iv: string;
  ciphertext: string;
};

async function encryptSecretValue(secretValue: string) {
  const encoder = new TextEncoder();
  const key = await deriveSecretEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(secretValue)
  );

  const envelope: SecretEnvelope = {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };

  return {
    encryptedSecret: JSON.stringify(envelope),
    fingerprint: await computeCredentialFingerprint(secretValue),
    masked: maskCredentialValue(secretValue),
  };
}

async function decryptSecretValue(encryptedSecret: string) {
  const parsed = JSON.parse(encryptedSecret) as SecretEnvelope;
  if (!parsed || parsed.version !== 1) {
    throw new ConvexError("Unsupported encrypted secret payload");
  }

  const decoder = new TextDecoder();
  const key = await deriveSecretEncryptionKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(parsed.iv) },
    key,
    base64ToBytes(parsed.ciphertext)
  );

  return decoder.decode(plaintext);
}

async function loadPaystackProviderRecord(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  mode: PaystackMode
) {
  return await ctx.db
    .query("schoolPaymentProviders")
    .withIndex("by_school_and_provider_and_mode", (q) =>
      q.eq("schoolId", schoolId).eq("provider", "paystack").eq("mode", mode)
    )
    .unique();
}

async function loadPaystackSecretRecord(
  ctx: QueryCtx | MutationCtx,
  secretId: Id<"schoolPaymentProviderSecrets"> | null | undefined
) {
  if (!secretId) {
    return null;
  }

  return await ctx.db.get(secretId);
}

function buildModeState(args: {
  mode: PaystackMode;
  isEnabled: boolean;
  status: "not_configured" | "invalid" | "ready" | "disabled" | "rotation_pending";
  publicKey: string | null;
  publicKeyMasked: string | null;
  publicKeyFingerprint: string | null;
  activeSecretMasked: string | null;
  pendingSecretMasked: string | null;
  activeSecretFingerprint: string | null;
  pendingSecretFingerprint: string | null;
  lastValidatedAt: number | null;
  lastValidationMessage: string | null;
  hasActiveSecret: boolean;
  hasPendingSecret: boolean;
}) {
  const readyForPayments = args.isEnabled && (args.status === "ready" || args.status === "rotation_pending") && args.hasActiveSecret;

  return {
    provider: "paystack" as const,
    mode: args.mode,
    isEnabled: args.isEnabled,
    status: args.status,
    publicKeyMasked: args.publicKeyMasked,
    activeSecretMasked: args.activeSecretMasked,
    pendingSecretMasked: args.pendingSecretMasked,
    publicKeyFingerprint: args.publicKeyFingerprint,
    activeSecretFingerprint: args.activeSecretFingerprint,
    pendingSecretFingerprint: args.pendingSecretFingerprint,
    lastValidatedAt: args.lastValidatedAt,
    lastValidationMessage: args.lastValidationMessage,
    hasActiveSecret: args.hasActiveSecret,
    hasPendingSecret: args.hasPendingSecret,
    readyForPayments,
    readyForWebhookVerification: args.hasActiveSecret,
  };
}

type BillingPaystackProviderModeState = ReturnType<typeof buildModeState>;

function resolveEffectiveStatus(args: {
  storedStatus: "not_configured" | "invalid" | "ready" | "disabled" | "rotation_pending";
  allowOnlinePayments: boolean;
}) {
  if (!args.allowOnlinePayments) {
    return "disabled" as const;
  }

  return args.storedStatus;
}

async function buildPaystackProviderOverview(
  ctx: QueryCtx,
  schoolId: Id<"schools">
) {
  const settingsRecord = await ctx.db
    .query("schoolBillingSettings")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .unique();

  const configs = await ctx.db
    .query("schoolPaymentProviders")
    .withIndex("by_school_and_provider", (q) =>
      q.eq("schoolId", schoolId).eq("provider", "paystack")
    )
    .collect();

  const configByMode = new Map<PaystackMode, (typeof configs)[number]>();
  for (const config of configs) {
    configByMode.set(config.mode as PaystackMode, config);
  }

  const buildStateForMode = async (mode: PaystackMode) => {
    const record = configByMode.get(mode) ?? null;
    const activeSecret = await loadPaystackSecretRecord(ctx, record?.activeSecretId);
    const pendingSecret = await loadPaystackSecretRecord(ctx, record?.pendingSecretId);
    const hasActiveSecret = Boolean(record?.activeSecretId && activeSecret);
    const hasPendingSecret = Boolean(record?.pendingSecretId && pendingSecret);
    const status = resolveEffectiveStatus({
      storedStatus: (record?.status ?? "not_configured") as
        | "not_configured"
        | "invalid"
        | "ready"
        | "disabled"
        | "rotation_pending",
      allowOnlinePayments: Boolean(settingsRecord?.allowOnlinePayments),
    });

    return buildModeState({
      mode,
      isEnabled: Boolean(settingsRecord?.allowOnlinePayments),
      status,
      publicKey: record?.publicKey ?? null,
      publicKeyMasked: record?.publicKeyMasked ?? maskCredentialValue(record?.publicKey ?? null),
      publicKeyFingerprint: record?.publicKeyFingerprint ?? null,
      activeSecretMasked: record?.activeSecretMasked ?? null,
      pendingSecretMasked: record?.pendingSecretMasked ?? null,
      activeSecretFingerprint: record?.activeSecretFingerprint ?? null,
      pendingSecretFingerprint: record?.pendingSecretFingerprint ?? null,
      lastValidatedAt: record?.lastValidatedAt ?? null,
      lastValidationMessage: record?.lastValidationMessage ?? null,
      hasActiveSecret,
      hasPendingSecret,
    });
  };

  const activeMode = (settingsRecord?.paymentProviderMode ?? "test") as PaystackMode;
  const modes = {
    test: await buildStateForMode("test"),
    live: await buildStateForMode("live"),
  };

  return {
    provider: "paystack" as const,
    activeMode,
    allowOnlinePayments: Boolean(settingsRecord?.allowOnlinePayments),
    readyForPayments: modes[activeMode].readyForPayments,
    modes,
  };
}

export const getSchoolPaystackGatewayOverviewInternal = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  returns: billingPaystackProviderOverviewValidator,
  handler: async (ctx, args) => {
    return await buildPaystackProviderOverview(ctx, args.schoolId);
  },
});

export const resolveSchoolPaystackReferenceContextInternal = internalQuery({
  args: {
    reference: v.string(),
    invoiceId: v.optional(v.id("studentInvoices")),
    invoiceNumber: v.optional(v.string()),
  },
  returns: v.union(v.null(), resolvePaystackReferenceContextValidator),
  handler: async (ctx, args) => {
    const normalizedReference = normalizeBillingText(args.reference);
    if (!normalizedReference) {
      return null;
    }

    const attempt = await ctx.db
      .query("billingPaymentAttempts")
      .withIndex("by_reference", (q) => q.eq("reference", normalizedReference))
      .unique();

    if (attempt) {
      const invoice = await ctx.db.get(attempt.invoiceId);
      if (!invoice) {
        return null;
      }

      return {
        schoolId: attempt.schoolId,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        mode: (attempt.providerMode ?? "test") as PaystackMode,
      };
    }

    if (args.invoiceId) {
      const invoice = await ctx.db.get(args.invoiceId);
      if (!invoice) {
        return null;
      }

      const settingsRecord = await ctx.db
        .query("schoolBillingSettings")
        .withIndex("by_school", (q) => q.eq("schoolId", invoice.schoolId))
        .unique();

      return {
        schoolId: invoice.schoolId,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        mode: (settingsRecord?.paymentProviderMode ?? "test") as PaystackMode,
      };
    }

    if (args.invoiceNumber) {
      const invoices = await ctx.db.query("studentInvoices").take(1000);
      const invoice = invoices.find((entry) => entry.invoiceNumber === args.invoiceNumber);
      if (!invoice) {
        return null;
      }

      const settingsRecord = await ctx.db
        .query("schoolBillingSettings")
        .withIndex("by_school", (q) => q.eq("schoolId", invoice.schoolId))
        .unique();

      return {
        schoolId: invoice.schoolId,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        mode: (settingsRecord?.paymentProviderMode ?? "test") as PaystackMode,
      };
    }

    return null;
  },
});

export const resolveSchoolPaystackGatewaySecretContextInternal = internalQuery({
  args: {
    schoolId: v.id("schools"),
    mode: billingPaymentProviderModeValidator,
    purpose: v.union(
      v.literal("payment_initialization"),
      v.literal("payment_verification"),
      v.literal("webhook_verification"),
      v.literal("validation")
    ),
  },
  returns: v.union(v.null(), paystackGatewaySecretContextValidator),
  handler: async (ctx, args) => {
    const settingsRecord = await ctx.db
      .query("schoolBillingSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    const record = await loadPaystackProviderRecord(ctx, args.schoolId, args.mode);
    const activeSecret = await loadPaystackSecretRecord(ctx, record?.activeSecretId);
    const pendingSecret = await loadPaystackSecretRecord(ctx, record?.pendingSecretId);
    const hasActiveSecret = Boolean(record?.activeSecretId && activeSecret);
    const hasPendingSecret = Boolean(record?.pendingSecretId && pendingSecret);
    const allowOnlinePayments = Boolean(settingsRecord?.allowOnlinePayments);
    const effectiveStatus = resolveEffectiveStatus({
      storedStatus: (record?.status ?? "not_configured") as
        | "not_configured"
        | "invalid"
        | "ready"
        | "disabled"
        | "rotation_pending",
      allowOnlinePayments,
    });

    if (!record && args.purpose === "validation") {
      return null;
    }

    let secretKey: string | null = null;
    let secretSource: "active" | "pending" | null = null;

    if (args.purpose === "validation") {
      if (record?.pendingSecretId && pendingSecret) {
        secretKey = await decryptSecretValue(pendingSecret.encryptedSecret);
        secretSource = "pending";
      } else if (record?.activeSecretId && activeSecret) {
        secretKey = await decryptSecretValue(activeSecret.encryptedSecret);
        secretSource = "active";
      }
    } else if (hasActiveSecret) {
      secretKey = await decryptSecretValue(activeSecret!.encryptedSecret);
      secretSource = "active";
    }

    if (args.purpose === "payment_initialization") {
      const canUseForPayments = allowOnlinePayments && hasActiveSecret && (record?.status === "ready" || record?.status === "rotation_pending");
      if (!canUseForPayments || !secretKey) {
        const state = buildModeState({
          mode: args.mode,
          isEnabled: allowOnlinePayments,
          status: effectiveStatus,
          publicKey: record?.publicKey ?? null,
          publicKeyMasked: record?.publicKeyMasked ?? maskCredentialValue(record?.publicKey ?? null),
          publicKeyFingerprint: record?.publicKeyFingerprint ?? null,
          activeSecretMasked: record?.activeSecretMasked ?? null,
          pendingSecretMasked: record?.pendingSecretMasked ?? null,
          activeSecretFingerprint: record?.activeSecretFingerprint ?? null,
          pendingSecretFingerprint: record?.pendingSecretFingerprint ?? null,
          lastValidatedAt: record?.lastValidatedAt ?? null,
          lastValidationMessage: record?.lastValidationMessage ?? null,
          hasActiveSecret,
          hasPendingSecret,
        });

        return {
          ...state,
          schoolId: args.schoolId,
          activeSecretKey: null,
          secretSource: null,
          publicKey: record?.publicKey ?? null,
        };
      }
    }

    if (args.purpose === "webhook_verification" && !secretKey && hasActiveSecret) {
      secretKey = await decryptSecretValue(activeSecret!.encryptedSecret);
      secretSource = "active";
    }

    if (args.purpose === "webhook_verification" && !secretKey) {
      return null;
    }

    if (args.purpose === "validation" && !secretKey) {
      return null;
    }

    const state = buildModeState({
      mode: args.mode,
      isEnabled: allowOnlinePayments,
      status: effectiveStatus,
      publicKey: record?.publicKey ?? null,
      publicKeyMasked: record?.publicKeyMasked ?? maskCredentialValue(record?.publicKey ?? null),
      publicKeyFingerprint: record?.publicKeyFingerprint ?? null,
      activeSecretMasked: record?.activeSecretMasked ?? null,
      pendingSecretMasked: record?.pendingSecretMasked ?? null,
      activeSecretFingerprint: record?.activeSecretFingerprint ?? null,
      pendingSecretFingerprint: record?.pendingSecretFingerprint ?? null,
      lastValidatedAt: record?.lastValidatedAt ?? null,
      lastValidationMessage: record?.lastValidationMessage ?? null,
      hasActiveSecret,
      hasPendingSecret,
    });

    return {
      ...state,
      schoolId: args.schoolId,
      activeSecretKey: secretKey,
      secretSource,
      publicKey: record?.publicKey ?? null,
    };
  },
});

export const saveSchoolPaystackGatewayConfig = mutation({
  args: savePaystackGatewayConfigValidator,
  returns: billingPaystackProviderModeStateValidator,
  handler: async (ctx, args): Promise<BillingPaystackProviderModeState> => {
    const viewer = await getAuthenticatedSchoolMembership(ctx);
    assertAdmin(viewer);

    const result: BillingPaystackProviderModeState = await ctx.runMutation((internal as any).functions.billingProviders.saveSchoolPaystackGatewayConfigInternal, {
      schoolId: viewer.schoolId,
      userId: viewer.userId,
      mode: args.mode,
      publicKey: args.publicKey ?? null,
      secretKey: args.secretKey ?? null,
    });

    return result;
  },
});

export const validateSchoolPaystackGatewayConfig = action({
  args: validatePaystackGatewayConfigValidator,
  returns: billingPaystackProviderModeStateValidator,
  handler: async (ctx, args): Promise<BillingPaystackProviderModeState> => {
    const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {});
    if (!viewer) {
      throw new ConvexError("Unauthorized");
    }
    assertAdmin({ isSchoolAdmin: viewer.isSchoolAdmin === true });

    const gatewayContext = await ctx.runQuery(
      (internal as any).functions.billingProviders.resolveSchoolPaystackGatewaySecretContextInternal,
      {
        schoolId: viewer.schoolId,
        mode: args.mode,
        purpose: "validation",
      }
    );

    if (!gatewayContext || !gatewayContext.activeSecretKey) {
      throw new ConvexError("Paystack credentials are not ready for validation");
    }

    const gateway = createBillingGatewayAdapter({
      provider: "paystack",
      secretKey: gatewayContext.activeSecretKey,
      mode: args.mode,
    });

    try {
      await gateway.createPaymentLink({
        amount: 1,
        email: `billing-validation+${String(viewer.schoolId)}@example.com`,
        schoolId: String(viewer.schoolId),
        schoolSlug: "billing-validation",
        invoiceId: String(viewer.schoolId),
        invoiceNumber: "VALIDATION",
        description: `Paystack credential validation (${args.mode})`,
        reference: `validation-${String(viewer.schoolId)}-${args.mode}-${Date.now().toString(36)}`,
      });

      const updated: BillingPaystackProviderModeState = await ctx.runMutation((internal as any).functions.billingProviders.markSchoolPaystackGatewayConfigReadyInternal, {
        schoolId: viewer.schoolId,
        mode: args.mode,
        userId: viewer.appUserId,
        successMessage: "Paystack credentials validated successfully",
      });

      return updated;
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Unable to validate Paystack credentials";
      await ctx.runMutation((internal as any).functions.billingProviders.markSchoolPaystackGatewayConfigFailedInternal, {
        schoolId: viewer.schoolId,
        mode: args.mode,
        userId: viewer.appUserId,
        failureMessage,
      });
      throw new ConvexError(failureMessage);
    }
  },
});

export const saveSchoolPaystackGatewayConfigInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    userId: v.id("users"),
    mode: billingPaymentProviderModeValidator,
    publicKey: v.union(v.string(), v.null()),
    secretKey: v.union(v.string(), v.null()),
  },
  returns: billingPaystackProviderModeStateValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await loadPaystackProviderRecord(ctx, args.schoolId, args.mode);
    const secretProvided = Boolean(normalizeBillingText(args.secretKey));
    const publicKeyProvided = Boolean(normalizeBillingText(args.publicKey));

    let nextPublicKey = existing?.publicKey ?? null;
    let nextPublicKeyMasked = existing?.publicKeyMasked ?? null;
    let nextPublicKeyFingerprint = existing?.publicKeyFingerprint ?? null;
    let nextActiveSecretId = existing?.activeSecretId ?? null;
    let nextPendingSecretId = existing?.pendingSecretId ?? null;
    let nextActiveSecretMasked = existing?.activeSecretMasked ?? null;
    let nextPendingSecretMasked = existing?.pendingSecretMasked ?? null;
    let nextActiveSecretFingerprint = existing?.activeSecretFingerprint ?? null;
    let nextPendingSecretFingerprint = existing?.pendingSecretFingerprint ?? null;
    let nextStatus = (existing?.status ?? "not_configured") as
      | "not_configured"
      | "invalid"
      | "ready"
      | "disabled"
      | "rotation_pending";
    let nextLastValidationMessage = existing?.lastValidationMessage ?? null;
    const nextLastValidatedAt = existing?.lastValidatedAt ?? null;

    if (publicKeyProvided) {
      nextPublicKey = normalizeBillingText(args.publicKey) ?? null;
      nextPublicKeyMasked = maskCredentialValue(nextPublicKey);
      nextPublicKeyFingerprint = nextPublicKey ? await computeCredentialFingerprint(nextPublicKey) : null;
    }

    if (secretProvided && args.secretKey) {
      const encrypted = await encryptSecretValue(args.secretKey);
      const secretId = await ctx.db.insert("schoolPaymentProviderSecrets", {
        schoolId: args.schoolId,
        provider: "paystack",
        mode: args.mode,
        encryptedSecret: encrypted.encryptedSecret,
        secretFingerprint: encrypted.fingerprint,
        createdAt: now,
        updatedAt: now,
        createdBy: args.userId,
        updatedBy: args.userId,
      });

      nextPendingSecretId = secretId;
      nextPendingSecretMasked = encrypted.masked;
      nextPendingSecretFingerprint = encrypted.fingerprint;
      nextStatus = existing?.activeSecretId ? "rotation_pending" : "rotation_pending";
      nextLastValidationMessage = "Credential update pending validation";
    } else if (!existing && !secretProvided) {
      nextStatus = "not_configured";
    } else if (!secretProvided && !existing?.activeSecretId && !existing?.pendingSecretId) {
      nextStatus = "not_configured";
    }

    if (!existing && nextStatus === "rotation_pending" && !nextPendingSecretId) {
      nextStatus = "not_configured";
    }

    const payload = {
      schoolId: args.schoolId,
      provider: "paystack" as const,
      mode: args.mode,
      isEnabled: true,
      status: nextStatus,
      publicKey: nextPublicKey,
      publicKeyMasked: nextPublicKeyMasked,
      publicKeyFingerprint: nextPublicKeyFingerprint,
      activeSecretMasked: nextActiveSecretMasked,
      pendingSecretMasked: nextPendingSecretMasked,
      activeSecretId: nextActiveSecretId,
      pendingSecretId: nextPendingSecretId,
      activeSecretFingerprint: nextActiveSecretFingerprint,
      pendingSecretFingerprint: nextPendingSecretFingerprint,
      lastValidatedAt: nextLastValidatedAt,
      lastValidationMessage: nextLastValidationMessage,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      createdBy: existing?.createdBy ?? args.userId,
      updatedBy: args.userId,
    } as const;

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("schoolPaymentProviders", payload);
    }

    return buildModeState({
      mode: args.mode,
      isEnabled: true,
      status: nextStatus,
      publicKey: nextPublicKey,
      publicKeyMasked: nextPublicKeyMasked,
      publicKeyFingerprint: nextPublicKeyFingerprint,
      activeSecretMasked: nextActiveSecretMasked,
      pendingSecretMasked: nextPendingSecretMasked,
      activeSecretFingerprint: nextActiveSecretFingerprint,
      pendingSecretFingerprint: nextPendingSecretFingerprint,
      lastValidatedAt: nextLastValidatedAt,
      lastValidationMessage: nextLastValidationMessage,
      hasActiveSecret: Boolean(nextActiveSecretId),
      hasPendingSecret: Boolean(nextPendingSecretId),
    });
  },
});

export const markSchoolPaystackGatewayConfigReadyInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    mode: billingPaymentProviderModeValidator,
    userId: v.id("users"),
    successMessage: v.string(),
  },
  returns: billingPaystackProviderModeStateValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await loadPaystackProviderRecord(ctx, args.schoolId, args.mode);
    if (!existing) {
      throw new ConvexError("Paystack configuration not found");
    }

    const pendingSecret = existing.pendingSecretId
      ? await loadPaystackSecretRecord(ctx, existing.pendingSecretId)
      : null;
    const activeSecretId = pendingSecret ? existing.pendingSecretId : existing.activeSecretId;
    let activeSecretMasked = existing.activeSecretMasked ?? null;
    let activeSecretFingerprint = existing.activeSecretFingerprint ?? null;

    if (pendingSecret) {
      activeSecretMasked = maskCredentialValue(await decryptSecretValue(pendingSecret.encryptedSecret));
      activeSecretFingerprint = pendingSecret.secretFingerprint;
    }

    const nextPayload = {
      activeSecretId,
      pendingSecretId: null,
      activeSecretMasked,
      pendingSecretMasked: null,
      activeSecretFingerprint,
      pendingSecretFingerprint: null,
      status: "ready" as const,
      lastValidatedAt: now,
      lastValidationMessage: args.successMessage,
      updatedAt: now,
      updatedBy: args.userId,
    };

    await ctx.db.patch(existing._id, nextPayload);

    return buildModeState({
      mode: args.mode,
      isEnabled: true,
      status: "ready",
      publicKey: existing.publicKey ?? null,
      publicKeyMasked: existing.publicKeyMasked ?? maskCredentialValue(existing.publicKey ?? null),
      publicKeyFingerprint: existing.publicKeyFingerprint ?? null,
      activeSecretMasked,
      pendingSecretMasked: null,
      activeSecretFingerprint,
      pendingSecretFingerprint: null,
      lastValidatedAt: now,
      lastValidationMessage: args.successMessage,
      hasActiveSecret: Boolean(activeSecretId),
      hasPendingSecret: false,
    });
  },
});

export const markSchoolPaystackGatewayConfigFailedInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    mode: billingPaymentProviderModeValidator,
    userId: v.id("users"),
    failureMessage: v.string(),
  },
  returns: billingPaystackProviderModeStateValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await loadPaystackProviderRecord(ctx, args.schoolId, args.mode);
    if (!existing) {
      throw new ConvexError("Paystack configuration not found");
    }

    const hasActiveSecret = Boolean(existing.activeSecretId);
    const nextStatus: "invalid" | "rotation_pending" = hasActiveSecret ? "rotation_pending" : "invalid";
    const nextPayload = {
      status: nextStatus,
      lastValidatedAt: now,
      lastValidationMessage: args.failureMessage,
      updatedAt: now,
      updatedBy: args.userId,
    };

    await ctx.db.patch(existing._id, nextPayload);

    return buildModeState({
      mode: args.mode,
      isEnabled: true,
      status: nextStatus,
      publicKey: existing.publicKey ?? null,
      publicKeyMasked: existing.publicKeyMasked ?? maskCredentialValue(existing.publicKey ?? null),
      publicKeyFingerprint: existing.publicKeyFingerprint ?? null,
      activeSecretMasked: existing.activeSecretMasked ?? null,
      pendingSecretMasked: existing.pendingSecretMasked ?? null,
      activeSecretFingerprint: existing.activeSecretFingerprint ?? null,
      pendingSecretFingerprint: existing.pendingSecretFingerprint ?? null,
      lastValidatedAt: now,
      lastValidationMessage: args.failureMessage,
      hasActiveSecret,
      hasPendingSecret: Boolean(existing.pendingSecretId),
    });
  },
});
