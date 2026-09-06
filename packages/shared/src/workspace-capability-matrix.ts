import { TEACHER_PLANNING_CAPABILITIES, type PermissionCapability } from "./capability-contract";

/** Broad context selectors omit child-derived counts and staff identities unless the caller also has their narrower capability. */
export const ACADEMIC_CONTEXT_CAPABILITIES = [
  "enrollment.intakes.manage", "academic.classes.manage", "academic.subjects.manage",
  "academic.curriculum.manage", "academic.planning.use", "academic.assessments.enter", "academic.assessments.adjust",
  "academic.report_cards.preview", "academic.report_cards.publish_final", "academic.grading_bands.manage",
  "staff.assignments.manage", "finance.reports.view", "finance.fee_plans.manage", "finance.invoices.issue",
  "system.migration.execute",
] as const satisfies readonly PermissionCapability[];

/** Longest path wins. Each route is an admission gate, not permission to every button.
 * Mutations/exports/storage enforce their own catalog capability independently on the server.
 * Unlisted legacy routes fail closed for permission-managed accounts.
 */
export const WORKSPACE_CAPABILITY_MATRIX: readonly {
  workspace: "admin" | "teacher";
  path: string;
  required: readonly PermissionCapability[];
  requiredAny?: readonly PermissionCapability[];
}[] = [
  // The post-sign-in landing is a shell, while each dashboard query remains server-authorized.
  { workspace: "admin", path: "/admin/dashboard", required: [] },
  { workspace: "admin", path: "/academic/students", required: ["enrollment.intakes.manage"] },
  { workspace: "admin", path: "/academic/students/import", required: ["system.migration.execute"] },
  { workspace: "admin", path: "/students/import", required: ["system.migration.execute"] },
  { workspace: "admin", path: "/academic/teachers", required: ["staff.list.view"] },
  { workspace: "admin", path: "/academic/sessions", required: ["academic.classes.manage"] },
  { workspace: "admin", path: "/academic/classes", required: ["academic.classes.manage"] },
  { workspace: "admin", path: "/academic/subjects", required: ["academic.subjects.manage"] },
  { workspace: "admin", path: "/assessments/results/entry", required: ["academic.assessments.enter"] },
  { workspace: "admin", path: "/assessments/report-cards", required: ["academic.report_cards.preview"] },
  { workspace: "admin", path: "/assessments/report-cards/manual-adjustments", required: ["academic.assessments.adjust"] },
  { workspace: "admin", path: "/assessments/report-cards/backfill", required: ["academic.assessments.adjust"] },
  { workspace: "admin", path: "/assessments/report-card-extras", required: ["academic.report_cards.preview"] },
  { workspace: "admin", path: "/assessments/setup", required: ["academic.grading_bands.manage"] },
  { workspace: "admin", path: "/admin/assets", required: ["assets.library.view"] },
  { workspace: "admin", path: "/admin/assets/archive", required: ["assets.library.view", "assets.archive.manage"] },
  { workspace: "admin", path: "/admin/assets/trash", required: ["assets.library.view", "assets.trash.manage"] },
  { workspace: "admin", path: "/admin/permissions", required: ["staff.permissions.manage"] },
  { workspace: "admin", path: "/admin/audit", required: ["audit.branch.view"] },
  { workspace: "admin", path: "/admin/group", required: ["audit.group.view"] },
  { workspace: "admin", path: "/admin/settings", required: ["settings.branding.manage"] },
  { workspace: "admin", path: "/admin/settings/admission-numbering", required: ["enrollment.intakes.manage"] },
  { workspace: "admin", path: "/admin/settings/email-domains", required: ["settings.domains.manage"] },
  { workspace: "admin", path: "/billing", required: ["finance.reports.view"] },
  { workspace: "admin", path: "/billing/bank-accounts", required: ["finance.bank_details.manage"] },
  { workspace: "admin", path: "/billing/settlements", required: ["finance.settlements.view"] },
  { workspace: "admin", path: "/academic/knowledge", required: ["academic.curriculum.manage"] },
  { workspace: "teacher", path: "/planning", required: [], requiredAny: TEACHER_PLANNING_CAPABILITIES },
  { workspace: "teacher", path: "/assessments/exams", required: ["academic.assessments.enter"] },
  { workspace: "teacher", path: "/assessments/report-card-workbench", required: ["academic.report_cards.preview"] },
  { workspace: "teacher", path: "/assessments/report-cards", required: ["academic.report_cards.preview"] },
  { workspace: "teacher", path: "/assessments/report-card-extras", required: ["academic.report_cards.preview"] },
  { workspace: "teacher", path: "/enrollment/subjects", required: ["enrollment.intakes.manage"] },
];
