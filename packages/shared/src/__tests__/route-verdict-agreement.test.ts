import { describe, expect, it } from "vitest";
import type { WorkspaceAccessSummary } from "../workspace-access";
import { getWorkspaceCapabilityDenial } from "../workspace-route-access";
import { WORKSPACE_CAPABILITY_MATRIX } from "../workspace-capability-matrix";

type Workspace = "admin" | "teacher";

type ContractEntry = {
  workspace: Workspace;
  path: string;
  exact?: true;
  required: readonly string[];
  requiredAny: readonly string[];
};

/**
 * Independently maintained server/client contract snapshot (consolidation
 * P11). This literal is the oracle: if the matrix drifts, this test fails
 * and a human reviews whether the matrix or the contract moves. It must
 * never be generated from the matrix at test time.
 */
const EXPECTED_CONTRACT: readonly ContractEntry[] = [
  { workspace: "admin", path: "/admin/dashboard", required: [], requiredAny: [] },
  { workspace: "admin", path: "/admin", exact: true, required: ["staff.list.view"], requiredAny: [] },
  { workspace: "admin", path: "/academic/students", required: ["enrollment.intakes.manage"], requiredAny: [] },
  { workspace: "admin", path: "/admin/admissions/retention", required: ["enrollment.intakes.manage", "enrollment.decisions.record"], requiredAny: [] },
  { workspace: "admin", path: "/admin/admissions", exact: true, required: [], requiredAny: ["enrollment.intakes.manage", "enrollment.applications.list"] },
  { workspace: "admin", path: "/admin/admissions", required: ["enrollment.applications.view_basic"], requiredAny: [] },
  { workspace: "admin", path: "/academic/students/import", required: ["system.migration.execute"], requiredAny: [] },
  { workspace: "admin", path: "/students/import", required: ["system.migration.execute"], requiredAny: [] },
  { workspace: "admin", path: "/academic/teachers", required: ["staff.list.view"], requiredAny: [] },
  { workspace: "admin", path: "/academic/sessions", required: ["academic.classes.manage"], requiredAny: [] },
  { workspace: "admin", path: "/academic/classes", required: ["academic.classes.manage"], requiredAny: [] },
  { workspace: "admin", path: "/academic/subjects", required: ["academic.subjects.manage"], requiredAny: [] },
  { workspace: "admin", path: "/academic/events", required: ["academic.classes.manage"], requiredAny: [] },
  { workspace: "admin", path: "/assessments/results/entry", required: ["academic.assessments.enter"], requiredAny: [] },
  { workspace: "admin", path: "/assessments/report-cards", required: ["academic.report_cards.preview"], requiredAny: [] },
  { workspace: "admin", path: "/assessments/report-cards/manual-adjustments", required: ["academic.assessments.adjust"], requiredAny: [] },
  { workspace: "admin", path: "/assessments/report-cards/backfill", required: ["academic.assessments.adjust"], requiredAny: [] },
  { workspace: "admin", path: "/assessments/report-card-extras", required: ["academic.report_cards.preview"], requiredAny: [] },
  { workspace: "admin", path: "/assessments/setup", required: ["academic.grading_bands.manage"], requiredAny: [] },
  { workspace: "admin", path: "/admin/assets", required: ["assets.library.view"], requiredAny: [] },
  { workspace: "admin", path: "/admin/assets/archive", required: ["assets.library.view", "assets.archive.manage"], requiredAny: [] },
  { workspace: "admin", path: "/admin/assets/trash", required: ["assets.library.view"], requiredAny: ["assets.trash.manage", "assets.restore", "assets.holds.apply", "assets.holds.remove", "assets.permanent_delete"] },
  { workspace: "admin", path: "/admin/permissions", required: ["staff.permissions.manage"], requiredAny: [] },
  { workspace: "admin", path: "/admin/audit", required: ["audit.branch.view"], requiredAny: [] },
  { workspace: "admin", path: "/admin/group", required: ["audit.group.view"], requiredAny: [] },
  { workspace: "admin", path: "/admin/settings", required: [], requiredAny: ["settings.general.edit", "settings.branding.manage"] },
  { workspace: "admin", path: "/admin/settings/admission-numbering", required: ["enrollment.intakes.manage"], requiredAny: [] },
  { workspace: "admin", path: "/admin/settings/email-domains", required: [], requiredAny: ["settings.domains.manage", "staff.onboard", "staff.account.suspend", "enrollment.intakes.manage"] },
  { workspace: "admin", path: "/billing", required: ["finance.reports.view"], requiredAny: [] },
  { workspace: "admin", path: "/billing/bank-accounts", required: ["finance.bank_details.manage"], requiredAny: [] },
  { workspace: "admin", path: "/billing/settlements", required: ["finance.settlements.view"], requiredAny: [] },
  { workspace: "admin", path: "/academic/knowledge", required: ["academic.curriculum.manage"], requiredAny: [] },
  { workspace: "teacher", path: "/", exact: true, required: [], requiredAny: [] },
  { workspace: "teacher", path: "/planning", required: [], requiredAny: ["academic.planning.use", "academic.curriculum.manage"] },
  { workspace: "teacher", path: "/assessments/exams", required: ["academic.assessments.enter"], requiredAny: [] },
  { workspace: "teacher", path: "/assessments/report-card-workbench", required: ["academic.report_cards.preview"], requiredAny: [] },
  { workspace: "teacher", path: "/assessments/report-cards", required: ["academic.report_cards.preview"], requiredAny: [] },
  { workspace: "teacher", path: "/assessments/report-card-extras", required: ["academic.report_cards.preview"], requiredAny: [] },
  { workspace: "teacher", path: "/enrollment/subjects", required: ["enrollment.intakes.manage"], requiredAny: [] },
];

const readyManaged = (
  effectiveCapabilities: readonly string[],
): Extract<WorkspaceAccessSummary, { state: "ready" }> => ({
  state: "ready",
  branch: { schoolId: "default", name: "School", slug: "school", status: "active" },
  membership: {
    membershipId: "membership" as never,
    personId: "person" as never,
    displayTitle: null,
    isProprietor: false,
  },
  displayTitle: "Member",
  effectiveCapabilities: [...effectiveCapabilities],
  compatibility: {
    mode: "canonical",
    permissionManaged: true,
    legacyUserId: "user",
    legacyRole: "teacher",
    legacyIsSchoolAdmin: false,
    adminParity: "not_applicable",
    legacyDefaultSchoolId: "default",
  },
  teacherAssignments: { source: "domain_checks_required", legacyTeacherId: null },
});

function clientAllows(workspace: Workspace, path: string, caps: readonly string[]): boolean {
  return getWorkspaceCapabilityDenial(workspace, path, readyManaged(caps)) === null;
}

function within(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Mirror of the client's documented longest-path-wins rule selection. */
function winningEntry(workspace: Workspace, path: string): ContractEntry | undefined {
  return EXPECTED_CONTRACT.filter(
    (entry) => entry.workspace === workspace && (entry.exact ? path === entry.path : within(path, entry.path)),
  ).sort((a, b) => b.path.length - a.path.length)[0];
}

function corpus(): Array<{ workspace: Workspace; path: string }> {
  const seen = new Set<string>();
  const out: Array<{ workspace: Workspace; path: string }> = [];
  for (const entry of EXPECTED_CONTRACT) {
    for (const path of [entry.path, `${entry.path}/sub`]) {
      const key = `${entry.workspace} ${path}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ workspace: entry.workspace, path });
      }
    }
  }
  return out;
}

const TRASH_CAPABILITIES = [
  "assets.trash.manage",
  "assets.restore",
  "assets.holds.apply",
  "assets.holds.remove",
  "assets.permanent_delete",
];

/**
 * Concrete SERVER endpoint models per route, derived from the real checks
 * (assetWorkspace conjunctions; retention policy endpoints). Anything about
 * the client route gate belongs in the tests below, never here. Any endpoint
 * change must update the corresponding model first.
 */
function concreteServerAllows(workspace: Workspace, path: string, caps: readonly string[]): boolean {
  const has = (cap: string) => caps.includes(cap);
  if (workspace === "admin" && path === "/admin/assets/archive") {
    return has("assets.library.view") && has("assets.archive.manage");
  }
  if (workspace === "admin" && path === "/admin/assets/trash") {
    return has("assets.library.view") && TRASH_CAPABILITIES.some(has);
  }
  if (workspace === "admin" && path === "/admin/admissions/retention") {
    return has("enrollment.intakes.manage");
  }
  throw new Error(`no concrete server model for ${workspace} ${path}`);
}

describe("client-vs-server route verdicts (consolidation P11, test only)", () => {
  it("matrix matches the independently maintained contract", () => {
    // Copy runtime contents directly: if a referenced constant such as
    // TEACHER_PLANNING_CAPABILITIES gains a capability, this mismatches the
    // hardcoded contract below and fails loudly for human review.
    const actual = WORKSPACE_CAPABILITY_MATRIX.map((row) => ({
      workspace: row.workspace,
      path: row.path,
      ...(row.exact ? { exact: true as const } : {}),
      required: [...row.required],
      requiredAny: [...(row.requiredAny ?? [])],
    }));
    expect(actual).toEqual(EXPECTED_CONTRACT);
  });

  it("agrees with the server on pure single-or-open rules", () => {
    const seen = new Set<string>();
    let probed = 0;
    for (const { workspace, path } of corpus()) {
      const entry = winningEntry(workspace, path);
      if (!entry || entry.path === "/admin/assets/archive" || entry.path === "/admin/assets/trash" || entry.path === "/admin/admissions/retention") continue;
      if (entry.required.length > 1) continue;
      if (entry.required.length === 1 && entry.requiredAny.length > 0) continue;
      // Dedupe by probed path: the same winner governs its subpaths, and each
      // distinct path (e.g. /admin/admissions vs /admin/admissions/sub, which
      // resolve to different rows) must execute.
      const key = `${workspace} ${path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      probed += 1;
      // Every requiredAny alternative is probed, each combined with full required.
      const probes: readonly string[][] = [
        [],
        [...entry.required],
        ...entry.requiredAny.map((alt) => [...entry.required, alt]),
        ["unrelated.capability"],
      ];
      for (const caps of probes) {
        const server = entry.required.length === 0 && entry.requiredAny.length === 0
          ? true
          : [...entry.required, ...entry.requiredAny].some((cap) => caps.includes(cap));
        expect(clientAllows(workspace, path, caps), `client ${workspace} ${path} [${caps}]`).toBe(server);
      }
    }
    expect(probed).toBeGreaterThan(0);
  });

  it("agrees exactly on asset workspace conjunctions", () => {
    for (const path of ["/admin/assets/archive", "/admin/assets/trash"]) {
      const probes: readonly string[][] = [
        [],
        ["assets.library.view"],
        ["assets.archive.manage"],
        ...TRASH_CAPABILITIES.map((alt) => ["assets.library.view", alt]),
        ...TRASH_CAPABILITIES.map((alt) => [alt]),
        ["assets.library.view", "assets.archive.manage"],
      ];
      for (const caps of probes) {
        expect(clientAllows("admin", path, caps), `client ${path} [${caps}]`).toBe(
          concreteServerAllows("admin", path, caps),
        );
      }
    }
  });

  it("locks the retention divergence for the flip decision", () => {
    // Route gate demands both; policy endpoints need intakes.manage only.
    expect(clientAllows("admin", "/admin/admissions/retention", ["enrollment.intakes.manage"])).toBe(false);
    expect(concreteServerAllows("admin", "/admin/admissions/retention", ["enrollment.intakes.manage"])).toBe(true);
    expect(clientAllows("admin", "/admin/admissions/retention", ["enrollment.decisions.record"])).toBe(false);
    expect(concreteServerAllows("admin", "/admin/admissions/retention", ["enrollment.decisions.record"])).toBe(false);
    expect(clientAllows("admin", "/admin/admissions/retention", ["enrollment.intakes.manage", "enrollment.decisions.record"])).toBe(true);
    expect(clientAllows("admin", "/admin/admissions/retention", [])).toBe(false);
  });
});
