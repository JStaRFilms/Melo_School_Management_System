import { describe, expect, it } from "vitest";
import type { WorkspaceAccessSummary } from "../workspace-access";
import { getWorkspaceCapabilityDenial } from "../workspace-route-access";
import {
  WORKSPACE_CAPABILITY_MATRIX,
} from "../workspace-capability-matrix";
import type { PermissionCapability } from "../capability-contract";

type Workspace = "admin" | "teacher";

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

function within(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

type MatrixRow = (typeof WORKSPACE_CAPABILITY_MATRIX)[number];

/** Mirror of the client's documented longest-path-wins rule selection. */
function winningRule(workspace: Workspace, path: string): MatrixRow | undefined {
  return WORKSPACE_CAPABILITY_MATRIX.filter(
    (row) => row.workspace === workspace && (row.exact ? path === row.path : within(path, row.path)),
  ).sort((a, b) => b.path.length - a.path.length)[0];
}

/** Probe corpus: every row path plus a subpath so shadowed prefix rows are covered. */
function corpus(): Array<{ workspace: Workspace; path: string }> {
  const seen = new Set<string>();
  const out: Array<{ workspace: Workspace; path: string }> = [];
  for (const row of WORKSPACE_CAPABILITY_MATRIX) {
    for (const path of [row.path, `${row.path}/sub`]) {
      const key = `${row.workspace} ${path}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ workspace: row.workspace as Workspace, path });
      }
    }
  }
  return out;
}

function clientAllows(workspace: Workspace, path: string, caps: readonly string[]): boolean {
  return getWorkspaceCapabilityDenial(workspace, path, readyManaged(caps)) === null;
}

/**
 * Documented server rule for pure single-capability routes (B11): the endpoint
 * enforces its one operation capability. This model is test-only scaffolding
 * for the flip decision; it is not product code and must not be imported by
 * any UI. Routes with conjunctive or mixed endpoint checks are modeled
 * concretely below, never flattened into `some`.
 */
function serverAllows(
  required: readonly PermissionCapability[],
  requiredAny: readonly PermissionCapability[] | undefined,
  caps: readonly string[],
): boolean {
  if (required.length === 0 && (requiredAny ?? []).length === 0) return true;
  return [...required, ...(requiredAny ?? [])].some((cap) => caps.includes(cap));
}

const TRASH_CAPABILITIES = [
  "assets.trash.manage",
  "assets.restore",
  "assets.holds.apply",
  "assets.holds.remove",
  "assets.permanent_delete",
];

/**
 * Concrete server models per route, derived from the real endpoint checks
 * (assetWorkspace.listAssets conjunctions; retention policy vs manual
 * endpoints). Any endpoint change here must update this model first.
 */
function concreteServerAllows(workspace: Workspace, path: string, caps: readonly string[]): boolean | null {
  const has = (cap: string) => caps.includes(cap);
  const some = (list: readonly string[]) => list.some(has);
  if (workspace === "admin" && path === "/admin/assets/archive") {
    return has("assets.library.view") && has("assets.archive.manage");
  }
  if (workspace === "admin" && path === "/admin/assets/trash") {
    return has("assets.library.view") && some(TRASH_CAPABILITIES);
  }
  if (workspace === "admin" && path === "/admin/admissions/retention") {
    // Policy endpoints need intakes.manage only; manual endpoints need both.
    // The route gate demands both, so it is stricter than the policy path.
    return has("enrollment.intakes.manage");
  }
  return null;
}

describe("client-vs-server route verdicts (consolidation P11, test only)", () => {
  it("admits full holders on every reachable rule", () => {
    for (const { workspace, path } of corpus()) {
      const rule = winningRule(workspace, path);
      if (!rule) continue;
      const caps = [...rule.required, ...(rule.requiredAny ?? []).slice(0, 1)];
      expect(clientAllows(workspace, path, caps), `${workspace} ${path}`).toBe(true);
    }
  });

  it("denies empty holders everywhere except open rules", () => {
    for (const { workspace, path } of corpus()) {
      const rule = winningRule(workspace, path);
      if (!rule) continue;
      const open = rule.required.length === 0 && (rule.requiredAny ?? []).length === 0;
      expect(clientAllows(workspace, path, []), `${workspace} ${path}`).toBe(open);
    }
  });

  it("agrees with the server on pure single-or-open rules", () => {
    const seen = new Set<string>();
    let probed = 0;
    for (const { workspace, path } of corpus()) {
      const rule = winningRule(workspace, path);
      // required=[] rows agree (client every([]) is vacuous); single-required
      // rows without requiredAny coincide. Everything else diverges (next test).
      if (!rule || rule.required.length > 1 || (rule.required.length === 1 && (rule.requiredAny ?? []).length > 0)) continue;
      const key = `${workspace} ${rule.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      probed += 1;
      const probes: readonly string[][] = [
        [],
        [...rule.required],
        ["unrelated.capability"],
      ];
      for (const caps of probes) {
        expect(
          clientAllows(workspace, path, caps),
          `client ${workspace} ${path} [${caps}]`,
        ).toBe(serverAllows(rule.required, rule.requiredAny, caps));
      }
    }
    expect(probed).toBeGreaterThan(0);
  });

  it("locks the known quantifier divergences for the flip decision", () => {
    const seen = new Set<string>();
    const divergent: MatrixRow[] = [];
    for (const { workspace, path } of corpus()) {
      const rule = winningRule(workspace, path);
      if (!rule) continue;
      // required=[] rows agree with the server (vacuous every + same some);
      // divergence needs at least one required plus a second conjunct.
      if (rule.required.length === 0) continue;
      if (rule.required.length === 1 && (rule.requiredAny ?? []).length === 0) continue;
      const key = `${workspace} ${rule.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      divergent.push(rule);
    }
    // New diverging rules must be reviewed here before they ship.
    expect(divergent.map((rule) => `${rule.workspace} ${rule.path}`).sort()).toEqual([
      "admin /admin/admissions/retention",
      "admin /admin/assets/archive",
      "admin /admin/assets/trash",
    ]);
    // Asset workspaces agree concretely: the endpoints conjoin the same sets.
    for (const path of ["/admin/assets/archive", "/admin/assets/trash"]) {
      const probes: readonly string[][] = [
        [],
        ["assets.library.view"],
        ["assets.archive.manage"],
        ["assets.trash.manage"],
        ["assets.library.view", "assets.archive.manage"],
        ["assets.library.view", "assets.trash.manage"],
      ];
      for (const caps of probes) {
        expect(clientAllows("admin", path, caps), `client ${path} [${caps}]`).toBe(
          concreteServerAllows("admin", path, caps),
        );
      }
    }
    // Retention is the real divergence: the route gate demands both
    // capabilities while the policy endpoints need intakes.manage only.
    expect(clientAllows("admin", "/admin/admissions/retention", ["enrollment.intakes.manage"])).toBe(false);
    expect(concreteServerAllows("admin", "/admin/admissions/retention", ["enrollment.intakes.manage"])).toBe(true);
    expect(clientAllows("admin", "/admin/admissions/retention", ["enrollment.decisions.record"])).toBe(false);
    expect(concreteServerAllows("admin", "/admin/admissions/retention", ["enrollment.decisions.record"])).toBe(false);
    expect(clientAllows("admin", "/admin/admissions/retention", ["enrollment.intakes.manage", "enrollment.decisions.record"])).toBe(true);
    expect(clientAllows("admin", "/admin/admissions/retention", [])).toBe(false);
  });
});
