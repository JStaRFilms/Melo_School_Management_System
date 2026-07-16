import { afterEach, describe, expect, test } from "vitest";
import { assertOperatorGate, isMissingStorageObjectError } from "../seedRunner";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });

const base = {
  confirmation: "RESET demo-school",
  operatorToken: "operator-token",
  targetIdentity: "local-test",
  deploymentEnvironment: "preview" as const,
};

describe("demo seed operator gates", () => {
  test("requires matching explicit deployment identity and environment", () => {
    process.env.DEMO_SEED_OPERATOR_TOKEN = "operator-token";
    process.env.DEMO_SEED_DEPLOYMENT_IDENTITY = "local-test";
    process.env.DEMO_SEED_DEPLOYMENT_ENV = "preview";
    expect(() => assertOperatorGate(base)).not.toThrow();
    expect(() => assertOperatorGate({ ...base, targetIdentity: "wrong" })).toThrow("target identity");
  });

  test("requires both dedicated production gates", () => {
    process.env.DEMO_SEED_OPERATOR_TOKEN = "operator-token";
    process.env.DEMO_SEED_DEPLOYMENT_IDENTITY = "production-test";
    process.env.DEMO_SEED_DEPLOYMENT_ENV = "production";
    const production = { ...base, targetIdentity: "production-test", deploymentEnvironment: "production" as const, productionConfirmation: "RESET demo-school IN PRODUCTION" };
    expect(() => assertOperatorGate(production)).toThrow("DEMO_SEED_ALLOW_PRODUCTION");
    process.env.DEMO_SEED_ALLOW_PRODUCTION = "true";
    expect(() => assertOperatorGate(production)).not.toThrow();
  });

  test("recognizes already-deleted storage objects for idempotent cleanup", () => {
    expect(isMissingStorageObjectError(new Error('Invalid storage delete request: {"code":"StorageIdNotFound","message":"storage id abc not found"}'))).toBe(true);
    expect(isMissingStorageObjectError(new Error("network unavailable"))).toBe(false);
  });
});
