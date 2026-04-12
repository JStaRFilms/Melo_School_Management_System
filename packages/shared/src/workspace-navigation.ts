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
    switchPath: "/academic/teachers",
    appBasePath: "/admin",
    available: true,
    description: "Manage staff, academics, and assessment setup.",
    sections: [
      { href: "/academic/teachers", label: "Teachers", matchers: ["/academic/teachers"] },
      { href: "/admin", label: "Admins", matchers: ["/admin"] },
      { href: "/academic/sessions", label: "Sessions", matchers: ["/academic/sessions"] },
      { href: "/academic/events", label: "Events", matchers: ["/academic/events"] },
      { href: "/academic/subjects", label: "Subjects", matchers: ["/academic/subjects"] },
      { href: "/academic/classes", label: "Classes", matchers: ["/academic/classes"] },
      { href: "/academic/students", label: "Students", matchers: ["/academic/students"] },
      {
        href: "/academic/archived-records",
        label: "Archive Audit",
        matchers: ["/academic/archived-records"],
      },
      {
        href: "/billing",
        label: "Billing",
        matchers: ["/billing"],
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
        label: "Bundle Setup",
        matchers: ["/assessments/setup/report-card-bundles"],
      },
      {
        href: "/assessments/results/entry",
        label: "Score Entry",
        matchers: ["/assessments/results/entry"],
      },
      {
        href: "/assessments/report-card-extras",
        label: "Report Extras",
        matchers: ["/assessments/report-card-extras", "/assessments/report-cards"],
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
    description: "Open teacher workflows for exam entry and enrollment edits.",
    sections: [
      {
        href: "/assessments/exams/entry",
        label: "Exam Entry",
        matchers: ["/assessments/exams", "/assessments/exams/entry"],
      },
      {
        href: "/assessments/report-card-workbench",
        label: "Report Extras",
        matchers: ["/assessments/report-card-workbench", "/assessments/report-card-extras", "/assessments/report-cards"],
      },
      {
        href: "/enrollment/subjects",
        label: "Subject Selection",
        matchers: ["/enrollment/subjects"],
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
        href: "/notifications",
        label: "Notifications",
        matchers: ["/notifications"],
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

export function isWorkspaceSectionActive(section: WorkspaceSection, pathname: string) {
  return section.matchers.some((matcher) =>
    matcher === "/" ? pathname === "/" : pathname.startsWith(matcher)
  );
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
