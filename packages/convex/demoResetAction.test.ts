import { getFunctionName } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { executeReviewedDemoReset } from "./functions/academic/demoResetAction";
import { DEMO_ACCOUNTS } from "./functions/academic/demoData";

afterEach(() => vi.unstubAllEnvs());
const schoolId = "school" as Id<"schools">;
const operationId = "operation" as Id<"demoResetOperations">;
const hash = "a".repeat(64);
const phrase = `RESET demo-school ${schoolId} ${hash} ${"b".repeat(32)}`;
const args = { operatorToken: "secret", targetIdentity: "isolated-demo", deploymentEnvironment: "development" as const,
  schoolId, schoolSlug: "demo-school", operationId, inventoryHash: hash, confirmationPhrase: phrase };
function setup(options: { rows?: number; blobs?: Id<"_storage">[]; retained?: Id<"_storage">[]; status?: "prepared" | "deleting" | "storage_pending"; cursor?: number } = {}) {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "secret");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "isolated-demo");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  let status: string = options.status ?? "prepared";
  let cursor = options.cursor ?? 0;
  let acknowledged: Id<"_storage">[] = [];
  const rows = options.rows ?? 1;
  const retained = options.blobs?.length ? Array.from({ length: 37 }, (_, i) => `original-${i}` as Id<"_storage">) : [];
  const blobs = [...retained, ...(options.blobs ?? [])];
  const deletions: string[] = [];
  const otherSchool = { slug: "other", rows: 7 };
  const ctx = {
    runQuery: vi.fn(async (ref: object, params: { storageId?: Id<"_storage"> }) => {
      const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]);
      if (name.endsWith(":readReviewedDemoResetInternal")) return {
        schoolId, schoolSlug: "demo-school", cloudUrl: "https://test.convex.cloud", targetIdentity: "isolated-demo",
        status, inventoryHash: hash, confirmationPhrase: phrase, deletionCursor: cursor, inventoryLength: rows,
        storageCandidateIds: blobs, retainedStorageIds: options.retained ?? retained, storageAcknowledgedIds: acknowledged,
      };
      if (name.endsWith(":checkDemoResetAuthDetachedInternal")) return Object.values(DEMO_ACCOUNTS).map((account, index) => ({
        index, authId: `auth-${index}`, email: account.email.trim().toLowerCase(), acknowledged: index < authProgress,
      }));
      throw new Error(name);
    }),
    runMutation: vi.fn(async (ref: object, params: { storageId?: Id<"_storage"> }) => {
      const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]);
      if (name.endsWith(":authorizeReviewedDemoResetInternal")) { status = "deleting"; return null; }
      if (name.endsWith(":deleteReviewedDemoRowsBatchInternal")) {
        if (failAtCursor === cursor) throw new Error("interrupted");
        cursor = Math.min(rows, cursor + 50);
        deletions.push(`batch:${cursor}`);
        status = cursor === rows ? "storage_pending" : "deleting";
        return { cursor, status };
      }
      if (name.endsWith(":finishEmptyDemoResetStorageInternal")) { status = "auth_pending"; return status; }
      if (name.endsWith(":processDemoResetStorageCandidateInternal")) {
        acknowledged.push(params.storageId!);
        status = acknowledged.length === blobs.length ? "auth_pending" : "storage_pending";
        return { status, acknowledged: acknowledged.length };
      }
      if (name.endsWith(":acknowledgeDemoResetAuthInternal")) {
        authProgress++;
        status = authProgress === 3 ? "ready_to_seed" : "auth_pending";
        return { status, acknowledged: authProgress };
      }
      throw new Error(name);
    }),
  };
  let failAtCursor = -1;
  let authProgress = 0;
  const auth = {
    find: vi.fn(async (_ctx: ActionCtx, account: typeof DEMO_ACCOUNTS.admin) => `auth-${Object.values(DEMO_ACCOUNTS).indexOf(account)}`),
    verify: vi.fn(async (_ctx: ActionCtx, _account: typeof DEMO_ACCOUNTS.admin, id: string) => id),
    reconcile: vi.fn(async (_ctx: ActionCtx, account: typeof DEMO_ACCOUNTS.admin) => `auth-${Object.values(DEMO_ACCOUNTS).indexOf(account)}`),
  };
  const execute = (input = args) => executeReviewedDemoReset(ctx as unknown as ActionCtx, input, auth);
  return { ctx, execute, auth, deletions, otherSchool, get cursor() { return cursor; },
    interruptAt: (at: number) => { failAtCursor = at; } };
}

test("wrong fresh phrase leaves every destructive operation untouched", async () => {
  const f = setup();
  await expect(f.execute({ ...args, confirmationPhrase: `${phrase} ` })).rejects.toThrow("confirmation changed");
  await expect(f.execute({ ...args, inventoryHash: "c".repeat(64) })).rejects.toThrow("confirmation changed");
  await expect(f.execute({ ...args, schoolId: "other" as Id<"schools"> })).rejects.toThrow("confirmation changed");
  expect(f.ctx.runMutation).not.toHaveBeenCalled();
  expect(f.auth.reconcile).not.toHaveBeenCalled();
});

test("interruption after 50 batches resumes at the durable cursor", async () => {
  const f = setup({ rows: 2550, status: "deleting" });
  f.interruptAt(2500);
  await expect(f.execute()).rejects.toThrow("interrupted");
  expect(f.cursor).toBe(2500);
  f.interruptAt(-1);
  await expect(f.execute()).resolves.toEqual({ operationId, status: "ready_to_seed" });
  expect(f.deletions).toHaveLength(51);
  expect(f.deletions.filter((item) => item === "batch:2500")).toHaveLength(1);
  expect(f.otherSchool).toEqual({ slug: "other", rows: 7 });
});

test("interrupted storage processing resumes through the mutation", async () => {
  const f = setup({ status: "storage_pending", blobs: ["blob" as Id<"_storage">] });
  f.ctx.runMutation.mockImplementationOnce(async () => { throw new Error("interrupted"); });
  await expect(f.execute()).rejects.toThrow("interrupted");
  await expect(f.execute()).resolves.toEqual({ operationId, status: "ready_to_seed" });
  expect(f.auth.reconcile).toHaveBeenCalledTimes(3);
});

test("public execution sends reviewed candidates only to the transactional processor", async () => {
  const extra = "extra" as Id<"_storage">;
  const f = setup({ status: "storage_pending", blobs: [extra] });
  await f.execute();
  expect(f.ctx.runMutation.mock.calls.filter(([ref]) => getFunctionName(ref).endsWith(":processDemoResetStorageCandidateInternal"))).toHaveLength(38);
});

test("storage mutation failure stops before auth access", async () => {
  const f = setup({ status: "storage_pending", blobs: ["blob" as Id<"_storage">] });
  f.ctx.runMutation.mockRejectedValueOnce(new Error("permission denied"));
  await expect(f.execute()).rejects.toThrow("permission denied");
  expect(f.auth.find).not.toHaveBeenCalled();
});

test("51 candidates refuse before authorization or deletion", async () => {
  const f = setup({ blobs: Array.from({ length: 14 }, (_, i) => `extra-${i}` as Id<"_storage">) });
  await expect(f.execute()).rejects.toThrow("exceed 50");
  expect(f.ctx.runMutation).not.toHaveBeenCalled();
  expect(f.auth.reconcile).not.toHaveBeenCalled();
});

test("changed credential link refuses password and session reconciliation", async () => {
  const f = setup({ status: "storage_pending" });
  f.auth.verify.mockRejectedValueOnce(new Error("credential link changed"));
  await expect(f.execute()).rejects.toThrow("credential link changed");
  expect(f.auth.reconcile).not.toHaveBeenCalled();
});

test("different Better Auth ID refuses reconciliation", async () => {
  const f = setup({ status: "storage_pending" });
  f.auth.find.mockResolvedValueOnce("other-school-auth");
  await expect(f.execute()).rejects.toThrow("Better Auth ID differs");
  expect(f.auth.reconcile).not.toHaveBeenCalled();
  expect(f.otherSchool.rows).toBe(7);
});
