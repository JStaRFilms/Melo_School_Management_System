import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../../_generated/api";
import schema from "../../../schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../../../**/*.ts")).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);

const issuer = "https://preview-auth.test";
const identity = {
  subject: "bootstrap-operator",
  issuer,
  tokenIdentifier: `${issuer}|bootstrap-operator`,
};

afterEach(() => { vi.unstubAllEnvs(); });

describe("reviewed platform identity repair", () => {
  it("links one bootstrapped operator to the deployment issuer", async () => {
    vi.stubEnv("CONVEX_SITE_URL", issuer);
    vi.stubEnv("LEGACY_SUBJECT_FALLBACK_ENABLED", "false");
    const t = convexTest(schema, modules);
    const platformAdminId = await t.run((ctx) => ctx.db.insert("platformAdmins", {
      authId: identity.subject,
      email: "operator@preview.test",
      name: "Operator",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    }));

    await expect(t.withIdentity(identity).query(api.functions.platform.index.listSchools, {}))
      .rejects.toThrow("untrusted legacy identity issuer");
    await t.mutation(internal.functions.platform.auth.reconcilePlatformAdminIdentity, {
      platformAdminId,
      expectedAuthId: identity.subject,
      expectedEmail: "operator@preview.test",
    });

    const admin = await t.run((ctx) => ctx.db.get(platformAdminId));
    expect(admin?.authTokenIdentifier).toBe(identity.tokenIdentifier);
    await expect(t.withIdentity(identity).query(api.functions.platform.index.listSchools, {}))
      .resolves.toEqual([]);
  });

  it("rejects mismatched, inactive, or ambiguous operators without linking them", async () => {
    vi.stubEnv("CONVEX_SITE_URL", issuer);
    const t = convexTest(schema, modules);
    const platformAdminId = await t.run((ctx) => ctx.db.insert("platformAdmins", {
      authId: identity.subject,
      email: "operator@preview.test",
      name: "Operator",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    }));
    const repair = internal.functions.platform.auth.reconcilePlatformAdminIdentity;
    await expect(t.mutation(repair, {
      platformAdminId, expectedAuthId: "different", expectedEmail: "operator@preview.test",
    })).rejects.toThrow("requires reviewed reconciliation");
    await expect(t.mutation(repair, {
      platformAdminId, expectedAuthId: identity.subject, expectedEmail: "different@preview.test",
    })).rejects.toThrow("requires reviewed reconciliation");
    await t.run((ctx) => ctx.db.patch(platformAdminId, { isActive: false }));
    await expect(t.mutation(repair, {
      platformAdminId, expectedAuthId: identity.subject, expectedEmail: "operator@preview.test",
    })).rejects.toThrow("requires reviewed reconciliation");
    await t.run((ctx) => ctx.db.patch(platformAdminId, { isActive: true }));

    await t.run((ctx) => ctx.db.insert("platformAdmins", {
      authId: identity.subject,
      email: "another@preview.test",
      name: "Another Operator",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    }));
    await expect(t.mutation(repair, {
      platformAdminId, expectedAuthId: identity.subject, expectedEmail: "operator@preview.test",
    })).rejects.toThrow("Platform identity is ambiguous");
    expect((await t.run((ctx) => ctx.db.get(platformAdminId)))?.authTokenIdentifier).toBeUndefined();
  });
});
