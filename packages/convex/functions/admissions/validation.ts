import { ConvexError } from "convex/values";
import type { Doc } from "../../_generated/dataModel";

export const ADMISSIONS_FIELD_KINDS = [
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "date",
  "boolean",
  "select",
  "multi_select",
] as const;

export type AdmissionsFieldKind = (typeof ADMISSIONS_FIELD_KINDS)[number];
export type AdmissionsValueType = "string" | "number" | "boolean" | "string_array" | "date";
type Scalar = string | number | boolean;

type FieldValidation = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
};

export type AdmissionsCondition = {
  fieldKey: string;
  operator: "equals" | "not_equals" | "in" | "truthy";
  value?: Scalar;
  values?: Scalar[];
};

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConvexError("Admissions rule must be a JSON object");
  }
  return Object.fromEntries(Object.entries(value));
}

function parseJson(value: string, label: string): Record<string, unknown> {
  if (value.length > 4_000) throw new ConvexError(`${label} exceeds the supported size`);
  try {
    return objectValue(JSON.parse(value) as unknown);
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    throw new ConvexError(`${label} must be valid JSON`);
  }
}

function safeInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 20_000) {
    throw new ConvexError(`${label} must be a bounded non-negative integer`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ConvexError(`${label} must be a finite number`);
  return value;
}

export function parseFieldValidation(value: string, kind: AdmissionsFieldKind): FieldValidation {
  const parsed = parseJson(value, "Field validation");
  const allowed = new Set(["minLength", "maxLength", "min", "max", "pattern", "options"]);
  if (Object.keys(parsed).some((key) => !allowed.has(key))) throw new ConvexError("Field validation contains an unsupported rule");
  const result: FieldValidation = {
    minLength: safeInteger(parsed.minLength, "Minimum length"),
    maxLength: safeInteger(parsed.maxLength, "Maximum length"),
    min: finiteNumber(parsed.min, "Minimum value"),
    max: finiteNumber(parsed.max, "Maximum value"),
  };
  if (result.minLength !== undefined && result.maxLength !== undefined && result.minLength > result.maxLength) throw new ConvexError("Field length bounds are invalid");
  if (result.min !== undefined && result.max !== undefined && result.min > result.max) throw new ConvexError("Field numeric bounds are invalid");
  if (parsed.pattern !== undefined) {
    if (typeof parsed.pattern !== "string" || parsed.pattern.length > 240) throw new ConvexError("Field pattern is invalid");
    try { new RegExp(parsed.pattern, "u"); } catch { throw new ConvexError("Field pattern is invalid"); }
    result.pattern = parsed.pattern;
  }
  if (parsed.options !== undefined) {
    if (!Array.isArray(parsed.options) || parsed.options.length < 1 || parsed.options.length > 100 ||
        parsed.options.some((item) => typeof item !== "string" || !item.trim() || item.length > 160) ||
        new Set(parsed.options).size !== parsed.options.length) {
      throw new ConvexError("Field options must be unique bounded strings");
    }
    result.options = parsed.options;
  }
  if ((kind === "select" || kind === "multi_select") !== Boolean(result.options)) {
    throw new ConvexError("Choice fields require options and non-choice fields must not define them");
  }
  return result;
}

function scalar(value: unknown): value is Scalar {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function parseCondition(value: string | undefined): AdmissionsCondition | null {
  if (value === undefined) return null;
  const parsed = parseJson(value, "Conditional rule");
  const allowed = new Set(["fieldKey", "operator", "value", "values"]);
  if (Object.keys(parsed).some((key) => !allowed.has(key)) || typeof parsed.fieldKey !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(parsed.fieldKey)) {
    throw new ConvexError("Conditional rule contains unsupported fields");
  }
  if (parsed.operator !== "equals" && parsed.operator !== "not_equals" && parsed.operator !== "in" && parsed.operator !== "truthy") {
    throw new ConvexError("Conditional rule operator is unsupported");
  }
  if ((parsed.operator === "equals" || parsed.operator === "not_equals") && !scalar(parsed.value)) throw new ConvexError("Conditional comparison requires one scalar value");
  if (parsed.operator === "in" && (!Array.isArray(parsed.values) || parsed.values.length < 1 || parsed.values.length > 20 || !parsed.values.every(scalar))) {
    throw new ConvexError("Conditional membership requires bounded scalar values");
  }
  return {
    fieldKey: parsed.fieldKey,
    operator: parsed.operator,
    ...(scalar(parsed.value) ? { value: parsed.value } : {}),
    ...(Array.isArray(parsed.values) && parsed.values.every(scalar) ? { values: parsed.values } : {}),
  };
}

export function expectedValueType(kind: AdmissionsFieldKind): AdmissionsValueType {
  if (kind === "number") return "number";
  if (kind === "boolean") return "boolean";
  if (kind === "multi_select") return "string_array";
  if (kind === "date") return "date";
  return "string";
}

export function parseSerializedValue(valueType: string, serializedValue: string): unknown {
  if (serializedValue.length > 20_000) throw new ConvexError("Draft answer exceeds the supported size");
  if (valueType === "string") return serializedValue;
  if (valueType === "date" || valueType === "number") {
    const value = Number(serializedValue);
    if (!Number.isFinite(value) || (valueType === "date" && !Number.isSafeInteger(value))) throw new ConvexError("Draft answer has an invalid numeric value");
    return value;
  }
  if (valueType === "boolean") {
    if (serializedValue !== "true" && serializedValue !== "false") throw new ConvexError("Draft answer has an invalid boolean value");
    return serializedValue === "true";
  }
  if (valueType === "string_array") {
    let parsed: unknown;
    try { parsed = JSON.parse(serializedValue) as unknown; } catch { throw new ConvexError("Draft answer has an invalid list value"); }
    if (!Array.isArray(parsed) || parsed.length > 100 || parsed.some((item) => typeof item !== "string")) throw new ConvexError("Draft answer has an invalid list value");
    return parsed;
  }
  throw new ConvexError("Draft answer value type is unsupported");
}

export function validateAnswerForField(
  field: Pick<Doc<"admissionsFormFields">, "kind" | "validationJson">,
  valueType: string,
  serializedValue: string,
): unknown {
  if (!ADMISSIONS_FIELD_KINDS.includes(field.kind as AdmissionsFieldKind)) throw new ConvexError("Published field kind is unsupported");
  const kind = field.kind as AdmissionsFieldKind;
  if (valueType !== expectedValueType(kind)) throw new ConvexError("Draft answer value type does not match the published field");
  const value = parseSerializedValue(valueType, serializedValue);
  const rules = parseFieldValidation(field.validationJson, kind);
  if (typeof value === "string") {
    if (rules.minLength !== undefined && value.length < rules.minLength) throw new ConvexError("Draft answer is shorter than the published minimum");
    if (rules.maxLength !== undefined && value.length > rules.maxLength) throw new ConvexError("Draft answer exceeds the published maximum");
    if (rules.pattern && !new RegExp(rules.pattern, "u").test(value)) throw new ConvexError("Draft answer does not match the published format");
    if (kind === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new ConvexError("Draft answer must be a valid email");
    if (rules.options && !rules.options.includes(value)) throw new ConvexError("Draft answer is not a published option");
  }
  if (typeof value === "number") {
    if (rules.min !== undefined && value < rules.min) throw new ConvexError("Draft answer is below the published minimum");
    if (rules.max !== undefined && value > rules.max) throw new ConvexError("Draft answer exceeds the published maximum");
  }
  if (Array.isArray(value) && rules.options && value.some((item) => !rules.options?.includes(item))) throw new ConvexError("Draft answer contains an unpublished option");
  return value;
}

export function conditionMatches(conditionJson: string | undefined, answers: ReadonlyMap<string, unknown>): boolean {
  const condition = parseCondition(conditionJson);
  if (!condition) return true;
  const actual = answers.get(condition.fieldKey);
  if (condition.operator === "truthy") return Boolean(actual);
  if (condition.operator === "equals") return actual === condition.value;
  if (condition.operator === "not_equals") return actual !== condition.value;
  return scalar(actual) && (condition.values?.includes(actual) ?? false);
}

export function isSensitiveDataClass(value: Doc<"admissionsFormFields">["dataClass"]): boolean {
  return value === "highly_sensitive" || value === "financial_security";
}
