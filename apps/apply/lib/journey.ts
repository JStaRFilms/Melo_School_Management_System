export function formatMoney(amountMinor: number, currency: string) { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100); }

export function availabilityMessage(state: "open" | "upcoming" | "paused" | "closed" | "unavailable", opensAt?: number) {
  if (state === "open") return "Applications are open.";
  if (state === "upcoming") return opensAt ? `Applications open ${new Date(opensAt).toLocaleString()}.` : "Applications are not open yet.";
  if (state === "paused") return "Applications are temporarily paused.";
  if (state === "closed") return "Applications are closed.";
  return "This application offering is unavailable.";
}

export function paymentMessage(state: string) {
  switch (state) {
    case "created": return "Checkout has not started.";
    case "checkout_pending": return "Payment is pending provider verification.";
    case "paid": return "Payment verified. One child application slot is available.";
    case "refunded": return "Payment was refunded. The related slot is not available.";
    case "reversed": return "Payment was reversed. The related application may be on financial hold.";
    case "manual_attention": return "Payment needs manual review; no paid slot is claimed yet.";
    default: return `Payment state: ${state}.`;
  }
}

export function isDraftConflict(error: unknown) { return error instanceof Error && /DRAFT_VERSION_CONFLICT|Draft changed/i.test(error.message); }

export function answerDisplay(kind: string, serializedValue: string) {
  if (kind === "date") { const value = Number(serializedValue); return Number.isSafeInteger(value) ? new Date(value).toISOString().slice(0, 10) : ""; }
  if (kind !== "multi_select") return serializedValue;
  try { const value: unknown = JSON.parse(serializedValue); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : ""; } catch { return ""; }
}

export function answerPayload(kind: string, value: string) {
  if (kind === "number") return { valueType: "number" as const, serializedValue: String(Number(value)) };
  if (kind === "boolean" || kind === "checkbox") return { valueType: "boolean" as const, serializedValue: value === "true" ? "true" : "false" };
  if (kind === "multi_select") return { valueType: "string_array" as const, serializedValue: JSON.stringify(value.split(",").map((item) => item.trim()).filter(Boolean)) };
  if (kind === "date") return { valueType: "date" as const, serializedValue: String(Date.parse(`${value}T00:00:00Z`)) };
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
  if (kind === "date") return Date.parse(`${value}T00:00:00Z`);
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
