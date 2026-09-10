/** Server-derived workspace access. Selection is a request, never authority.
 * Capabilities describe RBAC endpoints only; they do not prove legacy API parity.
 * Teacher record access still requires the domain's class/subject assignment check.
 */
export type WorkspaceAccessSummary =
  | { state: "unauthenticated" }
  | { state: "reconciliation_required" | "forbidden" | "suspended"; message: string }
  | {
      state: "ready";
      branch: { schoolId: string; name: string; slug: string; status: string };
      membership: {
        membershipId: string;
        personId: string;
        displayTitle: string | null;
        isProprietor: boolean;
      } | null;
      displayTitle: string | null;
      effectiveCapabilities: string[];
      compatibility: {
        mode: "canonical" | "legacy_default" | "platform";
        /** Server-derived; absent client evidence never enables compatibility bypass. */
        permissionManaged?: boolean;
        legacyUserId: string | null;
        legacyRole: string | null;
        legacyIsSchoolAdmin: boolean;
        /** Never use the principal fallback as proof of full-admin migration. */
        adminParity: "not_applicable" | "review_required";
        /** Old no-school-argument APIs remain pinned to this default. */
        legacyDefaultSchoolId: string | null;
      };
      teacherAssignments: {
        source: "domain_checks_required";
        legacyTeacherId: string | null;
      };
    };

/**
 * Resolves whether an active workspace user holds unmanaged administrative parity
 * or institutional proprietor authority.
 *
 * In unmanaged workspaces (permissionManaged === false), school administrators
 * and proprietors hold full operational parity across school settings, rosters, and staff.
 * In permission-managed workspaces, only proprietors hold universal parity;
 * delegated staff roles must hold explicit capabilities.
 */
export function hasAdminWorkspaceParity(access?: WorkspaceAccessSummary | null): boolean {
  if (!access || access.state !== "ready") return false;
  const isProprietor = Boolean(access.membership?.isProprietor);
  const isSchoolAdmin = access.compatibility?.legacyIsSchoolAdmin === true || isProprietor;
  const isPermissionManaged = access.compatibility?.permissionManaged === true;
  return isProprietor || (!isPermissionManaged && isSchoolAdmin);
}

/**
 * Evaluates whether an active workspace user holds a specific capability,
 * granting full operational access to school administrators whenever RBAC is unmanaged.
 */
export function hasEffectiveCapability(
  access: WorkspaceAccessSummary | undefined | null,
  capability: string,
): boolean {
  if (!access || access.state !== "ready") return false;
  if (hasAdminWorkspaceParity(access)) return true;
  return access.effectiveCapabilities.includes(capability);
}
