import { ConvexError } from "convex/values";

export const PAID_USAGE_UNAVAILABLE = "Paid generation and provider OCR are unavailable until plan entitlements, confirmed estimates, reservation dispatch and provider reconciliation are enabled. No customer allowance was charged.";

// Deliberately no environment-variable bypass: API keys alone are not entitlement authority.
export function assertPaidUsageAvailable(): void {
  throw new ConvexError(PAID_USAGE_UNAVAILABLE);
}
