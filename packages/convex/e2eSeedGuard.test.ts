import { describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import globalSetup from "../../e2e/global-setup.js";
import destructiveConfig from "../../playwright.config.js";
import admissionsConfig from "../../playwright.admissions.config.js";

const guard = globalSetup as typeof globalSetup & {
  configuredValue: (directory: string, key: string) => string | undefined;
  runFirstSeed: (env: Record<string, string | undefined>, runner: (...args: any[]) => string, appTarget: (directory: string, key: string) => string | undefined,
    input?: { stdinTTY: boolean; stdoutTTY: boolean; ask: (text: string) => Promise<string | null>; log: (text: string) => void },
    resume?: { operationId: string; schoolId: string; inventoryHash: string; confirmationPhrase: string } | null) => Promise<void>;
};
const env = {
  CONVEX_DEPLOYMENT: "dev:dedicated-test",
  DEMO_SEED_EXPECTED_CLOUD_URL: "https://dedicated-test.convex.cloud",
  DEMO_SEED_OPERATOR_TOKEN: "test-token",
  DEMO_SEED_DEPLOYMENT_IDENTITY: "test-identity",
  DEMO_SEED_DEPLOYMENT_ENV: "development",
  NEXT_PUBLIC_CONVEX_URL: "https://dedicated-test.convex.cloud",
};
const empty = { cloudUrl: env.DEMO_SEED_EXPECTED_CLOUD_URL, e2eOriginsTrusted: true, school: null, blockers: [], tables: [], ready: true };
const noFileTarget = () => undefined;

describe("first-run E2E demo seed guard", () => {
  test("parses the inline comment Convex adds to its selected deployment", () => {
    const directory = mkdtempSync(join(tmpdir(), "melo-e2e-env-"));
    try {
      writeFileSync(join(directory, ".env.local"), "CONVEX_DEPLOYMENT=dev:content-poodle-172 # team: demo, project: school\n");
      expect(guard.configuredValue(directory, "CONVEX_DEPLOYMENT")).toBe("dev:content-poodle-172");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("refuses mismatched and non-dev targets before any CLI call", async () => {
    const runner = vi.fn();
    await expect(guard.runFirstSeed({ ...env, CONVEX_DEPLOYMENT: "prod:bad" }, runner, noFileTarget)).rejects.toThrow("dev: selector");
    await expect(guard.runFirstSeed({ ...env, DEMO_SEED_DEPLOYMENT_ENV: "preview" }, runner, noFileTarget)).rejects.toThrow("development");
    await expect(guard.runFirstSeed(env, runner, (dir, key) => dir.endsWith("admin") && key === "NEXT_PUBLIC_CONVEX_URL" ? "https://other.convex.cloud" : undefined)).rejects.toThrow("admin NEXT_PUBLIC_CONVEX_URL target mismatch");
    await expect(guard.runFirstSeed(env, runner, (_dir, key) => key === "CONVEX_DEPLOYMENT" ? "prod:other" : undefined)).rejects.toThrow("Root CONVEX_DEPLOYMENT target mismatch");
    expect(runner).not.toHaveBeenCalled();
  });

  test("accepts the region-qualified cloud URL returned by a Convex dev deployment", async () => {
    const cloudUrl = "https://content-poodle-172.eu-west-1.convex.cloud";
    const regional = { ...env, DEMO_SEED_EXPECTED_CLOUD_URL: cloudUrl, NEXT_PUBLIC_CONVEX_URL: cloudUrl };
    const runner = vi.fn().mockReturnValueOnce({ ...empty, cloudUrl }).mockReturnValueOnce({});
    await guard.runFirstSeed(regional, runner, noFileTarget);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  test("rejects shell and app site mismatches before inspection, including valid alternate site URLs", async () => {
    const runner = vi.fn();
    const other = "https://other.convex.site";
    for (const key of ["CONVEX_SITE_URL", "NEXT_PUBLIC_CONVEX_SITE_URL"]) {
      await expect(guard.runFirstSeed({ ...env, [key]: other }, runner, noFileTarget)).rejects.toThrow(`Shell ${key} target mismatch`);
      await expect(guard.runFirstSeed(env, runner, (_dir, name) => name === key ? other : undefined)).rejects.toThrow(`Root ${key} target mismatch`);
    }
    for (const app of ["admin", "teacher", "portal"]) {
      await expect(guard.runFirstSeed(env, runner, (dir, key) => dir.endsWith(app) && key === "NEXT_PUBLIC_CONVEX_SITE_URL" ? other : undefined)).rejects.toThrow(`${app} NEXT_PUBLIC_CONVEX_SITE_URL target mismatch`);
    }
    expect(runner).not.toHaveBeenCalled();
  });

  test("refuses missing server trusted origins before seed", async () => {
    const runner = vi.fn().mockReturnValue({ ...empty, e2eOriginsTrusted: false });
    await expect(guard.runFirstSeed(env, runner, noFileTarget)).rejects.toThrow("does not trust all localhost:3101-3103 origins");
    expect(runner).toHaveBeenCalledTimes(1);
  });

  test("refuses a different server URL and a present school before seed", async () => {
    const runner = vi.fn().mockReturnValueOnce({ ...empty, cloudUrl: "https://other.convex.cloud" });
    await expect(guard.runFirstSeed(env, runner, noFileTarget)).rejects.toThrow("server cloud URL");
    expect(runner).toHaveBeenCalledTimes(1);
    runner.mockClear().mockReturnValue({ ...empty, school: { id: "school", name: "Demo" }, ready: false, blockers: ["review"] });
    await expect(guard.runFirstSeed(env, runner, noFileTarget)).rejects.toThrow("preflight has blockers or an unknown cohort");
    expect(runner).toHaveBeenCalledTimes(1);
  });

  test("refuses partial inspection even without a demo school", async () => {
    const runner = vi.fn().mockReturnValue({ ...empty, blockers: ["Better Auth: demo credential 1 already exists"], ready: false });
    await expect(guard.runFirstSeed(env, runner, noFileTarget)).rejects.toThrow("preflight has blockers");
    expect(runner).toHaveBeenCalledTimes(1);
  });

  test("seed failure instructs replacement instead of retry", async () => {
    const runner = vi.fn().mockReturnValueOnce(empty).mockImplementationOnce(() => { throw new Error("private CLI details"); });
    await expect(guard.runFirstSeed(env, runner, noFileTarget)).rejects.toThrow("abandon and replace the disposable dev deployment");
    expect(runner).toHaveBeenCalledTimes(2);
  });

  const hash = "a".repeat(64);
  const phrase = `RESET demo-school school ${hash} ${"b".repeat(32)}`;
  const seal = { operationId: "operation", schoolId: "school", inventoryHash: hash, confirmationPhrase: phrase };
  const populated = { ...empty, school: { id: "school", name: "Demo" }, tables: [{ name: "students", count: 36, truncated: false }] };
  const prepared = { ...seal, counts: [{ table: "students", count: 36 }, { table: "empty", count: 0 }] };
  function harness(answer: string | null, fail?: string, status = "deleting") {
    const calls: string[] = [];
    const logs: string[] = [];
    const runner = vi.fn((_url: string, functionName: string, _args: object) => {
      const name = functionName.split(":")[1];
      calls.push(name);
      if (name === fail) throw new Error("private details");
      return ({ inspectDemoSchool: populated, prepareDemoReset: prepared,
        cancelDemoReset: null, inspectDemoResetOperation: { status },
        executeDemoReset: { status: "ready_to_seed", operationId: seal.operationId },
        finishDemoReset: { status: "complete", operationId: seal.operationId } } as Record<string, unknown>)[name];
    });
    const input = { stdinTTY: true, stdoutTTY: true, ask: vi.fn(async () => answer), log: (text: string) => { logs.push(text); } };
    return { runner, input, calls, logs };
  }

  test("populated target refuses CI or missing TTY before reservation", async () => {
    for (const override of [{ stdinTTY: false }, { stdoutTTY: false }, { env: { CI: "true" } }]) {
      const h = harness(phrase);
      await expect(guard.runFirstSeed({ ...env, ...override.env }, h.runner, noFileTarget, { ...h.input, ...override })).rejects.toThrow("requires stdin and stdout TTY");
      expect(h.calls).toEqual(["inspectDemoSchool"]);
    }
  });

  test("cancel and wrong phrase cancel reservation without deletion", async () => {
    for (const answer of [null, "wrong"]) {
      const h = harness(answer);
      await expect(guard.runFirstSeed(env, h.runner, noFileTarget, h.input)).rejects.toThrow("reservation cancelled");
      expect(h.calls).toEqual(["inspectDemoSchool", "prepareDemoReset", "cancelDemoReset"]);
      expect(h.logs).toContain(`Type the full phrase to delete and reseed: ${phrase}`);
      expect(h.logs).toContain("students: 36");
      expect(h.logs).not.toContain("empty: 0");
    }
  });

  test("typed phrase executes then finishes only the approved operation", async () => {
    const h = harness(phrase);
    await guard.runFirstSeed(env, h.runner, noFileTarget, h.input);
    expect(h.calls).toEqual(["inspectDemoSchool", "prepareDemoReset", "executeDemoReset", "finishDemoReset"]);
    for (const call of h.runner.mock.calls.slice(2)) expect(call[2]).toMatchObject({ ...seal, schoolSlug: "demo-school", deploymentEnvironment: "development" });
  });

  test("interruption requires explicit same-operation resume, with no new reservation", async () => {
    const interrupted = harness(phrase, "finishDemoReset");
    await expect(guard.runFirstSeed(env, interrupted.runner, noFileTarget, interrupted.input)).rejects.toThrow("Resume the SAME operation");
    const resumed = harness(phrase);
    await guard.runFirstSeed(env, resumed.runner, noFileTarget, resumed.input, seal);
    expect(resumed.calls).toEqual(["inspectDemoResetOperation", "executeDemoReset", "finishDemoReset"]);
    expect(resumed.calls).not.toContain("prepareDemoReset");
    const ready = harness(phrase, undefined, "seeding");
    await guard.runFirstSeed(env, ready.runner, noFileTarget, ready.input, seal);
    expect(ready.calls).toEqual(["inspectDemoResetOperation", "finishDemoReset"]);
    const wrong = harness("wrong");
    await expect(guard.runFirstSeed(env, wrong.runner, noFileTarget, wrong.input, seal)).rejects.toThrow("confirmation cancelled or incorrect");
    expect(wrong.calls).toEqual(["inspectDemoResetOperation"]);
  });

  test("verify-only checks an existing first-run school without preparing a reset", async () => {
    const verified = { ...empty, school: { id: "school", name: "Demo Academy" }, tables: [
      { name: "students", count: 36 }, { name: "classes", count: 3 },
      { name: "studentInvoices", count: 36 }, { name: "assessmentRecords", count: 756 },
    ] };
    const runner = vi.fn().mockResolvedValue(verified);
    await guard.runFirstSeed({ ...env, E2E_DEMO_VERIFY_SCHOOL: "demo-school" }, runner, noFileTarget);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0][1]).toBe("functions/academic/demoPreflightAction:inspectDemoSchool");
    runner.mockResolvedValue({ ...verified, tables: verified.tables.filter((row) => row.name !== "studentInvoices") });
    await expect(guard.runFirstSeed({ ...env, E2E_DEMO_VERIFY_SCHOOL: "demo-school" }, runner, noFileTarget))
      .rejects.toThrow("existing demo-school verification failed");
    expect(runner.mock.calls.every((call) => call[1] === "functions/academic/demoPreflightAction:inspectDemoSchool")).toBe(true);
  });

  test("verify-only uses one read-only action and refuses incorrect proof without preparing", async () => {
    const operationId = "operation123";
    const verified = { cloudUrl: env.DEMO_SEED_EXPECTED_CLOUD_URL, operationId, status: "complete",
      schoolId: "new-school", runId: "new-run", studentCount: 36, classCount: 3, invoiceCount: 36, assessmentRecordCount: 756 };
    const runner = vi.fn().mockResolvedValue(verified);
    const input = { stdinTTY: false, stdoutTTY: false, ask: vi.fn(), log: vi.fn() };
    await guard.runFirstSeed({ ...env, E2E_DEMO_VERIFY_OPERATION_ID: operationId }, runner, noFileTarget, input);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(env.DEMO_SEED_EXPECTED_CLOUD_URL,
      "functions/academic/demoResetAction:verifyCompletedDemoReset",
      { operatorToken: "test-token", targetIdentity: "test-identity", operationId });
    runner.mockResolvedValue({ ...verified, studentCount: 35 });
    await expect(guard.runFirstSeed({ ...env, E2E_DEMO_VERIFY_OPERATION_ID: operationId }, runner, noFileTarget, input)).rejects.toThrow("verification failed");
    expect(runner.mock.calls.every((call) => call[1] === "functions/academic/demoResetAction:verifyCompletedDemoReset")).toBe(true);
    await expect(guard.runFirstSeed({ ...env, E2E_DEMO_VERIFY_OPERATION_ID: "" }, runner, noFileTarget, input)).rejects.toThrow("operation ID");
  });

  test("destructive E2E refuses occupied app ports without changing admissions smoke", () => {
    expect(destructiveConfig.webServer.map((server: { reuseExistingServer: boolean }) => server.reuseExistingServer)).toEqual([false, false, false]);
    expect(admissionsConfig.webServer.map((server: { reuseExistingServer: boolean }) => server.reuseExistingServer)).toEqual([true, true]);
  });

  test("inspects and seeds only on an empty dedicated dev target", async () => {
    const runner = vi.fn().mockReturnValueOnce(empty).mockReturnValueOnce({});
    await guard.runFirstSeed(env, runner, noFileTarget);
    expect(runner).toHaveBeenCalledTimes(2);
    const [url, inspectName, inspectArgs] = runner.mock.calls[0];
    expect(url).toBe(env.DEMO_SEED_EXPECTED_CLOUD_URL);
    expect(inspectName).toBe("functions/academic/demoPreflightAction:inspectDemoSchool");
    expect(inspectArgs).toEqual({ operatorToken: "test-token", targetIdentity: "test-identity" });
    const [seedUrl, seedName, seedArgs] = runner.mock.calls[1];
    expect(seedUrl).toBe(url);
    expect(seedName).toBe("functions/academic/seedRunner:seedDemoSchool");
    expect(seedArgs).toEqual({
      operatorToken: "test-token", targetIdentity: "test-identity", confirmation: "RESET demo-school",
      deploymentEnvironment: "development", inspectedSchoolId: null, inspectedSchoolSlug: "demo-school",
    });
    expect(process.argv.join(" ")).not.toContain("test-token");
  });
});
