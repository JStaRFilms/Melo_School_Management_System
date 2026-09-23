// Shared canonical Convex-value encoding for the action inventory and V8 mutation.
export function resetSeal(op: { schoolId: unknown; cloudUrl: string; targetIdentity: string; inventory: unknown; authIssuer: string; authIds: string[]; personIds: unknown; storageCandidateIds: unknown; retainedStorageIds: unknown }) {
  const { schoolId, cloudUrl, targetIdentity, inventory, authIssuer, authIds, personIds, storageCandidateIds, retainedStorageIds } = op;
  return { schoolId, cloudUrl, targetIdentity, inventory, authIssuer, authIds, personIds, storageCandidateIds, retainedStorageIds };
}

export function originalAssetIds(run: { logoStorageId: string; portraitStorageIds: string[] }): string[] {
  const ids = [run.logoStorageId, ...run.portraitStorageIds];
  if (run.portraitStorageIds.length !== 36 || new Set(ids).size !== 37) throw new Error("Original demo assets must be 37 distinct files");
  return ids;
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function canonical(value: unknown): string {
  if (typeof value === "bigint") return `bigint:${value.toString()}`;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return `bytes:${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))}`;
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => compare(a, b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function subtleSha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
