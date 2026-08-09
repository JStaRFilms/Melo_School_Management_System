import { describe, expect, test } from "vitest";
import { invokePendingCampaignCommand, loadPendingCampaignCommand, savePendingCampaignCommand } from "../lib/admissions/campaignOperation";

describe("admissions campaign command retry", () => {
  test("persists and retries the exact replace snapshot once after a transport failure", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const payload = { schoolId: "school", intakeId: "intake", operationKey: "campaign-1", targetStatus: "published", configuration: { fields: [{ fieldKey: "custom", kind: "text" }], requirements: [{ requirementKey: "birth-cert" }] } };
    savePendingCampaignCommand(storage, "pending", { command: "replace", payload });
    const loaded = loadPendingCampaignCommand(storage, "pending");
    const createCalls: Record<string, unknown>[] = []; const replaceCalls: Record<string, unknown>[] = [];
    await invokePendingCampaignCommand(loaded!, { create: async (command) => { createCalls.push(command); }, replace: async (command) => { replaceCalls.push(command); } });
    expect(createCalls).toEqual([]); expect(replaceCalls).toEqual([payload]); expect(loadPendingCampaignCommand(storage, "pending")).toEqual({ command: "replace", payload });
  });

  test("drops malformed persisted data rather than retrying an unknown command", () => {
    const values = new Map([["pending", "{not-json"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    expect(loadPendingCampaignCommand(storage, "pending")).toBeNull(); expect(values.has("pending")).toBe(false);
  });
});
