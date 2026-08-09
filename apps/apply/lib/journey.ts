export function applicationPath(schoolSlug: string, publicReference: string) {
  return `/s/${encodeURIComponent(schoolSlug)}/applications/${encodeURIComponent(publicReference)}`;
}

export function documentViewPath(schoolSlug: string, publicReference: string, documentKey: string) {
  return `${applicationPath(schoolSlug, publicReference)}/documents/${encodeURIComponent(documentKey)}/view`;
}

export function paymentReturnReference(params: { reference?: string | string[]; trxref?: string | string[] }) {
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  return first(params.reference)?.trim() || first(params.trxref)?.trim() || undefined;
}

export type CheckoutOfferingIdentity = {
  schoolSlug: string;
  intakeSlug: string;
  offeringSlug: string;
};

/** Checkout replay belongs to the resolved offering, never the whole school. */
export function checkoutStorageKey(identity: CheckoutOfferingIdentity) {
  return `apply:checkout:${encodeURIComponent(identity.schoolSlug)}:${encodeURIComponent(identity.intakeSlug)}:${encodeURIComponent(identity.offeringSlug)}`;
}

/** Retained only until a successful paid continuation can clear its exact checkout key. */
export function checkoutReferenceStorageKey(reference: string) {
  return `apply:checkout-reference:${encodeURIComponent(reference)}`;
}

export function checkoutAccountPath(schoolSlug: string, intakeSlug: string) {
  const query = new URLSearchParams({ checkout: "1", intake: intakeSlug });
  return `/s/${encodeURIComponent(schoolSlug)}/account?${query.toString()}`;
}

/** Amounts are server supplied integer minor units; never divide/display floats by hand. */
export function formatMinorCurrency(amountMinor: number, currency: string, locale = currency.toUpperCase() === "NGN" ? "en-NG" : "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    currencyDisplay: "symbol",
  }).format(amountMinor / 100);
}

export function paymentStatusCopy(state: string) {
  if (state === "paid") return "Payment confirmed. Your application slot is ready.";
  if (state === "manual_attention") return "Your payment needs a check. We cannot make an application slot available yet.";
  if (state === "refunded" || state === "reversed") return "This application slot is no longer available. The school is reviewing the payment status for any existing application.";
  if (state === "failed") return "Payment was not completed. No application slot has been created from this attempt.";
  if (state === "expired") return "This checkout session expired. Check payment status before starting another checkout.";
  return "We are confirming your payment. A payment start does not reserve a school place.";
}

export function applicationStatusCopy(state: string, conversionState?: string | null) {
  if (conversionState === "succeeded") return "The school has completed its internal record setup.";
  if (conversionState) return "The school is preparing its internal records.";
  if (state === "accepted") return "The school recorded an acceptance decision.";
  if (state === "rejected") return "The school recorded a decision.";
  if (state === "waitlisted") return "The school recorded a waitlist decision.";
  if (state === "withdrawn") return "This application was withdrawn and cannot be submitted again.";
  if (state === "archived") return "This application is no longer available online under the school’s retention policy.";
  if (state === "under_review") return "The school is reviewing your application. They may contact you if they need changes.";
  if (state === "changes_requested") return "The school asked you to update the items below.";
  if (state === "submitted") return "We received your application. The school is reviewing it; payment and submission do not confirm admission.";
  return "Your application status is available here.";
}

export type PublishedField = {
  key: string;
  kind: string;
  requiredMode: string;
  conditionalRule: string | null;
};

export function parseConditionalRule(rule: string | null): Record<string, unknown> | null {
  if (!rule) return null;
  try {
    const value: unknown = JSON.parse(rule);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

/** Mirrors the bounded server conditional grammar for presentation only. Server remains authoritative. */
export function fieldIsVisible(field: PublishedField, answers: Record<string, string>): boolean {
  if (field.requiredMode !== "conditional") return true;
  const rule = parseConditionalRule(field.conditionalRule);
  const fieldKey = typeof rule?.fieldKey === "string" ? rule.fieldKey : "";
  if (!rule || !fieldKey) return false;
  const value = answers[fieldKey];
  if (typeof rule.exists === "boolean") return rule.exists ? Boolean(value) : !value;
  if (rule && "equals" in rule) return value === String(rule.equals);
  if (rule && "notEquals" in rule) return value !== String(rule.notEquals);
  if ("includes" in (rule ?? {})) {
    try { return JSON.parse(value ?? "[]").includes(rule?.includes); } catch { return false; }
  }
  return false;
}

export function correctionStepHasEditableItems(args: {
  state: string;
  section: string;
  coreKeys: string[];
  fieldKeys: string[];
  requirementKeys: string[];
  fields: Array<{ key: string; sectionKey: string }>;
}): boolean {
  if (args.state !== "changes_requested" || args.section === "review") return true;
  if (args.section === "contacts") return args.coreKeys.some(key => key.startsWith("contact:"));
  if (args.section === "documents") return args.requirementKeys.length > 0;
  if (args.section === "child" && args.coreKeys.some(key => !key.startsWith("contact:"))) return true;
  return args.fields.some(field => field.sectionKey === args.section && args.fieldKeys.includes(field.key));
}

export function serializedValue(kind: string, value: string | boolean | string[]): { valueType: string; serializedValue: string } {
  if (kind === "checkbox" || kind === "boolean") return { valueType: "boolean", serializedValue: String(value === true || value === "true") };
  if (kind === "multi_select") return { valueType: "multi_select", serializedValue: JSON.stringify(Array.isArray(value) ? value : []) };
  if (kind === "number") return { valueType: "number", serializedValue: String(value) };
  if (kind === "textarea") return { valueType: "textarea", serializedValue: String(value) };
  if (kind === "select") return { valueType: "select", serializedValue: String(value) };
  if (kind === "date") return { valueType: "date", serializedValue: String(value) };
  return { valueType: "text", serializedValue: String(value) };
}
