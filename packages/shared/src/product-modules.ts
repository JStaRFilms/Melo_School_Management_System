export type ProductModuleKey =
  | "familyPortal"
  | "billing"
  | "curriculum"
  | "knowledgeLibrary"
  | "admissions";

export type ModuleWorkspace = "Admin" | "Teacher" | "Portal" | "Public";

export interface SchoolModuleFeatures {
  familyPortal?: boolean;
  billing?: boolean;
  curriculum?: boolean;
  knowledgeLibrary?: boolean;
  admissions?: boolean;
}

export type ResolvedSchoolModuleFeatures = Record<ProductModuleKey, boolean>;

export interface ControlledRoute {
  label: string;
  path: string;
  workspace: ModuleWorkspace;
  group: string;
  match?: "exact" | "prefix";
  requires?: ProductModuleKey;
}

export interface PlatformModuleDefinition {
  key: ProductModuleKey;
  title: string;
  shortTitle: string;
  description: string;
  badge: string;
  availability: "available" | "preview";
  iconName: "Landmark" | "BookOpenText" | "Sparkles" | "UserPlus" | "UsersRound";
  workspaceWide?: "portal";
  controlledRoutes: ControlledRoute[];
}

export interface PlatformCoreAreaDefinition {
  key: "operations" | "assessment" | "administration";
  title: string;
  description: string;
  controlledRoutes: ControlledRoute[];
}

export const NEW_SCHOOL_MODULE_DEFAULTS: ResolvedSchoolModuleFeatures = {
  familyPortal: false,
  billing: false,
  curriculum: false,
  knowledgeLibrary: false,
  admissions: false,
};

export function resolveSchoolModuleFeatures(
  features?: SchoolModuleFeatures | null,
): ResolvedSchoolModuleFeatures {
  return {
    // Preserve access for schools created before explicit module selection existed.
    familyPortal: features?.familyPortal ?? true,
    billing: features?.billing ?? true,
    curriculum: features?.curriculum ?? true,
    knowledgeLibrary: features?.knowledgeLibrary ?? true,
    admissions: features?.admissions ?? false,
  };
}

export const PLATFORM_CORE_AREAS: PlatformCoreAreaDefinition[] = [
  {
    key: "operations",
    title: "School operations",
    description: "Student records, staff, school structure, calendars, and day-to-day enrollment work.",
    controlledRoutes: [
      { group: "Overview", label: "Admin Dashboard", path: "/admin/dashboard", workspace: "Admin" },
      { group: "People", label: "Students", path: "/academic/students", workspace: "Admin" },
      { group: "People", label: "Student Onboarding", path: "/academic/students/onboarding", workspace: "Admin" },
      { group: "People", label: "Student Import", path: "/students/import", workspace: "Admin" },
      { group: "People", label: "Student Transfers", path: "/academic/students/transfers", workspace: "Admin" },
      { group: "People", label: "Teachers", path: "/academic/teachers", workspace: "Admin" },
      { group: "School setup", label: "Sessions & Terms", path: "/academic/sessions", workspace: "Admin" },
      { group: "School setup", label: "Classes", path: "/academic/classes", workspace: "Admin" },
      { group: "School setup", label: "Subjects", path: "/academic/subjects", workspace: "Admin" },
      { group: "School setup", label: "Events & Calendar", path: "/academic/events", workspace: "Admin" },
      { group: "Classroom", label: "Teacher Dashboard", path: "/", workspace: "Teacher", match: "exact" },
      { group: "Classroom", label: "Subject Selection", path: "/enrollment/subjects", workspace: "Teacher" },
    ],
  },
  {
    key: "assessment",
    title: "Assessments and reporting",
    description: "Exam setup, score entry, grading policy, report cards, and teacher assessment work.",
    controlledRoutes: [
      { group: "Assessment", label: "Score Entry", path: "/assessments/results/entry", workspace: "Admin" },
      { group: "Assessment", label: "Exam Setup", path: "/assessments/setup/exam-recording", workspace: "Admin" },
      { group: "Assessment", label: "Grading Bands", path: "/assessments/setup/grading-bands", workspace: "Admin" },
      { group: "Reporting", label: "Report Cards", path: "/assessments/report-cards", workspace: "Admin" },
      { group: "Reporting", label: "Report Add-ons", path: "/assessments/setup/report-card-bundles", workspace: "Admin" },
      { group: "Reporting", label: "Manual Adjustments", path: "/assessments/report-cards/manual-adjustments", workspace: "Admin" },
      { group: "Reporting", label: "Historical Backfill", path: "/assessments/report-cards/backfill", workspace: "Admin" },
      { group: "Teacher assessment", label: "Exam Entry", path: "/assessments/exams/entry", workspace: "Teacher" },
      { group: "Teacher assessment", label: "Report Cards", path: "/assessments/report-card-workbench", workspace: "Teacher" },
    ],
  },
  {
    key: "administration",
    title: "Administration and groups",
    description: "School settings, users, permissions, audit records, assets, and group membership.",
    controlledRoutes: [
      { group: "Governance", label: "School Group", path: "/admin/group", workspace: "Admin" },
      { group: "Governance", label: "Audit", path: "/admin/audit", workspace: "Admin" },
      { group: "Governance", label: "Permissions", path: "/admin/permissions", workspace: "Admin" },
      { group: "Administration", label: "Admin Users", path: "/admin", workspace: "Admin", match: "exact" },
      { group: "Administration", label: "School Settings", path: "/admin/settings", workspace: "Admin" },
      { group: "Administration", label: "Institutional Email", path: "/admin/settings/email-domains", workspace: "Admin" },
      { group: "Administration", label: "Admission Numbering", path: "/admin/settings/admission-numbering", workspace: "Admin" },
      { group: "Records", label: "Assets", path: "/admin/assets", workspace: "Admin" },
      { group: "Records", label: "Archive Audit", path: "/academic/archived-records", workspace: "Admin" },
    ],
  },
];

export const PLATFORM_MODULE_DEFINITIONS: PlatformModuleDefinition[] = [
  {
    key: "familyPortal",
    title: "Family portal",
    shortTitle: "Family Portal",
    description: "Parent and student access to results, report cards, notifications, learning resources, and billing.",
    badge: "Family access",
    availability: "available",
    iconName: "UsersRound",
    workspaceWide: "portal",
    controlledRoutes: [
      { group: "Overview", label: "Portal Dashboard", path: "/", workspace: "Portal", match: "exact" },
      { group: "Academic records", label: "Report Cards", path: "/report-cards", workspace: "Portal" },
      { group: "Academic records", label: "Result History", path: "/results", workspace: "Portal" },
      { group: "Communication", label: "Notifications", path: "/notifications", workspace: "Portal" },
      { group: "Learning", label: "Learning Topics", path: "/learning/topics", workspace: "Portal", requires: "knowledgeLibrary" },
      { group: "Finance", label: "Family Billing", path: "/billing", workspace: "Portal", requires: "billing" },
    ],
  },
  {
    key: "billing",
    title: "Finance and collections",
    shortTitle: "Finance",
    description: "Fee plans, invoices, payment instructions, usage, settlements, and the family ledger.",
    badge: "Finance",
    availability: "available",
    iconName: "Landmark",
    controlledRoutes: [
      { group: "Billing", label: "Billing & Invoices", path: "/billing", workspace: "Admin" },
      { group: "Banking", label: "Bank Accounts", path: "/billing/bank-accounts", workspace: "Admin" },
      { group: "Platform account", label: "Subscription", path: "/billing/subscription", workspace: "Admin" },
      { group: "Platform account", label: "Usage", path: "/billing/usage", workspace: "Admin" },
      { group: "Payments", label: "Settlements", path: "/billing/settlements", workspace: "Admin" },
      { group: "Family access", label: "Family Billing", path: "/billing", workspace: "Portal", requires: "familyPortal" },
    ],
  },
  {
    key: "curriculum",
    title: "Curriculum and teaching tools",
    shortTitle: "Teaching Tools",
    description: "Curriculum setup, lesson templates, assessment profiles, and the teacher lesson-planning workspace.",
    badge: "Teaching",
    availability: "available",
    iconName: "BookOpenText",
    controlledRoutes: [
      { group: "Curriculum setup", label: "Curriculum Import", path: "/academic/knowledge/curriculum-import", workspace: "Admin" },
      { group: "Curriculum setup", label: "Curriculum Readiness", path: "/academic/knowledge/curriculum-readiness", workspace: "Admin" },
      { group: "Planning setup", label: "Lesson Templates", path: "/academic/knowledge/templates", workspace: "Admin" },
      { group: "Planning setup", label: "Assessment Profiles", path: "/academic/knowledge/assessment-profiles", workspace: "Admin" },
      { group: "Teacher planning", label: "Planning Home", path: "/planning", workspace: "Teacher", match: "exact" },
      { group: "Teacher planning", label: "Lesson Plans", path: "/planning/lesson-plans", workspace: "Teacher" },
    ],
  },
  {
    key: "knowledgeLibrary",
    title: "Knowledge and learning resources",
    shortTitle: "Knowledge",
    description: "School materials, teacher resources, assessment drafts, videos, and approved student learning topics.",
    badge: "Resources",
    availability: "available",
    iconName: "Sparkles",
    controlledRoutes: [
      { group: "School library", label: "Knowledge Library", path: "/academic/knowledge/library", workspace: "Admin" },
      { group: "Teacher resources", label: "Planning Library", path: "/planning/library", workspace: "Teacher" },
      { group: "Teacher resources", label: "Question Bank", path: "/planning/question-bank", workspace: "Teacher" },
      { group: "Teacher resources", label: "Video Library", path: "/planning/videos", workspace: "Teacher" },
      { group: "Student resources", label: "Learning Topics", path: "/learning/topics", workspace: "Portal", requires: "familyPortal" },
    ],
  },
  {
    key: "admissions",
    title: "Online admissions",
    shortTitle: "Admissions",
    description: "Published application campaigns, applicant forms, document review, decisions, and applicant conversion.",
    badge: "Preview",
    availability: "preview",
    iconName: "UserPlus",
    controlledRoutes: [
      { group: "Admissions office", label: "Campaigns & Applications", path: "/admin/admissions", workspace: "Admin" },
      { group: "Admissions office", label: "Application Review", path: "/admin/admissions/[publicId]", workspace: "Admin" },
      { group: "Admissions office", label: "Retention Settings", path: "/admin/admissions/retention", workspace: "Admin" },
      { group: "Applicant experience", label: "School Admissions", path: "/s/[schoolSlug]", workspace: "Public" },
      { group: "Applicant experience", label: "Application Form", path: "/s/[schoolSlug]/i/[intakeSlug]", workspace: "Public" },
      { group: "Applicant experience", label: "Applicant Account", path: "/s/[schoolSlug]/account", workspace: "Public" },
      { group: "Applicant experience", label: "Application Status", path: "/s/[schoolSlug]/applications/[publicId]", workspace: "Public" },
    ],
  },
];

function pathMatches(path: string, route: ControlledRoute) {
  if (route.match === "exact") return path === route.path;
  return path === route.path || path.startsWith(`${route.path}/`);
}

export function getDisabledProductModule(
  workspace: "admin" | "teacher" | "portal",
  path: string,
  features?: SchoolModuleFeatures | null,
): PlatformModuleDefinition | null {
  const resolved = resolveSchoolModuleFeatures(features);
  const workspaceLabel = `${workspace.charAt(0).toUpperCase()}${workspace.slice(1)}` as Exclude<ModuleWorkspace, "Public">;

  for (const module of PLATFORM_MODULE_DEFINITIONS) {
    if (resolved[module.key]) continue;
    if (module.workspaceWide === workspace) return module;
    if (
      module.controlledRoutes.some(
        (route) => route.workspace === workspaceLabel && pathMatches(path, route),
      )
    ) {
      return module;
    }
  }

  return null;
}
