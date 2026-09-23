import { afterEach, describe, expect, test } from "vitest";
import { assertJudgeOperatorGate, assertOperatorGate, isMissingStorageObjectError } from "../seedRunner";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });

const base = {
  confirmation: "RESET demo-school",
  operatorToken: "operator-token",
  targetIdentity: "local-test",
  deploymentEnvironment: "development" as const,
};

describe("demo seed operator gates", () => {
  test("requires matching explicit deployment identity and environment", () => {
    process.env.DEMO_SEED_OPERATOR_TOKEN = "operator-token";
    process.env.DEMO_SEED_DEPLOYMENT_IDENTITY = "local-test";
    process.env.DEMO_SEED_DEPLOYMENT_ENV = "development";
    process.env.DEMO_SEED_EXPECTED_CLOUD_URL = "https://dev.convex.cloud";
    process.env.CONVEX_CLOUD_URL = "https://dev.convex.cloud";
    expect(() => assertOperatorGate(base)).not.toThrow();
    process.env.CONVEX_CLOUD_URL = "https://other.convex.cloud";
    expect(() => assertOperatorGate(base)).toThrow("cloud URL");
    expect(() => assertOperatorGate({ ...base, targetIdentity: "wrong" })).toThrow("target identity");
  });

  test("rejects production even with a confirmation and an opt-in", () => {
    process.env.DEMO_SEED_OPERATOR_TOKEN = "operator-token";
    process.env.DEMO_SEED_DEPLOYMENT_IDENTITY = "production-test";
    process.env.DEMO_SEED_DEPLOYMENT_ENV = "production";
    const production = { ...base, targetIdentity: "production-test", deploymentEnvironment: "production" as const, productionConfirmation: "RESET demo-school IN PRODUCTION" };
    process.env.DEMO_SEED_ALLOW_PRODUCTION = "true";
    expect(() => assertOperatorGate(production)).toThrow("development deployment");
  });

  test("recognizes already-deleted storage objects for idempotent cleanup", () => {
    expect(isMissingStorageObjectError(new Error('Invalid storage delete request: {"code":"StorageIdNotFound","message":"storage id abc not found"}'))).toBe(true);
    expect(isMissingStorageObjectError(new Error("network unavailable"))).toBe(false);
  });

  test("uses independent gates for the codex-academy judge tenant", () => {
    process.env.JUDGE_SEED_OPERATOR_TOKEN = "judge-token";
    process.env.JUDGE_SEED_DEPLOYMENT_IDENTITY = "judge-preview";
    process.env.JUDGE_SEED_DEPLOYMENT_ENV = "preview";
    const judge = {
      confirmation: "RESET codex-academy",
      operatorToken: "judge-token",
      targetIdentity: "judge-preview",
      deploymentEnvironment: "preview" as const,
    };
    expect(() => assertJudgeOperatorGate(judge)).not.toThrow();
    expect(() => assertJudgeOperatorGate({ ...judge, confirmation: "RESET demo-school" })).toThrow("codex-academy");
    expect(() => assertOperatorGate({ ...base, operatorToken: "judge-token" })).toThrow("operator token");
  });
});
