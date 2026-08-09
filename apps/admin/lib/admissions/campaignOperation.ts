export type PendingCampaignCommand = {
  command: "create" | "replace";
  payload: Record<string, unknown>;
  reconciliationRequired: boolean;
};

type SessionStorage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export function loadPendingCampaignCommand(storage: SessionStorage, key: string): PendingCampaignCommand | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") throw new Error("invalid");
    const pending = value as Partial<PendingCampaignCommand>;
    if ((pending.command !== "create" && pending.command !== "replace") || !pending.payload || typeof pending.payload !== "object") throw new Error("invalid");
    return { command: pending.command, payload: pending.payload, reconciliationRequired: pending.reconciliationRequired === true };
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function savePendingCampaignCommand(storage: SessionStorage, key: string, pending: PendingCampaignCommand) {
  storage.setItem(key, JSON.stringify(pending));
}

export function isStaleRecoveryReplaceCommand(pending: PendingCampaignCommand, intakeId: string): boolean {
  return pending.command === "replace"
    && pending.payload.intakeId === intakeId
    && pending.payload.recoverLegacyToDraft !== true;
}

export async function invokePendingCampaignCommand(pending: PendingCampaignCommand, commands: { create: (payload: Record<string, unknown>) => Promise<unknown>; replace: (payload: Record<string, unknown>) => Promise<unknown> }) {
  return pending.command === "create" ? commands.create(pending.payload) : commands.replace(pending.payload);
}
