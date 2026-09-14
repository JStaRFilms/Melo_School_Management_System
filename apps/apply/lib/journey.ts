export function formatMoney(amountMinor: number, currency: string) { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100); }

export function availabilityMessage(state: "open" | "upcoming" | "paused" | "closed" | "unavailable", opensAt?: number) {
  if (state === "open") return "Applications are open.";
  if (state === "upcoming") return opensAt ? `Applications open ${new Date(opensAt).toLocaleString()}.` : "Applications are not open yet.";
  if (state === "paused") return "Applications are temporarily paused.";
  if (state === "closed") return "Applications are closed.";
  return "This application offering is unavailable.";
}

export const PAYMENT_STATES = ["created", "checkout_pending", "verification_pending", "paid", "failed", "expired", "manual_attention", "refunded", "reversed"] as const;
export type PaymentState = typeof PAYMENT_STATES[number];

export function paymentMessage(state: string) {
  switch (state) {
    case "created": return "Checkout has not started. No payment or application place has been confirmed.";
    case "checkout_pending": return "Checkout is open or incomplete. Payment has not been verified, and no admission place is reserved.";
    case "verification_pending": return "The payment check is still pending. No paid application slot or admission place is confirmed yet.";
    case "paid": return "Payment is verified and one child application slot is available. This is not an admission decision or a reserved school place.";
    case "failed": return "This payment attempt was unsuccessful. No application slot or admission place was created.";
    case "expired": return "This checkout expired without verified payment. You can check for a late payment, but no place is reserved.";
    case "manual_attention": return "This payment needs school review. No paid application slot or admission place is confirmed yet.";
    case "refunded": return "This payment was refunded. The related slot is unavailable and no admission place is reserved.";
    case "reversed": return "This payment was reversed. The related application may be on financial hold; contact the school before taking further action.";
    default: return "The latest payment status is unavailable. Contact the school if you need help.";
  }
}

export function applicationStateMessage(state: string) {
  switch (state) {
    case "draft": return "This application is a draft and has not been submitted.";
    case "submitted": return "This application was submitted for review. Submission does not guarantee admission or reserve a place.";
    case "under_review": return "The school is reviewing this application. A place has not been offered or reserved.";
    case "changes_requested": return "The school requested changes. Update only the requested information and resubmit it for review.";
    case "waitlisted": return "This application is waitlisted. The waitlist is not an offer of admission and does not reserve a place.";
    case "accepted": return "The school recorded an acceptance decision. Enrollment setup is a separate step.";
    case "rejected": return "The school recorded that this application was not accepted.";
    case "withdrawn": return "This application was withdrawn and is no longer under consideration.";
    case "archived": return "This application has been archived and is no longer active.";
    default: return "Contact the school for the latest application status.";
  }
}

export function shortenPaymentReference(reference: string) {
  if (reference.length <= 14) return reference;
  return `${reference.slice(0, 8)}…${reference.slice(-4)}`;
}

export function canContinueCheckout(state: string) {
  return state === "created" || state === "checkout_pending";
}

export function canCheckPayment(state: string) {
  return state === "checkout_pending" || state === "verification_pending" || state === "failed" || state === "expired" || state === "manual_attention";
}

export function isDraftConflict(error: unknown) { return error instanceof Error && /DRAFT_VERSION_CONFLICT|Draft changed/i.test(error.message); }

export function dateInputToUtcTimestamp(value: string) { return Date.parse(`${value}T00:00:00Z`); }

export function answerDisplay(kind: string, serializedValue: string) {
  if (kind === "date") { const value = Number(serializedValue); return Number.isSafeInteger(value) ? new Date(value).toISOString().slice(0, 10) : ""; }
  if (kind !== "multi_select") return serializedValue;
  try { const value: unknown = JSON.parse(serializedValue); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : ""; } catch { return ""; }
}

export function answerPayload(kind: string, value: string) {
  if (kind === "number") return { valueType: "number" as const, serializedValue: String(Number(value)) };
  if (kind === "boolean" || kind === "checkbox") return { valueType: "boolean" as const, serializedValue: value === "true" ? "true" : "false" };
  if (kind === "multi_select") return { valueType: "string_array" as const, serializedValue: JSON.stringify(value.split(",").map((item) => item.trim()).filter(Boolean)) };
  if (kind === "date") return { valueType: "date" as const, serializedValue: String(dateInputToUtcTimestamp(value)) };
  return { valueType: "string" as const, serializedValue: value };
}

type ConditionalRule = { fieldKey: string; operator: "equals" | "not_equals" | "in" | "truthy"; value?: string | number | boolean; values?: Array<string | number | boolean> };

function parseRule(value: string | null): ConditionalRule | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || typeof Reflect.get(parsed, "fieldKey") !== "string") return null;
    const operator = Reflect.get(parsed, "operator");
    if (operator !== "equals" && operator !== "not_equals" && operator !== "in" && operator !== "truthy") return null;
    return { fieldKey: Reflect.get(parsed, "fieldKey"), operator, value: Reflect.get(parsed, "value"), values: Array.isArray(Reflect.get(parsed, "values")) ? Reflect.get(parsed, "values") : undefined } as ConditionalRule;
  } catch { return null; }
}

function typedAnswer(kind: string, value: string): string | number | boolean | string[] | undefined {
  if (!value) return undefined;
  if (kind === "boolean") return value === "true";
  if (kind === "number") return Number(value);
  if (kind === "multi_select") return value.split(",").map((item) => item.trim()).filter(Boolean);
  if (kind === "date") return dateInputToUtcTimestamp(value);
  return value;
}

export function conditionMatchesAnswers(ruleJson: string | null, answers: Record<string, string>, fieldKinds: ReadonlyMap<string, string>) {
  const rule = parseRule(ruleJson);
  if (!rule) return ruleJson === null;
  const actual = typedAnswer(fieldKinds.get(rule.fieldKey) ?? "text", answers[rule.fieldKey] ?? "");
  if (rule.operator === "truthy") return Boolean(actual) && (!Array.isArray(actual) || actual.length > 0);
  if (rule.operator === "equals") return actual === rule.value;
  if (rule.operator === "not_equals") return actual !== rule.value;
  return !Array.isArray(actual) && actual !== undefined && Boolean(rule.values?.includes(actual));
}

export function fieldOptions(validationJson: string) {
  try { const parsed: unknown = JSON.parse(validationJson); const options = parsed && typeof parsed === "object" ? Reflect.get(parsed, "options") : null; return Array.isArray(options) ? options.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
}

export function correctionAllows(state: string, correctionKeys: string[] | undefined, key: string) { return state === "draft" || (state === "changes_requested" && Boolean(correctionKeys?.includes(key))); }

export function validateSubmissionInput(input: { signerName: string; signerRelationship: string; declarationAccepted: boolean }) {
  if (!input.signerName.trim()) return "Enter the signer name.";
  if (!input.signerRelationship.trim()) return "Enter the signer relationship.";
  if (!input.declarationAccepted) return "Accept the published declaration before submitting.";
  return null;
}

export function documentSelectionError(input: {
  file: { size: number; type: string };
  acceptedMimeTypes: string[];
  maxBytes: number;
  maxFiles: number;
  activeFileCount: number;
  replacementAllowed: boolean;
}) {
  if (input.file.size < 1) return "Choose a non-empty file.";
  if (!input.acceptedMimeTypes.includes(input.file.type)) return "Choose one of the accepted file types shown above.";
  if (input.file.size > input.maxBytes) return `This file is too large. The maximum size is ${formatFileSize(input.maxBytes)}.`;
  if (input.activeFileCount >= input.maxFiles && !input.replacementAllowed) return `You can upload at most ${input.maxFiles} file${input.maxFiles === 1 ? "" : "s"} for this requirement.`;
  return null;
}

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MiB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KiB`;
  return `${bytes} bytes`;
}

export function missingRequiredItemLabels(input: {
  fields: Array<{ fieldKey: string; label: string; requiredMode: string; conditionalRuleJson: string | null }>;
  requirements: Array<{ requirementId: string; label: string; requiredMode: string; conditionJson: string | null }>;
  answers: Record<string, string>;
  fieldKinds: ReadonlyMap<string, string>;
  documents: Array<{ requirementId: string | null; state: string }>;
}) {
  const requiredFields = input.fields
    .filter((field) => field.requiredMode === "required" || (field.requiredMode === "conditional" && conditionMatchesAnswers(field.conditionalRuleJson, input.answers, input.fieldKinds)))
    .filter((field) => !input.answers[field.fieldKey]?.trim())
    .map((field) => field.label);
  const requiredDocuments = input.requirements
    .filter((requirement) => requirement.requiredMode === "required" || (requirement.requiredMode === "conditional" && conditionMatchesAnswers(requirement.conditionJson, input.answers, input.fieldKinds)))
    .filter((requirement) => !input.documents.some((document) => document.requirementId === requirement.requirementId && (document.state === "uploaded" || document.state === "accepted")))
    .map((requirement) => requirement.label);
  return [...requiredFields, ...requiredDocuments];
}
