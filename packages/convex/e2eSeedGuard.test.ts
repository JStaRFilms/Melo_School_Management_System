import { describe, expect, test, vi } from "vitest";
import globalSetup from "../../e2e/global-setup.js";
import destructiveConfig from "../../playwright.config.js";
import admissionsConfig from "../../playwright.admissions.config.js";

const guard = globalSetup as typeof globalSetup & {
  runFirstSeed: (env: Record<string, string | undefined>, runner: (...args: any[]) => string, appTarget: (directory: string, key: string) => string | undefined) => void;
};
const env = {
  CONVEX_DEPLOYMENT: "dev:dedicated-test",
  DEMO_SEED_EXPECTED_CLOUD_URL: "https://dedicated-test.convex.cloud",
  DEMO_SEED_OPERATOR_TOKEN: "test-token",
  DEMO_SEED_DEPLOYMENT_IDENTITY: "test-identity",
  DEMO_SEED_DEPLOYMENT_ENV: "development",
  NEXT_PUBLIC_CONVEX_URL: "https://dedicated-test.convex.cloud",
};
const empty = JSON.stringify({ cloudUrl: env.DEMO_SEED_EXPECTED_CLOUD_URL, e2eOriginsTrusted: true, school: null, blockers: [], tables: [], ready: true });
const noFileTarget = () => undefined;

describe("first-run E2E demo seed guard", () => {
  test("refuses mismatched and non-dev targets before any CLI call", () => {
    const runner = vi.fn();
    expect(() => guard.runFirstSeed({ ...env, CONVEX_DEPLOYMENT: "prod:bad" }, runner, noFileTarget)).toThrow("dev: selector");
    expect(() => guard.runFirstSeed({ ...env, DEMO_SEED_DEPLOYMENT_ENV: "preview" }, runner, noFileTarget)).toThrow("development");
    expect(() => guard.runFirstSeed(env, runner, (dir, key) => dir.endsWith("admin") && key === "NEXT_PUBLIC_CONVEX_URL" ? "https://other.convex.cloud" : undefined)).toThrow("admin NEXT_PUBLIC_CONVEX_URL target mismatch");
    expect(() => guard.runFirstSeed(env, runner, (_dir, key) => key === "CONVEX_DEPLOYMENT" ? "prod:other" : undefined)).toThrow("Root CONVEX_DEPLOYMENT target mismatch");
    expect(runner).not.toHaveBeenCalled();
  });

  test("rejects shell and app site mismatches before inspection, including valid alternate site URLs", () => {
    const runner = vi.fn();
    const other = "https://other.convex.site";
    for (const key of ["CONVEX_SITE_URL", "NEXT_PUBLIC_CONVEX_SITE_URL"]) {
      expect(() => guard.runFirstSeed({ ...env, [key]: other }, runner, noFileTarget)).toThrow(`Shell ${key} target mismatch`);
      expect(() => guard.runFirstSeed(env, runner, (_dir, name) => name === key ? other : undefined)).toThrow(`Root ${key} target mismatch`);
    }
    for (const app of ["admin", "teacher", "portal"]) {
      expect(() => guard.runFirstSeed(env, runner, (dir, key) => dir.endsWith(app) && key === "NEXT_PUBLIC_CONVEX_SITE_URL" ? other : undefined)).toThrow(`${app} NEXT_PUBLIC_CONVEX_SITE_URL target mismatch`);
    }
    expect(runner).not.toHaveBeenCalled();
  });

  test("refuses missing server trusted origins before seed", () => {
    const runner = vi.fn().mockReturnValue(JSON.stringify({ ...JSON.parse(empty), e2eOriginsTrusted: false }));
    expect(() => guard.runFirstSeed(env, runner, noFileTarget)).toThrow("does not trust all localhost:3101-3103 origins");
    expect(runner).toHaveBeenCalledTimes(1);
  });

  test("refuses a different server URL and a present school before seed", () => {
    const runner = vi.fn().mockReturnValueOnce(JSON.stringify({ ...JSON.parse(empty), cloudUrl: "https://other.convex.cloud" }));
    expect(() => guard.runFirstSeed(env, runner, noFileTarget)).toThrow("server cloud URL");
    expect(runner).toHaveBeenCalledTimes(1);
    runner.mockClear().mockReturnValue(JSON.stringify({ ...JSON.parse(empty), school: { id: "school", name: "Demo" }, ready: false, blockers: ["review"] }));
    expect(() => guard.runFirstSeed(env, runner, noFileTarget)).toThrow("Replace the disposable dev deployment");
    expect(runner).toHaveBeenCalledTimes(1);
  });

  test("refuses partial inspection even without a demo school", () => {
    const runner = vi.fn().mockReturnValue(JSON.stringify({ ...JSON.parse(empty), blockers: ["Better Auth: demo credential 1 already exists"], ready: false }));
    expect(() => guard.runFirstSeed(env, runner, noFileTarget)).toThrow("preflight has blockers");
    expect(runner).toHaveBeenCalledTimes(1);
  });

  test("seed failure instructs replacement instead of retry", () => {
    const runner = vi.fn().mockReturnValueOnce(empty).mockImplementationOnce(() => { throw new Error("private CLI details"); });
    expect(() => guard.runFirstSeed(env, runner, noFileTarget)).toThrow("abandon and replace the disposable dev deployment");
    expect(runner).toHaveBeenCalledTimes(2);
  });

  test("destructive E2E refuses occupied app ports without changing admissions smoke", () => {
    expect(destructiveConfig.webServer.map((server: { reuseExistingServer: boolean }) => server.reuseExistingServer)).toEqual([false, false, false]);
    expect(admissionsConfig.webServer.map((server: { reuseExistingServer: boolean }) => server.reuseExistingServer)).toEqual([true, true]);
  });

  test("inspects and seeds only on an empty dedicated dev target", () => {
    const runner = vi.fn().mockReturnValueOnce(empty).mockReturnValueOnce("{}");
    guard.runFirstSeed(env, runner, noFileTarget);
    expect(runner).toHaveBeenCalledTimes(2);
    const [node, inspectArgs, options] = runner.mock.calls[0];
    expect(node).toBe(process.execPath);
    expect(inspectArgs.slice(1, 3)).toEqual(["run", "functions/academic/demoPreflightAction:inspectDemoSchool"]);
    expect(JSON.parse(inspectArgs[3])).toEqual({ operatorToken: "test-token", targetIdentity: "test-identity" });
    expect(options.stdio).toEqual(["ignore", "pipe", "pipe"]);
    const seedArgs = runner.mock.calls[1][1];
    expect(seedArgs.slice(1, 3)).toEqual(["run", "functions/academic/seedRunner:seedDemoSchool"]);
    expect(JSON.parse(seedArgs[3])).toEqual({
      operatorToken: "test-token", targetIdentity: "test-identity", confirmation: "RESET demo-school",
      deploymentEnvironment: "development", inspectedSchoolId: null, inspectedSchoolSlug: "demo-school",
    });
    expect(seedArgs).not.toContain("--prod");
    expect(seedArgs).not.toContain("--push");
  });
});
