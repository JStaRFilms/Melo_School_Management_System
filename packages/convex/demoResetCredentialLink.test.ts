import { afterEach, expect, test, vi } from "vitest";
import type { ActionCtx } from "./_generated/server";
import { assertReviewedCredential, reconcileAuthUser } from "./functions/academic/seedRunnerSecurity";
import { createAuth } from "./betterAuth";

vi.mock("./betterAuth", () => ({ createAuth: vi.fn() }));
afterEach(() => vi.clearAllMocks());

const account = { name: "Demo", email: "demo@example.test", password: "password" };
const ctx = {} as ActionCtx;
function adapter(accounts: Array<{ providerId: string; accountId: string }>, userId = "reviewed") {
  const internalAdapter = {
    findUserByEmail: vi.fn().mockResolvedValue({ user: { id: userId, email: account.email }, accounts }),
    updateUser: vi.fn(), updatePassword: vi.fn(), deleteSessions: vi.fn(), linkAccount: vi.fn(), createUser: vi.fn(),
  };
  vi.mocked(createAuth).mockReturnValue({ $context: Promise.resolve({ internalAdapter, password: { hash: vi.fn().mockResolvedValue("hash") } }) } as unknown as ReturnType<typeof createAuth>);
  return internalAdapter;
}

test.each([
  [{ providerId: "google", accountId: "reviewed" }],
  [{ providerId: "credential", accountId: "other" }],
  [{ providerId: "credential", accountId: "reviewed" }, { providerId: "google", accountId: "reviewed" }],
])("wrong or multiple provider links refuse every auth write", async (...links) => {
  const auth = adapter(links);
  await expect(assertReviewedCredential(ctx, account, "reviewed")).rejects.toThrow("credential link changed");
  await expect(reconcileAuthUser(ctx, account, "reviewed")).rejects.toThrow("credential link changed");
  expect(auth.updateUser).not.toHaveBeenCalled();
  expect(auth.updatePassword).not.toHaveBeenCalled();
  expect(auth.deleteSessions).not.toHaveBeenCalled();
  expect(auth.linkAccount).not.toHaveBeenCalled();
});

test("a link replaced after the user update refuses password and session writes", async () => {
  const auth = adapter([{ providerId: "credential", accountId: "reviewed" }]);
  auth.findUserByEmail.mockResolvedValueOnce({ user: { id: "reviewed", email: account.email }, accounts: [{ providerId: "credential", accountId: "reviewed" }] })
    .mockResolvedValueOnce({ user: { id: "reviewed", email: account.email }, accounts: [{ providerId: "google", accountId: "reviewed" }] });
  await expect(reconcileAuthUser(ctx, account, "reviewed")).rejects.toThrow("credential link changed");
  expect(auth.updatePassword).not.toHaveBeenCalled();
  expect(auth.deleteSessions).not.toHaveBeenCalled();
});

test("correct single credential is rechecked before password/session write", async () => {
  const auth = adapter([{ providerId: "credential", accountId: "reviewed" }]);
  await assertReviewedCredential(ctx, account, "reviewed");
  await expect(reconcileAuthUser(ctx, account, "reviewed")).resolves.toBe("reviewed");
  expect(auth.findUserByEmail).toHaveBeenCalledTimes(4);
  expect(auth.updatePassword).toHaveBeenCalledOnce();
  expect(auth.deleteSessions).toHaveBeenCalledOnce();
});
