import { describe, expect, test } from "vitest";
import globalSetup from "../../e2e/global-setup.js";

const helpers = globalSetup as typeof globalSetup & {
  buildSeedInvocation: (env: Record<string, string | undefined>, nodeExecutable?: string) => { command: string; args: string[] };
};

const base = { DEMO_SEED_OPERATOR_TOKEN: "token", DEMO_SEED_DEPLOYMENT_IDENTITY: "local-test", DEMO_SEED_DEPLOYMENT_ENV: "preview" };

describe("E2E demo reset invocation guard", () => {
  test("runs the Convex CLI through Node and sends JSON as one argument", () => {
    const invocation = helpers.buildSeedInvocation(base, "C:/Program Files/nodejs/node.exe");
    expect(invocation.command).toBe("C:/Program Files/nodejs/node.exe");
    expect(invocation.args[0]).toMatch(/convex[\\/]bin[\\/]main\.js$/);
    expect(JSON.parse(invocation.args.at(-1)!)).toMatchObject({ confirmation: "RESET demo-school", deploymentEnvironment: "preview" });
  });

  test("never invents the production phrase", () => {
    expect(() => helpers.buildSeedInvocation({ ...base, DEMO_SEED_DEPLOYMENT_ENV: "production" })).toThrow("DEMO_SEED_PRODUCTION_CONFIRMATION");
    expect(() => helpers.buildSeedInvocation({ ...base, DEMO_SEED_DEPLOYMENT_ENV: "production", DEMO_SEED_PRODUCTION_CONFIRMATION: "wrong" })).toThrow("DEMO_SEED_PRODUCTION_CONFIRMATION");
    const invocation = helpers.buildSeedInvocation({ ...base, DEMO_SEED_DEPLOYMENT_ENV: "production", DEMO_SEED_PRODUCTION_CONFIRMATION: "RESET demo-school IN PRODUCTION" });
    expect(JSON.parse(invocation.args.at(-1)!).productionConfirmation).toBe("RESET demo-school IN PRODUCTION");
  });
});
