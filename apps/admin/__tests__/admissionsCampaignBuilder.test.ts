import { describe, expect, test } from "vitest";
import { invokePendingCampaignCommand, isStaleRecoveryReplaceCommand, loadPendingCampaignCommand, savePendingCampaignCommand } from "../lib/admissions/campaignOperation";

describe("admissions campaign command retry", () => {
  test("persists and retries the exact replace snapshot once after a transport failure", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const payload = { schoolId: "school", intakeId: "intake", operationKey: "campaign-1", targetStatus: "published", configuration: { fields: [{ fieldKey: "custom", kind: "text" }], requirements: [{ requirementKey: "birth-cert" }] } };
    savePendingCampaignCommand(storage, "pending", { command: "replace", payload, reconciliationRequired: false });
    const loaded = loadPendingCampaignCommand(storage, "pending");
    const createCalls: Record<string, unknown>[] = []; const replaceCalls: Record<string, unknown>[] = [];
    await invokePendingCampaignCommand(loaded!, { create: async (command) => { createCalls.push(command); }, replace: async (command) => { replaceCalls.push(command); } });
    expect(createCalls).toEqual([]); expect(replaceCalls).toEqual([payload]); expect(loadPendingCampaignCommand(storage, "pending")).toEqual({ command: "replace", payload, reconciliationRequired: false });
  });

  test("identifies only a same-intake replace command missing explicit recovery intent as stale", async () => {
    const stale = { command: "replace" as const, payload: { intakeId: "intake", operationKey: "before-recovery" }, reconciliationRequired: false };
    const validRecoveryRetry = { command: "replace" as const, payload: { intakeId: "intake", operationKey: "recovery-retry", recoverLegacyToDraft: true }, reconciliationRequired: false };

    expect(isStaleRecoveryReplaceCommand(stale, "intake")).toBe(true);
    expect(isStaleRecoveryReplaceCommand(validRecoveryRetry, "intake")).toBe(false);
    expect(isStaleRecoveryReplaceCommand(stale, "other-intake")).toBe(false);

    const replace = async (payload: Record<string, unknown>) => payload;
    await expect(invokePendingCampaignCommand(validRecoveryRetry, { create: async () => undefined, replace })).resolves.toEqual(validRecoveryRetry.payload);
  });

  test("retains the exact command snapshot when reconciliation is required", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const pending = { command: "create" as const, payload: { schoolId: "school", operationKey: "reused-key", targetStatus: "published", configuration: { fields: [], requirements: [] } }, reconciliationRequired: true };
    savePendingCampaignCommand(storage, "pending", pending);
    await expect(invokePendingCampaignCommand(pending, { create: async () => { throw new Error("OPERATION_KEY_REUSED"); }, replace: async () => undefined })).rejects.toThrow("OPERATION_KEY_REUSED");
    expect(loadPendingCampaignCommand(storage, "pending")).toEqual(pending);
  });

  test("drops malformed persisted data rather than retrying an unknown command", () => {
    const values = new Map([["pending", "{not-json"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    expect(loadPendingCampaignCommand(storage, "pending")).toBeNull(); expect(values.has("pending")).toBe(false);
  });
});
