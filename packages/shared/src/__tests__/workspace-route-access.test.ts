import { describe, expect, it } from "vitest";
import type { WorkspaceAccessSummary } from "../workspace-access";
import { getLegacyWorkspaceAccess, getWorkspaceModuleDenial, getWorkspaceCapabilityDenial } from "../workspace-route-access";
import { getAccessibleWorkspaceSections, isWorkspaceSectionActive } from "../workspace-navigation";

const ready: Extract<WorkspaceAccessSummary, { state: "ready" }> = {
  state: "ready", branch: { schoolId: "default", name: "School", slug: "school", status: "active" },
  membership: null, displayTitle: "Principal", effectiveCapabilities: [],
  compatibility: { mode: "legacy_default", permissionManaged: false, legacyUserId: "user", legacyRole: "admin", legacyIsSchoolAdmin: false, adminParity: "review_required", legacyDefaultSchoolId: "default" },
  teacherAssignments: { source: "domain_checks_required", legacyTeacherId: null },
};

describe("legacy workspace authority", () => {
  it("keeps legacy admin access without requiring principal baseline parity", () => {
    expect(getLegacyWorkspaceAccess("admin", ready).state).toBe("allowed");
    expect(getAccessibleWorkspaceSections("admin", { access: ready })).not.toHaveLength(0);
  });
  it("preserves teacher admission without treating an admin flag as full shell parity", () => {
    const teacher = { ...ready, compatibility: { ...ready.compatibility, legacyRole: "teacher" } };
    expect(getLegacyWorkspaceAccess("admin", teacher).state).toBe("forbidden");
    expect(getLegacyWorkspaceAccess("teacher", teacher).state).toBe("allowed");
    expect(getLegacyWorkspaceAccess("admin", { ...teacher, compatibility: { ...teacher.compatibility, legacyIsSchoolAdmin: true } }).state).toBe("forbidden");
    expect(getLegacyWorkspaceAccess("teacher", { ...teacher, compatibility: { ...teacher.compatibility, legacyRole: "student" } }).state).toBe("forbidden");
  });
  it("does not use capability or title as a legacy projection or switched-route adapter", () => {
    for (const access of [
      { ...ready, compatibility: { ...ready.compatibility, legacyUserId: null } },
      { ...ready, branch: { ...ready.branch, schoolId: "other" } },
      { ...ready, compatibility: { ...ready.compatibility, legacyDefaultSchoolId: null } },
    ]) {
      expect(getLegacyWorkspaceAccess("admin", access).state).toBe("reconciliation_required");
      expect(getAccessibleWorkspaceSections("admin", { access })).toEqual([]);
    }
  });
  it("distinguishes loading, signed out, suspended, revoked and reconciliation states", () => {
    expect(getLegacyWorkspaceAccess("admin", undefined).state).toBe("loading");
    expect(getLegacyWorkspaceAccess("admin", { state: "unauthenticated" }).state).toBe("unauthenticated");
    for (const state of ["suspended", "forbidden", "reconciliation_required"] as const) {
      const access = { state, message: "Contact administrator" };
      expect(getLegacyWorkspaceAccess("admin", access)).toEqual(access);
      expect(getAccessibleWorkspaceSections("admin", { access })).toEqual([]);
    }
  });
});

describe("managed capability navigation and deep links", () => {
  it("admits the managed-account landing shell without granting unreviewed routes", () => {
    const access = { ...ready, compatibility: { ...ready.compatibility, permissionManaged: true } };
    expect(getWorkspaceCapabilityDenial("admin", "/admin/dashboard", access)).toBeNull();
    expect(getAccessibleWorkspaceSections("admin", { access }).map(section => section.href)).toEqual(["/admin/dashboard"]);
    expect(getWorkspaceCapabilityDenial("admin", "/unknown", access)?.state).toBe("forbidden");
  });
  it("admits only the exact Admin Users route for directory viewers", () => {
    const access = { ...ready, compatibility: { ...ready.compatibility, permissionManaged: true }, effectiveCapabilities: ["staff.list.view"] };
    expect(getWorkspaceCapabilityDenial("admin", "/admin", access)).toBeNull();
    expect(getAccessibleWorkspaceSections("admin", { access }).map(section => section.href)).toContain("/admin");
    expect(getWorkspaceCapabilityDenial("admin", "/admin/unreviewed", access)?.state).toBe("forbidden");
  });
  it.each([
    ["/academic/students", "enrollment.intakes.manage"],
    ["/billing", "finance.reports.view"],
    ["/admin/audit", "audit.branch.view"],
    ["/admin/permissions", "staff.permissions.manage"],
    ["/admin/settings", "settings.branding.manage"],
    ["/assessments/report-cards", "academic.report_cards.preview"],
  ])("uses the same effective permission for %s navigation and nested URLs", (path, capability) => {
    const access = { ...ready, compatibility: { ...ready.compatibility, permissionManaged: true }, effectiveCapabilities: [capability] };
    expect(getWorkspaceCapabilityDenial("admin", `${path}/detail`, access)).toBeNull();
    expect(getAccessibleWorkspaceSections("admin", { access }).some(s => s.href === path)).toBe(true);
    const restricted = { ...access, effectiveCapabilities: [] };
    expect(getWorkspaceCapabilityDenial("admin", `${path}/detail`, restricted)?.state).toBe("forbidden");
    expect(getAccessibleWorkspaceSections("admin", { access: restricted }).some(s => s.href === path)).toBe(false);
  });
  it("admits managed teacher planning without granting curriculum administration or upload authority", () => {
    const planning = { ...ready, compatibility: { ...ready.compatibility, permissionManaged: true }, effectiveCapabilities: ["academic.planning.use"] };
    expect(getWorkspaceCapabilityDenial("teacher", "/planning/library", planning)).toBeNull();
    expect(getAccessibleWorkspaceSections("teacher", { access: planning }).map(section => section.href)).toContain("/planning");
    expect(getWorkspaceCapabilityDenial("admin", "/academic/knowledge/library", planning)?.state).toBe("forbidden");

    const uploadOnly = { ...planning, effectiveCapabilities: ["assets.upload"] };
    expect(getWorkspaceCapabilityDenial("teacher", "/planning/library", uploadOnly)?.state).toBe("forbidden");
    const curriculumManager = { ...planning, effectiveCapabilities: ["academic.curriculum.manage"] };
    expect(getWorkspaceCapabilityDenial("teacher", "/planning/library", curriculumManager)).toBeNull();
  });
  it("never treats a Platform identity, an absent cutover flag or a lookalike path as compatibility", () => {
    expect(getWorkspaceCapabilityDenial("admin", "/unknown", { ...ready, compatibility: { ...ready.compatibility, permissionManaged: undefined } })?.state).toBe("forbidden");
    expect(getWorkspaceCapabilityDenial("admin", "/academic/students-other", { ...ready, compatibility: { ...ready.compatibility, permissionManaged: true }, effectiveCapabilities: ["enrollment.intakes.manage"] })?.state).toBe("forbidden");
    const platform = { ...ready, compatibility: { ...ready.compatibility, mode: "platform" as const } };
    expect(getLegacyWorkspaceAccess("admin", platform).state).toBe("forbidden");
    expect(getAccessibleWorkspaceSections("admin", { access: platform })).toEqual([]);
  });
});

describe("module navigation and deep links", () => {
  it("uses the same module rule for hidden sections and nested URLs", () => {
    const features = { billing: false, curriculum: false, knowledgeLibrary: false };
    const sections = getAccessibleWorkspaceSections("admin", { access: ready, features });
    for (const path of ["/billing", "/academic/knowledge/curriculum-import", "/academic/knowledge/curriculum-readiness", "/academic/knowledge/library"]) {
      expect(sections.some(section => section.href === path)).toBe(false);
      expect(getWorkspaceModuleDenial("admin", `${path}/details`, features)?.state).toBe("module_disabled");
    }
    expect(sections.some(section => section.href === "/students/import")).toBe(true);
    expect(getWorkspaceModuleDenial("admin", "/billing-other", features)).toBeNull();
  });
  it("keeps Portal family navigation separate from staff capabilities", () => {
    expect(getAccessibleWorkspaceSections("portal", { access: { state: "forbidden", message: "No staff membership" }, userRole: "parent" }).map(section => section.href)).toContain("/billing");
    expect(getAccessibleWorkspaceSections("portal", { userRole: "parent" }).map(section => section.href)).not.toContain("/learning/topics");
    expect(getAccessibleWorkspaceSections("portal", { userRole: "student" }).map(section => section.href)).toContain("/learning/topics");
  });
  it("matches route segment boundaries, not lookalike prefixes", () => {
    expect(isWorkspaceSectionActive({ href: "/admin", label: "Admin", matchers: ["/admin"] }, "/administrator")).toBe(false);
  });
});
