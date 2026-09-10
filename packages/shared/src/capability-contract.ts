export const CAPABILITY_CATALOG = [
  // Academic Domain
  "academic.curriculum.manage",
  "academic.planning.use",
  "academic.classes.manage",
  "academic.subjects.manage",
  "academic.timetables.manage",
  "academic.grading_bands.manage",
  "academic.assessments.enter",
  "academic.assessments.adjust",
  "academic.report_cards.preview",
  "academic.report_cards.publish_final",
  // Enrollment Domain
  "enrollment.intakes.manage",
  "enrollment.applications.list",
  "enrollment.applications.view_basic",
  "enrollment.applications.view_sensitive",
  "enrollment.documents.review",
  "enrollment.decisions.record",
  "enrollment.admissions.override_number",
  // Finance Domain
  "finance.fee_plans.manage",
  "finance.invoices.issue",
  "finance.payments.record_manual",
  "finance.reports.view",
  "finance.settlements.view",
  "finance.bank_details.manage",
  // Staff & User Domain
  "staff.list.view",
  "staff.onboard",
  "staff.profiles.edit",
  "staff.assignments.manage",
  "staff.permissions.manage",
  "staff.account.suspend",
  "staff.password.reset",
  // Settings Domain
  "settings.general.view",
  "settings.general.edit",
  "settings.branding.manage",
  "settings.domains.request",
  "settings.domains.manage",
  // Assets Domain
  "assets.library.view",
  "assets.metadata.edit",
  "assets.archive.manage",
  "assets.restore",
  "assets.holds.apply",
  "assets.holds.remove",
  "assets.upload",
  "assets.download.standard",
  "assets.download.sensitive",
  "assets.trash.manage",
  "assets.permanent_delete",
  "assets.group_share.manage",
  // Audit Domain
  "audit.branch.view",
  "audit.group.view",
  "audit.export.csv",
  "audit.export.pdf",
  // System Domain
  "system.migration.execute",
  "system.bulk_purge",
  "system.tenant.recover",
  // Canonical Aliases & Ergonomic Shortcuts
  "audit.view",
  "staff.manage",
  "permissions.manage",
  "bank.manage",
  "finance.bank.manage",
  "academic.grading.manage",
  "export.financial",
] as const;

export type PermissionCapability = (typeof CAPABILITY_CATALOG)[number];

/**
 * Teacher planning is independently delegable from curriculum administration.
 * Curriculum managers retain access as an administrative superset without granting
 * managed teachers curriculum governance authority.
 */
export const TEACHER_PLANNING_CAPABILITIES = [
  "academic.planning.use",
  "academic.curriculum.manage",
] as const satisfies readonly PermissionCapability[];

/**
 * Eleven sensitive capabilities with profound security, financial, or legal risk (D-02 §3.3).
 */
export const SENSITIVE_CAPABILITIES: ReadonlySet<string> = new Set([
  "staff.permissions.manage",
  "permissions.manage",
  "finance.bank_details.manage",
  "bank.manage",
  "finance.bank.manage",
  "academic.report_cards.publish_final",
  "enrollment.admissions.override_number",
  "audit.group.view",
  "audit.export.csv",
  "audit.export.pdf",
  "export.financial",
  "staff.password.reset",
  "staff.account.suspend",
  "assets.permanent_delete",
  "assets.holds.remove",
  "settings.domains.manage",
  "system.migration.execute",
  "system.bulk_purge",
  "system.tenant.recover",
]);

/**
 * Normalizes alias capabilities to their canonical D-02 names.
 */
export function normalizeCapability(cap: string): string {
  switch (cap) {
    case "audit.view":
      return "audit.branch.view";
    case "permissions.manage":
      return "staff.permissions.manage";
    case "bank.manage":
    case "finance.bank.manage":
      return "finance.bank_details.manage";
    case "academic.grading.manage":
      return "academic.grading_bands.manage";
    case "staff.manage":
      return "staff.onboard";
    case "export.financial":
      return "finance.reports.view";
    default:
      return cap;
  }
}
