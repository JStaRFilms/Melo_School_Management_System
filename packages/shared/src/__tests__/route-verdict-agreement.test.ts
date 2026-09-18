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
 * Documented server rule (B11): endpoint enforcement needs SOME capability
 * from the operation set, while the client needs EVERY required plus SOME of
 * requiredAny. This model is test-only scaffolding for the flip decision; it
 * is not product code and must not be imported by any UI.
 */
function serverAllows(
  required: readonly PermissionCapability[],
  requiredAny: readonly PermissionCapability[] | undefined,
  caps: readonly string[],
): boolean {
  if (required.length === 0 && (requiredAny ?? []).length === 0) return true;
  return [...required, ...(requiredAny ?? [])].some((cap) => caps.includes(cap));
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
    for (const rule of divergent) {
      const partials: readonly string[][] = [
        ...(rule.required.length > 0 ? [[rule.required[0]]] : []),
        ...((rule.requiredAny ?? []).length > 0 ? [[(rule.requiredAny ?? [])[0]]] : []),
      ];
      expect(partials.length).toBeGreaterThan(0);
      for (const partial of partials) {
        // Client denies partial holders...
        expect(clientAllows(rule.workspace, rule.path, partial)).toBe(false);
        // ...while the server SOME rule would allow them. Flip later, not here.
        expect(serverAllows(rule.required, rule.requiredAny, partial)).toBe(true);
      }
    }
  });
});
