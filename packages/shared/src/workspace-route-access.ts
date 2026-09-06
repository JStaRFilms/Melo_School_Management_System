import type { WorkspaceAccessSummary } from "./workspace-access";
import type { WorkspaceKey } from "./workspace-navigation";
import { normalizeCapability } from "./capability-contract";
import { WORKSPACE_CAPABILITY_MATRIX } from "./workspace-capability-matrix";

export interface WorkspaceFeatures {
  billing?: boolean;
  curriculum?: boolean;
  knowledgeLibrary?: boolean;
  admissions?: boolean;
}

export type WorkspaceRouteDecision =
  | { state: "allowed" }
  | { state: "loading" | "unauthenticated" | "forbidden" | "suspended" | "reconciliation_required" | "module_disabled"; message: string };

/** These shells still call legacy default-school APIs. Capabilities are not parity proof. */
export function getLegacyWorkspaceAccess(
  workspace: "admin" | "teacher",
  access: WorkspaceAccessSummary | undefined,
): WorkspaceRouteDecision {
  if (!access) return { state: "loading", message: "Checking workspace access…" };
  if (access.state === "unauthenticated") return { state: access.state, message: "Sign in to open this workspace." };
  if (access.state !== "ready") return access;
  if (access.branch.status !== "active") return { state: "suspended", message: "This school workspace is suspended." };
  const compatibility = access.compatibility;
  if (compatibility.mode === "platform") return { state: "forbidden", message: "Platform governance does not authorize school operations." };
  if (!compatibility.legacyUserId || compatibility.legacyDefaultSchoolId !== access.branch.schoolId) {
    return { state: "reconciliation_required", message: "This route still requires a reviewed legacy default-school account. Branch-scoped access is not available here yet. Contact your school administrator." };
  }
  // Preserve existing shell admission; individual admin-flag actions remain domain checks.
  const isAdmin = compatibility.legacyRole === "admin";
  if (!isAdmin && !(workspace === "teacher" && compatibility.legacyRole === "teacher")) {
    return { state: "forbidden", message: `Your account does not have access to the ${workspace} workspace. Contact your school administrator.` };
  }
  return { state: "allowed" };
}

function within(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

const BRANCH_SCOPED_ROUTES = {
  admin: [
    "/admin/audit",
    "/admin/permissions",
    "/admin/assets",
    "/admin/settings/admission-numbering",
    "/admin/settings/email-domains",
    "/assessments/setup/grading-bands",
  ],
  teacher: [
    "/assessments/exams/entry",
    "/enrollment/subjects",
  ],
  portal: [],
} as const satisfies Record<WorkspaceKey, readonly string[]>;

/** Routes in this allowlist pass the selected school to every mounted data operation. */
export function isWorkspaceBranchScopedRoute(workspace: WorkspaceKey, path: string) {
  return BRANCH_SCOPED_ROUTES[workspace].some((prefix) => within(path, prefix));
}

function getCapabilityRule(workspace: WorkspaceKey, path: string) {
  return WORKSPACE_CAPABILITY_MATRIX.filter(row => row.workspace === workspace && within(path, row.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

function lacksRuleCapability(workspace: WorkspaceKey, path: string, access: Extract<WorkspaceAccessSummary, { state: "ready" }>) {
  const rule = getCapabilityRule(workspace, path);
  if (!rule) return true;
  const caps = new Set(access.effectiveCapabilities.map(normalizeCapability));
  return !rule.required.every(cap => caps.has(normalizeCapability(cap))) ||
    Boolean(rule.requiredAny && !rule.requiredAny.some(cap => caps.has(normalizeCapability(cap))));
}

/** Selected-school routes require canonical membership and exact capability evidence. */
export function getBranchScopedWorkspaceAccess(
  workspace: WorkspaceKey,
  path: string,
  access: WorkspaceAccessSummary | undefined,
): WorkspaceRouteDecision {
  if (!access) return { state: "loading", message: "Checking workspace access…" };
  if (access.state === "unauthenticated") return { state: access.state, message: "Sign in to open this workspace." };
  if (access.state !== "ready") return access;
  if (access.branch.status !== "active") return { state: "suspended", message: "This school workspace is suspended." };
  if (workspace === "portal" || access.compatibility.mode === "platform" || !access.membership) {
    return { state: "forbidden", message: "Explicit active branch membership is required for this scoped route." };
  }
  if (!isWorkspaceBranchScopedRoute(workspace, path)) {
    return { state: "reconciliation_required", message: LEGACY_BRANCH_SWITCH_REASON };
  }
  return lacksRuleCapability(workspace, path, access)
    ? { state: "forbidden", message: "Your current permissions do not allow this operation. Contact your school administrator." }
    : { state: "allowed" };
}

/** The same closed contract gates both sidebar entries and direct URLs before child mount. */
export function getWorkspaceCapabilityDenial(workspace: WorkspaceKey, path: string, access?: WorkspaceAccessSummary): WorkspaceRouteDecision | null {
  if (workspace === "portal") return null;
  if (!access || access.state !== "ready") return getLegacyWorkspaceAccess(workspace, access);
  if (access.compatibility.mode === "platform") return { state: "forbidden", message: "Platform governance does not authorize school operations." };
  const untouched = access.compatibility.permissionManaged === false;
  // Historical shell compatibility applies only with positive server evidence of no RBAC cutover.
  if (untouched) return null;
  const rule = getCapabilityRule(workspace, path);
  if (!rule) return untouched ? null : { state: "forbidden", message: "This legacy route has no reviewed capability contract for managed accounts." };
  return lacksRuleCapability(workspace, path, access)
    ? { state: "forbidden", message: "Your current permissions do not allow this operation. Contact your school administrator." }
    : null;
}

/** Only existing, verified module gates; not the illustrative platform route catalog. */
export function getWorkspaceModuleDenial(
  workspace: WorkspaceKey,
  path: string,
  features?: WorkspaceFeatures | null,
): WorkspaceRouteDecision | null {
  if (workspace !== "admin") return null;
  const disabled = (within(path, "/billing") && features?.billing === false) ||
    (["/academic/knowledge/curriculum-import", "/academic/knowledge/curriculum-readiness"].some(prefix => within(path, prefix)) && features?.curriculum === false) ||
    (within(path, "/academic/knowledge/library") && features?.knowledgeLibrary === false);
  return disabled ? { state: "module_disabled", message: "This module is disabled in your school's workspace configuration. Contact your platform manager to request activation." } : null;
}

export const LEGACY_BRANCH_SWITCH_REASON = "Branch switching is unavailable on this route: its data calls still use your default school. Scoped domain adapters and unsaved-work protection must be ready before switching.";

/** U3a supplies the awaited save/discard/stay implementation. Router/account callers use the same seam. */
export type WorkspaceDeparture =
  | { kind: "link" | "router" | "workspace"; href: string }
  | { kind: "branch"; schoolId: string }
  | { kind: "account" | "sign_out" };
export type RequestWorkspaceDeparture = (departure: WorkspaceDeparture) => Promise<boolean>;
