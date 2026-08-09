import type { ApplicationLinkV1, AdmissionsPermissionV1 } from "@school/shared";

export type AdmissionsScope = {
  schoolId: string;
  programmeId?: string | null;
  intakeId?: string | null;
};

export type CapabilityGrant = {
  capability: AdmissionsPermissionV1;
  scope: "school" | "programme" | "intake";
  programmeId: string | null;
  intakeId: string | null;
};

export type QueueState =
  | "draft"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "accepted"
  | "rejected"
  | "waitlisted"
  | "withdrawn"
  | "archived";

export type QueueRow = {
  applicationId: string;
  publicId: string;
  state: string;
  updatedAt: number;
  intakeId: string;
};

export type RedactedQueueRow = Pick<QueueRow, "applicationId" | "publicId" | "state" | "updatedAt" | "intakeId">;

export const MAX_QUEUE_PAGE_SIZE = 100;
export const DEFAULT_QUEUE_PAGE_SIZE = 25;

/** Never add names, documents, addresses, answers, or storage metadata here. */
export function redactQueueRows(rows: readonly QueueRow[]): RedactedQueueRow[] {
  return rows.map(({ applicationId, publicId, state, updatedAt, intakeId }) => ({
    applicationId,
    publicId,
    state,
    updatedAt,
    intakeId,
  }));
}

export function boundedQueueLimit(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_QUEUE_PAGE_SIZE;
  return Math.min(MAX_QUEUE_PAGE_SIZE, Math.max(1, Math.floor(value ?? DEFAULT_QUEUE_PAGE_SIZE)));
}

export function pageRows<T>(rows: readonly T[], page: number, pageSize = DEFAULT_QUEUE_PAGE_SIZE) {
  const boundedSize = boundedQueueLimit(pageSize);
  const boundedPage = Math.max(0, Math.floor(page));
  const start = boundedPage * boundedSize;
  return {
    items: rows.slice(start, start + boundedSize),
    page: boundedPage,
    pageSize: boundedSize,
    hasNextPage: start + boundedSize < rows.length,
    hasPreviousPage: boundedPage > 0,
  };
}

/** Client visibility only. Convex remains the authorization authority. */
export function hasScopedCapability(
  grants: readonly CapabilityGrant[] | undefined,
  capability: AdmissionsPermissionV1,
  scope: Pick<AdmissionsScope, "programmeId" | "intakeId">,
): boolean {
  return Boolean(grants?.some((grant) => {
    if (grant.capability !== capability) return false;
    if (grant.scope === "school") return true;
    if (grant.scope === "programme") return Boolean(scope.programmeId && grant.programmeId === scope.programmeId);
    return Boolean(scope.intakeId && grant.intakeId === scope.intakeId);
  }));
}

export function canStartReview(state: string): boolean {
  return state === "submitted";
}

export function canRequestChanges(state: string, message: string): boolean {
  return (state === "submitted" || state === "under_review") && Boolean(message.trim());
}

export function canRequestCorrections(args: { applicationState: string; guardianMessage: string; selectedItemCount: number }): boolean {
  return canRequestChanges(args.applicationState, args.guardianMessage) && args.selectedItemCount > 0;
}

export type DecisionReadiness = {
  hasSnapshot: boolean;
  requiredDocumentsAccepted: boolean;
  legalEvidenceBound: boolean;
  financeClear: boolean;
  evaluationsComplete: boolean;
  ready: boolean;
};

export function decisionReadinessBlockers(readiness: DecisionReadiness): string[] {
  const blockers: string[] = [];
  if (!readiness.hasSnapshot) blockers.push("A submitted application snapshot is required.");
  if (!readiness.requiredDocumentsAccepted) blockers.push("All required documents must be accepted.");
  if (!readiness.legalEvidenceBound) blockers.push("The submitted declaration evidence is required.");
  if (!readiness.financeClear) blockers.push("Resolve the finance hold before recording a decision.");
  if (!readiness.evaluationsComplete) blockers.push("Complete or cancel scheduled evaluations first.");
  return blockers;
}

export function canRecordDecision(args: { applicationState: string; readiness?: DecisionReadiness; hasSnapshot?: boolean; reasonCode: string; guardianMessage: string }) {
  const ready = args.readiness?.ready ?? Boolean(args.hasSnapshot);
  return ready
    && ["submitted", "under_review", "waitlisted"].includes(args.applicationState)
    && Boolean(args.reasonCode.trim())
    && Boolean(args.guardianMessage.trim());
}

export function canReopenDecision(args: { applicationState: string; conversionState: string | null; reasonCode: string; guardianMessage: string }): boolean {
  return ["accepted", "rejected"].includes(args.applicationState)
    && args.conversionState !== "succeeded"
    && Boolean(args.reasonCode.trim())
    && Boolean(args.guardianMessage.trim());
}

export type SettingsSurfaceAccess = {
  allowed: boolean;
  canEditDrafts: boolean;
  canPublish: boolean;
};

/** UI workflow separation only; every query and mutation re-authorizes server-side. */
export function settingsSurfaceAccess(args: { hasCatalogueCapability: boolean; hasPublishCapability: boolean }): SettingsSurfaceAccess {
  return {
    allowed: args.hasCatalogueCapability || args.hasPublishCapability,
    canEditDrafts: args.hasCatalogueCapability,
    canPublish: args.hasPublishCapability,
  };
}

export function settingsPublicationGate(args: { validationErrors: readonly string[]; hasPublishCapability: boolean; containsSensitiveConfiguration: boolean; hasSensitiveCapability: boolean; privacyEvidenceCurrent: boolean; financeEvidenceCurrent: boolean; declarationPublished: boolean }) {
  const blockers = [...args.validationErrors];
  if (!args.hasPublishCapability) blockers.push("Admissions publish capability is required.");
  if (args.containsSensitiveConfiguration && !args.hasSensitiveCapability) blockers.push("Sensitive configuration capability is required.");
  if (args.containsSensitiveConfiguration && !args.privacyEvidenceCurrent) blockers.push("Current privacy approval evidence is required.");
  if (!args.financeEvidenceCurrent) blockers.push("Current finance approval evidence is required.");
  if (!args.declarationPublished) blockers.push("A published declaration is required.");
  return { allowed: blockers.length === 0, blockers };
}

export function canReviewDocument(state: string, result: "accepted" | "rejected" | "needs_replacement", guardianMessage: string) {
  return state === "uploaded" && (result === "accepted" || Boolean(guardianMessage.trim()));
}

export type DocumentAccessDenialReason = "fresh_auth_required" | "reason_required";

/** Denial reasons are returned only after Convex has authorized the document operation. */
export function documentAccessDeniedMessage(reason?: DocumentAccessDenialReason): string {
  if (reason === "fresh_auth_required") return "Your sign-in is older than five minutes. Sign out and sign in again, then retry.";
  if (reason === "reason_required") return "Enter a checked access reason between 8 and 250 characters, then retry.";
  return "The file is unavailable. Confirm your access and retry.";
}

export type ConversionState = "requested" | "running" | "succeeded" | "failed_retryable" | "failed_terminal" | "resolution_required";
export type ConversionAction = "start" | "wait" | "retry_same_ledger" | "resolve" | "none";

export function conversionAction(state: ConversionState | null, accepted: boolean): ConversionAction {
  if (!accepted) return "none";
  if (!state) return "start";
  if (state === "requested" || state === "running") return "wait";
  if (state === "failed_retryable") return "retry_same_ledger";
  if (state === "failed_terminal" || state === "resolution_required") return "resolve";
  return "none";
}

export type ProgrammeDraft = { name: string; slug: string; status: "draft" | "published" | "inactive" };
export type IntakeDraft = { name: string; slug: string; cycleLabel: string; opensAt: string; closesAt: string; status: "draft" | "open" | "paused" | "closed" };
export type ProductDraft = { name: string; slug: string; slotCount: 1; amountMinor: string; currency: string; feeDisclosure: string; refundPolicyKey: string };
export type FormFieldDraft = { key: string; label: string; kind: "text" | "textarea" | "select" | "date" | "checkbox"; requiredMode: "required" | "optional" | "conditional"; dataClass: "child_confidential" | "sensitive"; purpose: string; retentionPolicy: string; privacyApproval: string };
export type DocumentRequirementDraft = { key: string; label: string; category: string; requiredMode: "required" | "optional" | "conditional"; sensitivity: "child_confidential" | "sensitive"; purpose: string; acceptedMimeTypes: string; maxBytes: string; privacyApproval: string };
export type DeclarationDraft = { title: string; body: string; purpose: string; version: string; mandatory: boolean };

export type AdmissionsSettingsDraft = {
  programme: ProgrammeDraft;
  intake: IntakeDraft;
  product: ProductDraft;
  fields: FormFieldDraft[];
  requirements: DocumentRequirementDraft[];
  declaration: DeclarationDraft;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateAdmissionsSettings(draft: AdmissionsSettingsDraft): string[] {
  const errors: string[] = [];
  if (!draft.programme.name.trim()) errors.push("Programme name is required.");
  if (!slugPattern.test(draft.programme.slug.trim())) errors.push("Programme slug must be URL-safe.");
  if (!draft.intake.name.trim() || !slugPattern.test(draft.intake.slug.trim())) errors.push("Intake name and URL-safe slug are required.");
  if (!draft.intake.opensAt || !draft.intake.closesAt || new Date(draft.intake.opensAt).getTime() >= new Date(draft.intake.closesAt).getTime()) errors.push("The intake closing date must be after its opening date.");
  if (draft.product.slotCount !== 1) errors.push("Each admissions product must create exactly one application slot.");
  if (!/^\d+$/.test(draft.product.amountMinor) || !draft.product.currency.trim() || !draft.product.feeDisclosure.trim() || !draft.product.refundPolicyKey.trim()) errors.push("Price, currency, fee disclosure, and refund policy are required.");
  const keys = new Set<string>();
  for (const field of draft.fields) {
    if (!slugPattern.test(field.key) || !field.label.trim()) errors.push("Each form field needs a stable key and label.");
    if (keys.has(field.key)) errors.push(`Field key “${field.key}” is duplicated.`);
    keys.add(field.key);
    if (field.dataClass === "sensitive" && (!field.purpose.trim() || !field.retentionPolicy.trim() || !field.privacyApproval.trim())) errors.push(`Sensitive field “${field.key}” needs purpose, retention, and privacy approval.`);
  }
  for (const requirement of draft.requirements) {
    if (!slugPattern.test(requirement.key) || !requirement.label.trim() || !requirement.category.trim()) errors.push("Each document requirement needs a stable key, label, and category.");
    if (!/^\d+$/.test(requirement.maxBytes) || !requirement.acceptedMimeTypes.trim()) errors.push(`Document requirement “${requirement.key}” needs bounded file types and size.`);
    if (requirement.sensitivity === "sensitive" && (!requirement.purpose.trim() || !requirement.privacyApproval.trim())) errors.push(`Sensitive document “${requirement.key}” needs purpose and privacy approval.`);
  }
  if (!draft.declaration.title.trim() || !draft.declaration.body.trim() || !draft.declaration.purpose.trim() || !draft.declaration.version.trim()) errors.push("Declaration title, text, purpose, and version are required.");
  return errors;
}

export async function copyCanonicalApplicationLink(
  link: Pick<ApplicationLinkV1, "href">,
  clipboard: Pick<Clipboard, "writeText"> | undefined = typeof navigator === "undefined" ? undefined : navigator.clipboard,
): Promise<boolean> {
  if (!link.href || !clipboard) return false;
  await clipboard.writeText(link.href);
  return true;
}

export type ApplicationLinkCopyStatus = "copied" | "unavailable" | "resolution_failed" | "clipboard_unavailable";

type ApplicationLinkResolver = (args: { schoolSlug: string; intakeSlug: string }) => Promise<ApplicationLinkV1>;

export async function resolveAndCopyApplicationLink(args: {
  schoolSlug?: string;
  intakeSlug?: string;
  resolve: ApplicationLinkResolver;
  clipboard?: Pick<Clipboard, "writeText">;
}): Promise<ApplicationLinkCopyStatus> {
  if (!args.schoolSlug || !args.intakeSlug) return "unavailable";

  let link: ApplicationLinkV1;
  try {
    link = await args.resolve({ schoolSlug: args.schoolSlug, intakeSlug: args.intakeSlug });
  } catch {
    return "resolution_failed";
  }
  if (link.availability === "unavailable") return "unavailable";

  try {
    return await copyCanonicalApplicationLink(link, args.clipboard) ? "copied" : "clipboard_unavailable";
  } catch {
    return "clipboard_unavailable";
  }
}

export function applicationLinkCopyFeedback(status: ApplicationLinkCopyStatus): { title: string; description?: string } {
  if (status === "copied") return { title: "Admissions link copied to clipboard!" };
  if (status === "unavailable") return { title: "Application link unavailable", description: "The canonical Apply link is not currently available for this campaign." };
  if (status === "resolution_failed") return { title: "Could not resolve application link", description: "The canonical Apply link could not be resolved. Please retry." };
  return { title: "Could not copy application link", description: "Clipboard access is unavailable. Copy the canonical link from the Apply surface instead." };
}
