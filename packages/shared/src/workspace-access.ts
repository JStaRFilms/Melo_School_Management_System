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
      membership: { membershipId: string; personId: string; displayTitle: string | null } | null;
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
