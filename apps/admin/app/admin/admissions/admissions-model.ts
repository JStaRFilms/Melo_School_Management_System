import type { CampaignFieldInput, CampaignRequirementInput } from "@school/convex/functions/admissions/refs";

export type CampaignEditorValues = {
  programmeSlug: string; programmeName: string; programmeDescription: string; intakeSlug: string; intakeName: string; cycleLabel: string;
  opensAt: string; closesAt: string; schemaVersion: string; declarationTitle: string; declarationBody: string; declarationPurpose: string;
  productSlug: string; productName: string; amount: string; currency: string; refundPolicyKey: string; feeDisclosure: string;
  priceApprovalEvidenceId: string; priceApprovalSubjectKey: string; fieldsJson: string; requirementsJson: string;
};

function localDateTime(value: Date, hour: number) {
  const local = new Date(value);
  local.setHours(hour, 0, 0, 0);
  const offset = local.getTimezoneOffset() * 60_000;
  return new Date(local.getTime() - offset).toISOString().slice(0, 16);
}

export function nextCampaignDefinitionKey(prefix: "question" | "document", existingKeys: readonly string[]) {
  const used = new Set(existingKeys);
  let suffix = 1;
  while (used.has(`${prefix}-${suffix}`)) suffix += 1;
  return `${prefix}-${suffix}`;
}

export function slugifyCampaignValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createCampaignEditorValues(now = new Date()): CampaignEditorValues {
  const closes = new Date(now);
  closes.setDate(closes.getDate() + 30);
  const academicYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    programmeSlug: "",
    programmeName: "",
    programmeDescription: "",
    intakeSlug: "",
    intakeName: "",
    cycleLabel: `${academicYear}/${academicYear + 1}`,
    opensAt: localDateTime(now, 9),
    closesAt: localDateTime(closes, 17),
    schemaVersion: "1",
    declarationTitle: "Parent or legal guardian declaration",
    declarationBody: "I confirm that the information in this application is true and complete to the best of my knowledge. I understand that false or incomplete information may affect this application or any resulting admission.",
    declarationPurpose: "Confirm the accuracy of the application and the guardian's authority to submit it.",
    productSlug: "application-fee",
    productName: "Application fee",
    amount: "",
    currency: "NGN",
    refundPolicyKey: "non-refundable",
    feeDisclosure: "This application fee covers the review and processing of one child's application and is non-refundable after payment.",
    priceApprovalEvidenceId: "",
    priceApprovalSubjectKey: "",
    fieldsJson: "[]",
    requirementsJson: "[]",
  };
}

export const EMPTY_CAMPAIGN = createCampaignEditorValues();

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

export function fieldChoiceOptions(field: CampaignFieldInput): string[] {
  try {
    const parsed: unknown = JSON.parse(field.validationJson);
    if (typeof parsed === "object" && parsed !== null && "options" in parsed && Array.isArray(parsed.options)) {
      return parsed.options.filter((option): option is string => typeof option === "string");
    }
  } catch {
    return [];
  }
  return [];
}

export function withCleanChoiceOptions(field: CampaignFieldInput): CampaignFieldInput {
  if (field.kind !== "select" && field.kind !== "multi_select") return field;
  const options = fieldChoiceOptions(field).map((option) => option.trim()).filter(Boolean);
  return { ...field, validationJson: JSON.stringify({ options }) };
}

export function parseDefinitions(values: CampaignEditorValues): { fields: CampaignFieldInput[]; requirements: CampaignRequirementInput[] } {
  const fields: unknown = JSON.parse(values.fieldsJson);
  const requirements: unknown = JSON.parse(values.requirementsJson);
  if (!Array.isArray(fields) || !Array.isArray(requirements)) throw new Error("Fields and requirements must be JSON arrays.");
  for (const field of fields) {
    if (!isObject(field) || typeof field.fieldKey !== "string" || typeof field.sectionKey !== "string" || typeof field.kind !== "string" || typeof field.label !== "string" || typeof field.requiredMode !== "string" || typeof field.dataClass !== "string" || typeof field.validationJson !== "string" || typeof field.order !== "number") throw new Error("Every field needs key, section, kind, label, required mode, data class, validation JSON, and order.");
  }
  for (const item of requirements) {
    if (!isObject(item) || typeof item.requirementKey !== "string" || typeof item.category !== "string" || typeof item.label !== "string" || typeof item.requiredMode !== "string" || !Array.isArray(item.acceptedMimeTypes) || typeof item.maxBytes !== "number" || typeof item.maxFiles !== "number" || typeof item.sensitivity !== "string" || typeof item.purpose !== "string" || typeof item.order !== "number") throw new Error("Every document requirement needs its key, limits, sensitivity, purpose, and order.");
  }
  return { fields: fields as CampaignFieldInput[], requirements: requirements as CampaignRequirementInput[] };
}

export function validateCampaign(values: CampaignEditorValues): string[] {
  const errors: string[] = [];
  const required = [values.programmeSlug, values.programmeName, values.intakeSlug, values.intakeName, values.cycleLabel, values.opensAt, values.closesAt, values.declarationTitle, values.declarationBody, values.declarationPurpose, values.productSlug, values.productName, values.amount, values.currency, values.refundPolicyKey, values.feeDisclosure];
  if (required.some((value) => !value.trim())) errors.push("Complete all required campaign, declaration, and fee fields.");
  const opensAt = Date.parse(values.opensAt), closesAt = Date.parse(values.closesAt);
  if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt) || closesAt <= opensAt) errors.push("Closing time must be after opening time.");
  const amount = Number(values.amount);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) <= 0) errors.push("Application fee must be greater than zero.");
  if (!/^[A-Z]{3}$/.test(values.currency)) errors.push("Currency must be a three-letter uppercase code.");
  try {
    const parsed = parseDefinitions(values);
    if (parsed.fields.some((field) => (field.kind === "select" || field.kind === "multi_select") && fieldChoiceOptions(field).filter((option) => option.trim()).length < 2)) {
      errors.push("Each choice question needs at least two options.");
    }
  } catch (error) { errors.push(error instanceof Error ? error.message : "Form definitions are invalid."); }
  return [...new Set(errors)];
}

export function validateRetention(mode: "never" | "archive", days: string): string | null {
  if (mode === "never") return null;
  const parsed = Number(days);
  return Number.isSafeInteger(parsed) && parsed >= 30 ? null : "Archive delay must be an integer of at least 30 days.";
}
