import type { WorkspaceAccessSummary } from "./workspace-access";
import { getLegacyWorkspaceAccess, getWorkspaceModuleDenial, getWorkspaceCapabilityDenial, type WorkspaceFeatures } from "./workspace-route-access";

export type WorkspaceKey = "admin" | "teacher" | "portal";

export interface WorkspaceSection {
  href: string;
  label: string;
  matchers: string[];
}

export interface WorkspaceDefinition {
  key: WorkspaceKey;
  label: string;
  audience: string;
  switchPath: string;
  appBasePath: string;
  available: boolean;
  description: string;
  sections: WorkspaceSection[];
}

const DEV_ORIGINS: Record<WorkspaceKey, string> = {
  admin: "http://localhost:3002",
  teacher: "http://localhost:3001",
  portal: "http://localhost:3003",
};

export const workspaceDefinitions: Record<WorkspaceKey, WorkspaceDefinition> = {
  admin: {
    key: "admin",
    label: "Admin",
    audience: "School operations",
    switchPath: "/admin/dashboard",
    appBasePath: "/admin",
    available: true,
    description: "Manage daily school operations first, with setup and maintenance close by.",
    sections: [
      // 1. Overview
      { href: "/admin/dashboard", label: "Dashboard", matchers: ["/admin/dashboard"] },

      // 2. People & Operations
      { href: "/academic/students", label: "Students", matchers: ["/academic/students$"] },
      { href: "/academic/students/transfers", label: "Transfers", matchers: ["/academic/students/transfers"] },
      { href: "/academic/teachers", label: "Teachers", matchers: ["/academic/teachers"] },
      { href: "/academic/events", label: "Events & Calendar", matchers: ["/academic/events"] },

      // 3. Academic & Grading
      { href: "/assessments/results/entry", label: "Score Entry", matchers: ["/assessments/results/entry"] },
      {
        href: "/assessments/report-cards",
        label: "Report Cards",
        matchers: ["/assessments/report-cards", "/assessments/report-card-extras"],
      },
      {
        href: "/assessments/setup/exam-recording",
        label: "Exam Setup",
        matchers: ["/assessments/setup/exam-recording"],
      },
      {
        href: "/assessments/setup/grading-bands",
        label: "Grading Bands",
        matchers: ["/assessments/setup/grading-bands"],
      },
      {
        href: "/assessments/setup/report-card-bundles",
        label: "Report Add-ons",
        matchers: ["/assessments/setup/report-card-bundles"],
      },
      {
        href: "/assessments/report-cards/manual-adjustments",
        label: "Manual Adjustments",
        matchers: ["/assessments/report-cards/manual-adjustments"],
      },
      {
        href: "/academic/knowledge/library",
        label: "Knowledge Library",
        matchers: ["/academic/knowledge/library"],
      },
      {
        href: "/academic/knowledge/curriculum-import",
        label: "Curriculum Import",
        matchers: ["/academic/knowledge/curriculum-import"],
      },
      {
        href: "/academic/knowledge/curriculum-readiness",
        label: "Curriculum Readiness",
        matchers: ["/academic/knowledge/curriculum-readiness"],
      },
      {
        href: "/academic/knowledge/templates",
        label: "Lesson Templates",
        matchers: ["/academic/knowledge/templates"],
      },
      {
        href: "/academic/knowledge/assessment-profiles",
        label: "Assessment Profiles",
        matchers: ["/academic/knowledge/assessment-profiles"],
      },

      // 4. Finance & Invoicing
      { href: "/billing", label: "Billing & Invoices", matchers: ["/billing$"] },
      { href: "/billing/bank-accounts", label: "Bank Accounts", matchers: ["/billing/bank-accounts"] },
      { href: "/admin/audit", label: "Audit", matchers: ["/admin/audit"] },
      { href: "/admin/permissions", label: "Permissions", matchers: ["/admin/permissions"] },

      // 5. Setup & Settings
      { href: "/academic/sessions", label: "Sessions & Terms", matchers: ["/academic/sessions"] },
      { href: "/academic/classes", label: "Classes", matchers: ["/academic/classes"] },
      { href: "/academic/subjects", label: "Subjects", matchers: ["/academic/subjects"] },
      { href: "/students/import", label: "Import Students", matchers: ["/students/import", "/academic/students/import"] },
      { href: "/admin/assets", label: "School Assets", matchers: ["/admin/assets"] },
      { href: "/admin/settings", label: "School Settings", matchers: ["/admin/settings"] },
      { href: "/admin", label: "Admin Users", matchers: ["/admin"] },
      {
        href: "/academic/archived-records",
        label: "Archive Audit",
        matchers: ["/academic/archived-records"],
      },
      {
        href: "/assessments/report-cards/backfill",
        label: "Historical Backfill",
        matchers: ["/assessments/report-cards/backfill"],
      },
    ],
  },
  teacher: {
    key: "teacher",
    label: "Teacher",
    audience: "Classroom tools",
    switchPath: "/assessments/exams/entry",
    appBasePath: "/teacher",
    available: true,
    description: "Open teacher workflows for exam entry, planning, and enrollment edits.",
    sections: [
      {
        href: "/assessments/exams/entry",
        label: "Exam Entry",
        matchers: ["/assessments/exams", "/assessments/exams/entry"],
      },
      {
        href: "/assessments/report-card-workbench",
        label: "Report Cards",
        matchers: ["/assessments/report-card-workbench", "/assessments/report-card-extras", "/assessments/report-cards"],
      },
      {
        href: "/enrollment/subjects",
        label: "Subject Selection",
        matchers: ["/enrollment/subjects"],
      },
      {
        href: "/planning",
        label: "Planning",
        matchers: ["/planning$", "/planning/lesson-plans", "/planning/question-bank"],
      },
      {
        href: "/planning/library",
        label: "Library",
        matchers: ["/planning/library"],
      },
      {
        href: "/planning/videos",
        label: "Videos",
        matchers: ["/planning/videos"],
      },
    ],
  },
  portal: {
    key: "portal",
    label: "Portal",
    audience: "Students & parents",
    switchPath: "/",
    appBasePath: "/portal",
    available: true,
    description: "Parent and student academic dashboard.",
    sections: [
      { href: "/", label: "Dashboard", matchers: ["/"] },
      {
        href: "/report-cards",
        label: "Report Cards",
        matchers: ["/report-cards"],
      },
      { href: "/results", label: "Result History", matchers: ["/results"] },
      {
        href: "/learning/topics",
        label: "Learning Topics",
        matchers: ["/learning/topics"],
      },
      {
        href: "/notifications",
        label: "Notifications",
        matchers: ["/notifications"],
      },
      {
        href: "/billing",
        label: "Billing",
        matchers: ["/billing"],
      },
    ],
  },
};

function isLocalhostOrigin(origin: string) {
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(new URL(origin).hostname);
}

export function getWorkspaceDefinition(workspace: WorkspaceKey) {
  return workspaceDefinitions[workspace];
}

export function getWorkspaceSections(workspace: WorkspaceKey) {
  return workspaceDefinitions[workspace].sections;
}

/** Navigation uses the same legacy/module decision as the owning layout, not guessed RBAC mappings. */
export function getAccessibleWorkspaceSections(
  workspace: WorkspaceKey,
  options: { access?: WorkspaceAccessSummary; features?: WorkspaceFeatures | null; userRole?: string | null } = {},
) {
  if (workspace !== "portal" && options.access && getLegacyWorkspaceAccess(workspace, options.access).state !== "allowed") return [];
  return getWorkspaceSections(workspace).filter(section =>
    !getWorkspaceModuleDenial(workspace, section.href, options.features) &&
    (!options.access || !getWorkspaceCapabilityDenial(workspace, section.href, options.access)) &&
    !(workspace === "portal" && section.href === "/learning/topics" && options.userRole !== "student")
  );
}

export function isWorkspaceSectionActive(section: WorkspaceSection, pathname: string) {
  return section.matchers.some((matcher) => {
    if (matcher.endsWith("$")) {
      return pathname === matcher.slice(0, -1);
    }
    return matcher === "/" ? pathname === "/" : pathname === matcher || pathname.startsWith(`${matcher}/`);
  });
}

export function resolveWorkspaceSwitchHref(
  workspace: WorkspaceKey,
  currentOrigin?: string
) {
  const definition = workspaceDefinitions[workspace];

  if (!definition.available) {
    return null;
  }

  if (currentOrigin) {
    if (isLocalhostOrigin(currentOrigin)) {
      return `${DEV_ORIGINS[workspace]}${definition.switchPath}`;
    }

    return `${currentOrigin}${definition.appBasePath}${definition.switchPath}`;
  }

  return `${DEV_ORIGINS[workspace]}${definition.switchPath}`;
}

export function getWorkspaceAreaLinks(
  currentWorkspace: WorkspaceKey,
  currentOrigin?: string
) {
  return (Object.keys(workspaceDefinitions) as WorkspaceKey[]).map((workspace) => {
    const definition = workspaceDefinitions[workspace];

    return {
      key: definition.key,
      label: definition.label,
      audience: definition.audience,
      description: definition.description,
      available: definition.available,
      current: workspace === currentWorkspace,
      href: resolveWorkspaceSwitchHref(workspace, currentOrigin),
    };
  });
}

export function getWorkspaceDefaultHref(workspace: WorkspaceKey) {
  const definition = workspaceDefinitions[workspace];
  return definition.sections.length > 0 ? definition.sections[0].href : "/";
}

export interface ControlledRoute {
  label: string;
  path: string;
  workspace: "Admin" | "Teacher" | "Portal" | "Public";
}

export interface PlatformModuleDefinition {
  key: "billing" | "curriculum" | "knowledgeLibrary" | "admissions";
  title: string;
  description: string;
  badge: string;
  iconName: "Landmark" | "BookOpenText" | "Sparkles" | "UserPlus";
  controlledRoutes: ControlledRoute[];
}

export const PLATFORM_MODULE_DEFINITIONS: PlatformModuleDefinition[] = [
  {
    key: "billing",
    title: "Finance & Fee Billing",
    description: "Invoicing, fee schedules, student accounts, payment records, and financial ledger.",
    badge: "Core Optional",
    iconName: "Landmark",
    controlledRoutes: [
      { label: "Billing Overview", path: "/billing", workspace: "Admin" },
      { label: "Fee Schedules & Invoices", path: "/billing/schedules", workspace: "Admin" },
      { label: "Parent Fee Ledger", path: "/portal/fees", workspace: "Portal" },
    ],
  },
  {
    key: "curriculum",
    title: "Curriculum & Planning Studio",
    description: "Teacher planning tools, curriculum syllabus import, and scheme readiness checkers.",
    badge: "Academic",
    iconName: "BookOpenText",
    controlledRoutes: [
      { label: "Curriculum Import", path: "/academic/knowledge/curriculum-import", workspace: "Admin" },
      { label: "Curriculum Readiness", path: "/academic/knowledge/curriculum-readiness", workspace: "Admin" },
      { label: "Lesson Templates", path: "/academic/knowledge/templates", workspace: "Admin" },
      { label: "Lesson Planning Studio", path: "/planning", workspace: "Teacher" },
    ],
  },
  {
    key: "knowledgeLibrary",
    title: "AI Knowledge Library",
    description: "AI-indexed school documents, scheme-of-work repositories, and shared learning assets.",
    badge: "AI Powered",
    iconName: "Sparkles",
    controlledRoutes: [
      { label: "Knowledge Library", path: "/academic/knowledge/library", workspace: "Admin" },
      { label: "AI Question Generator", path: "/planning/drafts", workspace: "Teacher" },
    ],
  },
  {
    key: "admissions",
    title: "Online Admissions Portal",
    description: "Public application forms, guardian intake portal, and enrollment conversions.",
    badge: "Tier Add-on",
    iconName: "UserPlus",
    controlledRoutes: [
      { label: "Admissions Pipeline", path: "/admissions/pipeline", workspace: "Admin" },
      { label: "Student Intake Forms", path: "/apply", workspace: "Public" },
    ],
  },
];
