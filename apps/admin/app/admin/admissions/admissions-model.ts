import type { CampaignFieldInput, CampaignRequirementInput } from "@school/convex/functions/admissions/refs";

export type CampaignEditorValues = {
  programmeSlug: string; programmeName: string; programmeDescription: string; intakeSlug: string; intakeName: string; cycleLabel: string;
  opensAt: string; closesAt: string; schemaVersion: string; declarationTitle: string; declarationBody: string; declarationPurpose: string;
  productSlug: string; productName: string; amount: string; currency: string; refundPolicyKey: string; feeDisclosure: string;
  fieldsJson: string; requirementsJson: string;
};

export const EMPTY_CAMPAIGN: CampaignEditorValues = {
  programmeSlug: "", programmeName: "", programmeDescription: "", intakeSlug: "", intakeName: "", cycleLabel: "", opensAt: "", closesAt: "", schemaVersion: "1", declarationTitle: "", declarationBody: "", declarationPurpose: "", productSlug: "", productName: "", amount: "", currency: "NGN", refundPolicyKey: "", feeDisclosure: "", fieldsJson: "[]", requirementsJson: "[]",
};

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

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
  try { parseDefinitions(values); } catch (error) { errors.push(error instanceof Error ? error.message : "Form definitions are invalid."); }
  return [...new Set(errors)];
}

export function validateRetention(mode: "never" | "archive", days: string): string | null {
  if (mode === "never") return null;
  const parsed = Number(days);
  return Number.isSafeInteger(parsed) && parsed >= 30 ? null : "Archive delay must be an integer of at least 30 days.";
}
