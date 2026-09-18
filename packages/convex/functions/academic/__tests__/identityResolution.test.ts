import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { internal } from "../../../_generated/api";
import { api } from "../../../_generated/api";
import {
  resolveTokenFirstTrustedLegacyRow,
  type LegacyIdentityRow,
} from "../identityResolver";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));

const TRUSTED_ISSUER = "https://legacy-auth.test";

type Row = LegacyIdentityRow & { school?: string };

function lookup(rows: Row[]) {
  return {
    byTokenIdentifier: async (token: string) => rows.filter((r) => r.authTokenIdentifier === token),
    bySubject: async (subject: string) => rows.filter((r) => r.authId === subject),
  };
}

describe("resolveTokenFirstTrustedLegacyRow matrix (consolidation P6)", () => {
  it("resolves by token identifier alone", async () => {
    const row = await resolveTokenFirstTrustedLegacyRow(
      { tokenIdentifier: "tok|a", subject: "other", issuer: "https://evil.test" },
      lookup([{ authId: "admin-a", authTokenIdentifier: "tok|a" }]),
    );
    expect(row).toMatchObject({ authId: "admin-a" });
  });

  it("falls back to unlinked subject rows from a trusted issuer", async () => {
    const row = await resolveTokenFirstTrustedLegacyRow(
      { tokenIdentifier: "tok|missing", subject: "legacy-a", issuer: TRUSTED_ISSUER },
      lookup([{ authId: "legacy-a" }]),
    );
    expect(row).toMatchObject({ authId: "legacy-a" });
  });

  it("rejects subject fallback from an untrusted issuer", async () => {
    await expect(
      resolveTokenFirstTrustedLegacyRow(
        { tokenIdentifier: "tok|missing", subject: "legacy-a", issuer: "https://evil.test" },
        lookup([{ authId: "legacy-a" }]),
      ),
    ).rejects.toThrow("untrusted legacy identity issuer");
  });

  it("rejects subject matches on token-linked rows", async () => {
    await expect(
      resolveTokenFirstTrustedLegacyRow(
        { tokenIdentifier: "tok|other", subject: "linked-a", issuer: TRUSTED_ISSUER },
        lookup([{ authId: "linked-a", authTokenIdentifier: "tok|a" }]),
      ),
    ).rejects.toThrow("mismatched canonical identity link");
  });

  it("rejects ambiguous token and subject matches", async () => {
    await expect(
      resolveTokenFirstTrustedLegacyRow(
        { tokenIdentifier: "tok|dup", subject: "x", issuer: TRUSTED_ISSUER },
        lookup([
          { authId: "a1", authTokenIdentifier: "tok|dup" },
          { authId: "a2", authTokenIdentifier: "tok|dup" },
        ]),
      ),
    ).rejects.toThrow("ambiguous canonical identity");
    await expect(
      resolveTokenFirstTrustedLegacyRow(
        { tokenIdentifier: "tok|missing", subject: "dup", issuer: TRUSTED_ISSUER },
        lookup([{ authId: "dup" }, { authId: "dup" }]),
      ),
    ).rejects.toThrow("ambiguous legacy identity");
  });

  it("skips archived rows", async () => {
    const row = await resolveTokenFirstTrustedLegacyRow(
      { tokenIdentifier: "tok|arch", subject: "arch", issuer: TRUSTED_ISSUER },
      lookup([{ authId: "arch", authTokenIdentifier: "tok|arch", isArchived: true }]),
    );
    expect(row).toBeNull();
  });
});

describe("platform token path (consolidation P6)", () => {
  async function platformFixture() {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("platformAdmins", {
        authId: "platform-subject",
        authTokenIdentifier: "test|platform-token",
        email: "platform@p6.test",
        name: "Platform",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      return ctx.db.insert("schools", { name: "Tenant", slug: "p6-tenant", status: "active", createdAt: now, updatedAt: now });
    });
    return { t, schoolId };
  }

  it("authorizes the token holder", async () => {
    const { t } = await platformFixture();
    const authed = t.withIdentity({
      tokenIdentifier: "test|platform-token",
      subject: "platform-subject",
      issuer: TRUSTED_ISSUER,
      authenticatedAt: Date.now(),
    });
    await expect(
      authed.query(internal.functions.platform.auth.requirePlatformAdminInternal, {}),
    ).resolves.toMatchObject({ email: "platform@p6.test" });
  });

  it("rejects a subject match presented with a different token", async () => {
    const { t } = await platformFixture();
    const mismatched = t.withIdentity({
      tokenIdentifier: "test|other-token",
      subject: "platform-subject",
      issuer: TRUSTED_ISSUER,
      authenticatedAt: Date.now(),
    });
    await expect(
      mismatched.query(internal.functions.platform.auth.requirePlatformAdminInternal, {}),
    ).rejects.toThrow("mismatched canonical identity link");
  });

  it("rejects platform callers on tenant operations", async () => {
    const { t, schoolId } = await platformFixture();
    const platform = t.withIdentity({
      tokenIdentifier: "test|platform-token",
      subject: "platform-subject",
      issuer: TRUSTED_ISSUER,
      authenticatedAt: Date.now(),
    });
    await expect(
      platform.query(api.functions.academic.teacherSelectors.hasTeacherAssignments, { schoolId }),
    ).rejects.toThrow(/platform governance/i);
  });
});
