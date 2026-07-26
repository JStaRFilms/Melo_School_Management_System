import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import {
  hasSchoolCapabilityV1,
  requireAuthIdentityV1,
  resolveSchoolMembershipV1,
} from "../foundation/auth";

type ReadCtx = QueryCtx | MutationCtx;

export const NOT_FOUND_OR_DENIED = "Not found or access denied";

export function normalizeText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new ConvexError(`${label} is required`);
  return normalized;
}

export function opaqueKey(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${prefix}${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Guardian authority is global, derived solely from Convex tokenIdentifier. */
export async function requireGuardian(ctx: ReadCtx) {
  const identity = await requireAuthIdentityV1(ctx);
  const guardian = await ctx.db
    .query("admissionsGuardians")
    .withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!guardian || guardian.status !== "active") throw new ConvexError("Verification required");
  return { guardian, identity };
}

export async function requireStaffScope(
  ctx: ReadCtx,
  args: {
    schoolId: Id<"schools">;
    programmeId: Id<"admissionsProgrammes">;
    intakeId: Id<"admissionsIntakes">;
    capability: Parameters<typeof hasSchoolCapabilityV1>[2];
  },
) {
  const membership = await resolveSchoolMembershipV1(ctx, args.schoolId);
  if (!membership || !(await hasSchoolCapabilityV1(ctx, membership, args.capability, {
    programmeId: args.programmeId,
    intakeId: args.intakeId,
  }))) {
    throw new ConvexError(NOT_FOUND_OR_DENIED);
  }
  return membership;
}

export async function audit(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  actor: { guardianId?: Id<"admissionsGuardians">; userId?: Id<"users">; kind: "guardian" | "staff" | "system" };
  action: string;
  entityType: string;
  entityId: string;
  applicationId?: Id<"admissionsApplications">;
  outcome: "success" | "denied" | "blocked" | "failed";
  reasonCode?: string;
}) {
  await args.ctx.db.insert("admissionsAuditEvents", {
    schoolId: args.schoolId,
    actorKind: args.actor.kind,
    ...(args.actor.guardianId ? { actorGuardianId: args.actor.guardianId } : {}),
    ...(args.actor.userId ? { actorUserId: args.actor.userId } : {}),
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    ...(args.applicationId ? { applicationId: args.applicationId } : {}),
    outcome: args.outcome,
    ...(args.reasonCode ? { reasonCode: args.reasonCode } : {}),
    createdAt: Date.now(),
  });
}

export async function requireOwnedApplication(
  ctx: ReadCtx,
  applicationId: Id<"admissionsApplications">,
) {
  const { guardian } = await requireGuardian(ctx);
  const application = await ctx.db.get(applicationId);
  if (!application || application.guardianId !== guardian._id) {
    throw new ConvexError(NOT_FOUND_OR_DENIED);
  }
  return { guardian, application };
}

export function assertEditable(state: string) {
  if (state !== "draft" && state !== "changes_requested") {
    throw new ConvexError("APPLICATION_LOCKED");
  }
}

type DeclarativeValidation = {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  choices?: string[];
  min?: number;
  max?: number;
  maxSelections?: number;
};

type ConditionalRule = {
  fieldKey: string;
  equals?: string | number | boolean;
  notEquals?: string | number | boolean;
  includes?: string | number | boolean;
  exists?: boolean;
};

/** The renderer and validator deliberately share this closed, data-only field vocabulary. */
export const admissionFieldKinds = ["text", "textarea", "select", "date", "number", "boolean", "checkbox", "multi_select"] as const;
const validationKeys = new Set(["minLength", "maxLength", "pattern", "choices", "min", "max", "maxSelections"]);
const conditionKeys = new Set(["fieldKey", "equals", "notEquals", "includes", "exists"]);

export function assertClosedValidationGrammar(value: string) {
  const policy = parseDeclarativeJson<DeclarativeValidation>(value, "Field validation") ?? {};
  if (Object.keys(policy).some((key) => !validationKeys.has(key)) ||
    (policy.minLength !== undefined && (!Number.isInteger(policy.minLength) || policy.minLength < 0 || policy.minLength > 16_000)) ||
    (policy.maxLength !== undefined && (!Number.isInteger(policy.maxLength) || policy.maxLength < 0 || policy.maxLength > 16_000)) ||
    (policy.minLength !== undefined && policy.maxLength !== undefined && policy.minLength > policy.maxLength) ||
    (policy.pattern !== undefined && (typeof policy.pattern !== "string" || policy.pattern.length > 256)) ||
    (policy.min !== undefined && (!Number.isFinite(policy.min) || policy.min < -1_000_000_000 || policy.min > 1_000_000_000)) ||
    (policy.max !== undefined && (!Number.isFinite(policy.max) || policy.max < -1_000_000_000 || policy.max > 1_000_000_000)) ||
    (policy.min !== undefined && policy.max !== undefined && policy.min > policy.max) ||
    (policy.maxSelections !== undefined && (!Number.isInteger(policy.maxSelections) || policy.maxSelections < 1 || policy.maxSelections > 50)) ||
    (policy.choices !== undefined && (!Array.isArray(policy.choices) || policy.choices.length > 100 || policy.choices.some((choice) => typeof choice !== "string" || !choice.trim() || choice.length > 256)))) {
    throw new ConvexError("Field validation is invalid");
  }
  if (policy.pattern) try { new RegExp(policy.pattern, "u"); } catch { throw new ConvexError("Field validation is invalid"); }
  return policy;
}

export function assertClosedConditionalGrammar(value: string) {
  const rule = parseDeclarativeJson<ConditionalRule>(value, "Conditional rule");
  if (!rule || Object.keys(rule).some((key) => !conditionKeys.has(key)) || !rule.fieldKey || typeof rule.fieldKey !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rule.fieldKey) || rule.fieldKey.length > 128) throw new ConvexError("Conditional rule is invalid");
  const operators = [rule.equals, rule.notEquals, rule.includes, rule.exists].filter((value) => value !== undefined);
  if (operators.length !== 1 || (rule.exists !== undefined && typeof rule.exists !== "boolean") || (rule.exists === undefined && scalar(operators[0]) === null)) throw new ConvexError("Conditional rule is invalid");
  return rule;
}

/** Only a bounded, data-only grammar is accepted; form configuration is never executable. */
export function parseDeclarativeJson<T>(value: string | undefined, label: string): T | null {
  if (!value) return null;
  if (value.length > 4_000) throw new ConvexError(`${label} is invalid`);
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    return parsed as T;
  } catch {
    throw new ConvexError(`${label} is invalid`);
  }
}

function scalar(value: unknown): string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
}

export function answerValue(serializedValue: string, valueType: string): unknown {
  const type = valueType.trim();
  if (type === "text" || type === "textarea" || type === "select" || type === "date") return serializedValue;
  if (type === "number") {
    const number = Number(serializedValue);
    if (!Number.isFinite(number)) throw new ConvexError("ANSWER_INVALID");
    return number;
  }
  if (type === "boolean" || type === "checkbox") {
    if (serializedValue !== "true" && serializedValue !== "false") throw new ConvexError("ANSWER_INVALID");
    return serializedValue === "true";
  }
  if (type === "multi_select") {
    const parsed: unknown = JSON.parse(serializedValue);
    if (!Array.isArray(parsed) || parsed.length > 50 || parsed.some((item) => typeof item !== "string")) throw new ConvexError("ANSWER_INVALID");
    return parsed;
  }
  throw new ConvexError("ANSWER_INVALID");
}

export function validateTypedAnswer(args: { kind: string; valueType: string; serializedValue: string; validationJson: string }) {
  if (args.serializedValue.length > 16_000) throw new ConvexError("Answer is too large");
  const value = answerValue(args.serializedValue, args.valueType);
  const policy = assertClosedValidationGrammar(args.validationJson);
  const isText = typeof value === "string";
  if (isText && (policy.minLength !== undefined && value.length < policy.minLength || policy.maxLength !== undefined && value.length > policy.maxLength)) throw new ConvexError("ANSWER_INVALID");
  if (isText && policy.pattern) {
    if (policy.pattern.length > 256) throw new ConvexError("Field validation is invalid");
    try { if (!new RegExp(policy.pattern, "u").test(value)) throw new ConvexError("ANSWER_INVALID"); } catch (error) { if (error instanceof ConvexError) throw error; throw new ConvexError("Field validation is invalid"); }
  }
  if (typeof value === "number" && ((policy.min !== undefined && value < policy.min) || (policy.max !== undefined && value > policy.max))) throw new ConvexError("ANSWER_INVALID");
  const selections = Array.isArray(value) ? value : [value];
  if (policy.maxSelections !== undefined && Array.isArray(value) && value.length > policy.maxSelections) throw new ConvexError("ANSWER_INVALID");
  if (policy.choices && (!Array.isArray(policy.choices) || policy.choices.length > 100 || policy.choices.some((choice) => typeof choice !== "string") || selections.some((selection) => !policy.choices!.includes(String(selection))))) throw new ConvexError("ANSWER_INVALID");
  return value;
}

export function conditionalRuleMatches(ruleJson: string | undefined, answers: Map<string, unknown>): boolean {
  if (!ruleJson) return false;
  const rule = assertClosedConditionalGrammar(ruleJson);
  const value = answers.get(rule.fieldKey);
  if (rule.exists !== undefined && (typeof rule.exists !== "boolean" || (rule.exists ? value === undefined || value === "" : value !== undefined && value !== ""))) return false;
  for (const [key, expected] of [["equals", rule.equals], ["notEquals", rule.notEquals], ["includes", rule.includes]] as const) {
    if (expected === undefined) continue;
    if (scalar(expected) === null) throw new ConvexError("Conditional rule is invalid");
    if (key === "equals" && value !== expected) return false;
    if (key === "notEquals" && value === expected) return false;
    if (key === "includes" && (!Array.isArray(value) || !value.includes(expected))) return false;
  }
  return true;
}
