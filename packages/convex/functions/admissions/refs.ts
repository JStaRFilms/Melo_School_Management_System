import { makeFunctionReference } from "convex/server";
import type { Id } from "../../_generated/dataModel";

export const cleanupUploadIntentRef = makeFunctionReference<
  "mutation",
  { uploadIntentId: Id<"admissionsDocumentUploadIntents"> },
  null
>("functions/admissions/documents:cleanupUploadIntent");

export const beginHttpUploadRef = makeFunctionReference<
  "mutation",
  { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string; uploadAttemptId: string },
  { contentType: string; expectedSize: number; expectedSha256: string }
>("functions/admissions/documents:beginHttpUpload");

export const recordHttpUploadStorageRef = makeFunctionReference<
  "mutation",
  { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string; uploadAttemptId: string; storageId: Id<"_storage"> },
  null
>("functions/admissions/documents:recordHttpUploadStorage");

export const failHttpUploadRef = makeFunctionReference<
  "mutation",
  { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string; uploadAttemptId: string; failureReason: string },
  null
>("functions/admissions/documents:failHttpUpload");

export const processConversionRef = makeFunctionReference<
  "mutation",
  { conversionId: Id<"admissionsConversions"> },
  null
>("functions/admissions/conversion:processAcceptedConversion");

export const conversionTransactionRef = makeFunctionReference<
  "mutation",
  { conversionId: Id<"admissionsConversions"> },
  null
>("functions/admissions/conversion:processAcceptedConversionTransaction");

export const processOnboardingRef = makeFunctionReference<
  "mutation",
  { outboxId: Id<"admissionsCommunicationOutbox"> },
  null
>("functions/admissions/conversion:processOnboarding");

export const queueOnboardingRef = makeFunctionReference<
  "mutation",
  { conversionId: Id<"admissionsConversions"> },
  null
>("functions/admissions/conversion:queueOnboarding");

export const ownedProviderAttemptRef = makeFunctionReference<
  "query",
  { reference: string },
  {
    attemptId: Id<"admissionsPurchaseAttempts">;
    schoolId: Id<"schools">;
    schoolSlug: string;
    guardianEmail: string;
    providerMode: "test" | "live";
    reference: string;
    amountMinor: number;
    currency: string;
    state: string;
    authorizationUrl: string | null;
    entitlementId: Id<"admissionsEntitlements"> | null;
  }
>("functions/admissions/payments:getOwnedProviderAttemptInternal");

export const markCheckoutInitializedRef = makeFunctionReference<
  "mutation",
  { attemptId: Id<"admissionsPurchaseAttempts">; authorizationUrl: string; authorizationReference?: string },
  { state: string; authorizationUrl: string; replayed: boolean }
>("functions/admissions/payments:markCheckoutInitialized");

export const processRetentionCleanupRef = makeFunctionReference<
  "mutation",
  { now?: number; limit?: number },
  { inspected: number; archived: number; deleted: number; blocked: number }
>("functions/admissions/retention:processRetentionCleanup");

export const recordVerifiedPaymentRef = makeFunctionReference<
  "mutation",
  {
    schoolId: Id<"schools">;
    purchaseAttemptId: Id<"admissionsPurchaseAttempts">;
    provider: "paystack" | "flutterwave" | "stripe" | "manual";
    providerMode: "test" | "live";
    providerEventId: string;
    eventType: string;
    bodyDigest: string;
    amountMinor: number;
    currency: string;
    receivedAt: number;
  },
  { eventId: Id<"admissionsPaymentEvents">; entitlementId: Id<"admissionsEntitlements"> | null; replayed: boolean; processed: boolean; state: string }
>("functions/admissions/payments:recordVerifiedPayment");
