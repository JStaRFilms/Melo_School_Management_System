import { describe, expect, it } from "vitest";
import {
  hasAdminWorkspaceParity,
  hasEffectiveCapability,
  type WorkspaceAccessSummary,
} from "../workspace-access";

describe("hasAdminWorkspaceParity", () => {
  it("returns false for unready access states", () => {
    expect(hasAdminWorkspaceParity(undefined)).toBe(false);
    expect(hasAdminWorkspaceParity(null)).toBe(false);
    expect(hasAdminWorkspaceParity({ state: "unauthenticated" })).toBe(false);
    expect(
      hasAdminWorkspaceParity({
        state: "forbidden",
        message: "Forbidden",
      }),
    ).toBe(false);
  });

  it("returns true for unmanaged school administrators", () => {
    const access: WorkspaceAccessSummary = {
      state: "ready",
      branch: { schoolId: "sch_1", name: "Alpha", slug: "alpha", status: "active" },
      membership: null,
      displayTitle: "Principal",
      effectiveCapabilities: ["academic.classes.manage"],
      compatibility: {
        mode: "legacy_default",
        permissionManaged: false,
        legacyUserId: "u_1",
        legacyRole: "admin",
        legacyIsSchoolAdmin: true,
        adminParity: "review_required",
        legacyDefaultSchoolId: "sch_1",
      },
      teacherAssignments: {
        source: "domain_checks_required",
        legacyTeacherId: null,
      },
    };

    expect(hasAdminWorkspaceParity(access)).toBe(true);
    expect(hasEffectiveCapability(access, "staff.password.reset")).toBe(true);
    expect(hasEffectiveCapability(access, "finance.reports.view")).toBe(true);
    expect(hasEffectiveCapability(access, "academic.classes.manage")).toBe(true);
  });

  it("returns true for proprietors even in managed workspaces", () => {
    const access: WorkspaceAccessSummary = {
      state: "ready",
      branch: { schoolId: "sch_1", name: "Alpha", slug: "alpha", status: "active" },
      membership: {
        membershipId: "m_1",
        personId: "p_1",
        displayTitle: "Owner",
        isProprietor: true,
      },
      displayTitle: "Proprietor",
      effectiveCapabilities: [],
      compatibility: {
        mode: "canonical",
        permissionManaged: true,
        legacyUserId: "u_1",
        legacyRole: "admin",
        legacyIsSchoolAdmin: true,
        adminParity: "not_applicable",
        legacyDefaultSchoolId: "sch_1",
      },
      teacherAssignments: {
        source: "domain_checks_required",
        legacyTeacherId: null,
      },
    };

    expect(hasAdminWorkspaceParity(access)).toBe(true);
    expect(hasEffectiveCapability(access, "staff.password.reset")).toBe(true);
  });

  it("restricts delegated non-proprietors when permission management is active", () => {
    const access: WorkspaceAccessSummary = {
      state: "ready",
      branch: { schoolId: "sch_1", name: "Alpha", slug: "alpha", status: "active" },
      membership: {
        membershipId: "m_2",
        personId: "p_2",
        displayTitle: "Principal",
        isProprietor: false,
      },
      displayTitle: "Principal",
      effectiveCapabilities: ["academic.classes.manage", "staff.list.view"],
      compatibility: {
        mode: "canonical",
        permissionManaged: true,
        legacyUserId: "u_2",
        legacyRole: "principal",
        legacyIsSchoolAdmin: true,
        adminParity: "not_applicable",
        legacyDefaultSchoolId: "sch_1",
      },
      teacherAssignments: {
        source: "domain_checks_required",
        legacyTeacherId: null,
      },
    };

    expect(hasAdminWorkspaceParity(access)).toBe(false);
    // Explicit capabilities granted
    expect(hasEffectiveCapability(access, "academic.classes.manage")).toBe(true);
    expect(hasEffectiveCapability(access, "staff.list.view")).toBe(true);
    // Sensitive / ungranted capabilities withheld
    expect(hasEffectiveCapability(access, "staff.password.reset")).toBe(false);
    expect(hasEffectiveCapability(access, "staff.account.suspend")).toBe(false);
    expect(hasEffectiveCapability(access, "finance.reports.view")).toBe(false);
  });
});
