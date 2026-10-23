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

const issuer = "https://bootstrap-auth.test";
const subject = "first-operator";
const tokenIdentifier = `${issuer}|${subject}`;
const bootstrap = internal.functions.platform.bootstrap.bootstrapPlatformAdminInternal;
const args = {
  adminName: "First Operator",
  adminEmail: "first@bootstrap.test",
  adminAuthId: subject,
};

afterEach(() => { vi.unstubAllEnvs(); });

function useTrustedBootstrapConfig() {
  vi.stubEnv("CONVEX_SITE_URL", issuer);
  vi.stubEnv("LEGACY_SUBJECT_FALLBACK_ENABLED", "false");
}

describe("platform bootstrap identity binding", () => {
  it("stores the canonical token identity so the first sign-in authorizes the platform read path", async () => {
    useTrustedBootstrapConfig();
    const t = convexTest(schema, modules);

    const { platformAdminId } = await t.mutation(bootstrap, args);

    expect(await t.run((ctx) => ctx.db.get(platformAdminId))).toMatchObject({
      authId: subject,
      authTokenIdentifier: tokenIdentifier,
      email: args.adminEmail,
      isActive: true,
    });
    await expect(t.withIdentity({ subject, issuer, tokenIdentifier })
      .query(api.functions.platform.index.listSchools, {}))
      .resolves.toEqual([]);
    await expect(t.withIdentity({ subject: "someone-else", issuer, tokenIdentifier: `${issuer}|someone-else` })
      .query(api.functions.platform.index.listSchools, {}))
      .rejects.toThrow();
  }, 20_000);

  it("links an unlinked legacy operator once and accepts an idempotent repeat", async () => {
    useTrustedBootstrapConfig();
    const t = convexTest(schema, modules);
    const platformAdminId = await t.run((ctx) => ctx.db.insert("platformAdmins", {
      authId: subject,
      email: args.adminEmail,
      name: "Legacy Operator",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    }));

    expect(await t.mutation(bootstrap, args)).toEqual({ platformAdminId });
    expect(await t.mutation(bootstrap, args)).toEqual({ platformAdminId });
    expect(await t.run((ctx) => ctx.db.get(platformAdminId))).toMatchObject({
      authTokenIdentifier: tokenIdentifier,
      name: "First Operator",
      isActive: true,
    });
  });

  it("rejects a mismatched subject for an existing email without rewriting it", async () => {
    useTrustedBootstrapConfig();
    const t = convexTest(schema, modules);
    const platformAdminId = await t.run((ctx) => ctx.db.insert("platformAdmins", {
      authId: "old-subject",
      email: args.adminEmail,
      name: "Legacy Operator",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    }));

    await expect(t.mutation(bootstrap, args))
      .rejects.toThrow("different authentication subject");
    expect(await t.run((ctx) => ctx.db.get(platformAdminId))).toMatchObject({
      authId: "old-subject",
      name: "Legacy Operator",
    });
    expect((await t.run((ctx) => ctx.db.get(platformAdminId)))?.authTokenIdentifier).toBeUndefined();
  });

  it("rejects a row whose recorded token identity differs from the derived one", async () => {
    useTrustedBootstrapConfig();
    const t = convexTest(schema, modules);
    const platformAdminId = await t.run((ctx) => ctx.db.insert("platformAdmins", {
      authId: subject,
      authTokenIdentifier: `https://other-auth.test|${subject}`,
      email: args.adminEmail,
      name: "Operator",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    }));

    await expect(t.mutation(bootstrap, args))
      .rejects.toThrow("different token identity");
    expect((await t.run((ctx) => ctx.db.get(platformAdminId)))?.authTokenIdentifier)
      .toBe(`https://other-auth.test|${subject}`);
  });

  it("rejects identities that are already linked or ambiguous across operators", async () => {
    useTrustedBootstrapConfig();
    const t = convexTest(schema, modules);
    const original = await t.run((ctx) => ctx.db.insert("platformAdmins", {
      authId: subject,
      email: "original@bootstrap.test",
      name: "Operator",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    }));
    await t.mutation(bootstrap, { ...args, adminEmail: "original@bootstrap.test" });

    await expect(t.mutation(bootstrap, args))
      .rejects.toThrow("already linked to another platform admin");
    expect((await t.run((ctx) => ctx.db.get(original)))?.email).toBe("original@bootstrap.test");
    expect(await t.run((ctx) => ctx.db.query("platformAdmins").withIndex("by_email", (q) => q.eq("email", args.adminEmail)).take(2)))
      .toEqual([]);

    await t.run((ctx) => ctx.db.insert("platformAdmins", {
      authId: subject,
      email: args.adminEmail,
      name: "Duplicate Subject",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    }));
    await expect(t.mutation(bootstrap, args))
      .rejects.toThrow("ambiguous across platform admins");
    expect((await t.run((ctx) => ctx.db.get(original)))?.authTokenIdentifier).toBe(tokenIdentifier);
  });

  it("rejects duplicate email rows and refuses to bootstrap without a configured issuer", async () => {
    useTrustedBootstrapConfig();
    const t = convexTest(schema, modules);
    for (const authId of ["one-subject", "two-subject"]) {
      await t.run((ctx) => ctx.db.insert("platformAdmins", {
        authId,
        email: args.adminEmail,
        name: authId,
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      }));
    }
    await expect(t.mutation(bootstrap, args))
      .rejects.toThrow("Multiple platform admins share this email");
    expect(await t.run((ctx) => ctx.db.query("platformAdmins").withIndex("by_email", (q) => q.eq("email", args.adminEmail)).take(2)))
      .toHaveLength(2);

    vi.stubEnv("CONVEX_SITE_URL", "");
    await expect(t.mutation(bootstrap, { ...args, adminEmail: "fresh@bootstrap.test" }))
      .rejects.toThrow("Authentication issuer is not configured");
    expect(await t.run((ctx) => ctx.db.query("platformAdmins").withIndex("by_email", (q) => q.eq("email", "fresh@bootstrap.test")).take(2)))
      .toEqual([]);
  });
});
