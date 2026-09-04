import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import * as migrationWorkspace from "../migrationWorkspace";
import * as lessonKnowledgePortal from "../lessonKnowledgePortal";

declare global {
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("../../../**/*.ts");

type MutationRef = FunctionReference<"mutation", "public", any, any>;
type QueryRef = FunctionReference<"query", "public", any, any>;

const createWorkspace = migrationWorkspace.createWorkspace as unknown as MutationRef;
const getPortalTopicIndexData = lessonKnowledgePortal.getPortalTopicIndexData as unknown as QueryRef;

describe("token-first trusted legacy identity endpoints", () => {
  it("denies untrusted legacy issuers at migration and portal endpoints", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const now = Date.now();
      const schoolId = await ctx.db.insert("schools", {
        name: "Identity Academy",
        slug: "identity-academy",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("users", {
        schoolId,
        authId: "legacy-student",
        name: "Legacy Student",
        email: "student@identity.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      return schoolId;
    });

    const attacker = t.withIdentity({
      subject: "legacy-student",
      issuer: "https://untrusted-auth.test",
    });

    await expect(
      attacker.mutation(createWorkspace, {
        schoolId,
        name: "Denied migration",
        mode: "school_admin",
      })
    ).rejects.toThrow("untrusted legacy identity issuer");
    await expect(attacker.query(getPortalTopicIndexData, {})).rejects.toThrow(
      "untrusted legacy identity issuer"
    );
  });

  it("fails closed on duplicate canonical rows and mismatched subject prelinks", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const now = Date.now();
      const schoolId = await ctx.db.insert("schools", {
        name: "Ambiguity Academy",
        slug: "ambiguity-academy",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      for (const suffix of ["one", "two"]) {
        await ctx.db.insert("users", {
          schoolId,
          authId: `duplicate-${suffix}`,
          authTokenIdentifier: "https://auth.test|duplicate",
          name: `Duplicate ${suffix}`,
          email: `duplicate-${suffix}@identity.test`,
          role: "admin",
          isSchoolAdmin: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      await ctx.db.insert("users", {
        schoolId,
        authId: "mismatched-subject",
        authTokenIdentifier: "https://auth.test|other-token",
        name: "Mismatched Admin",
        email: "mismatched@identity.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });
      return schoolId;
    });

    const duplicate = t.withIdentity({
      tokenIdentifier: "https://auth.test|duplicate",
      subject: "duplicate-one",
      issuer: "https://legacy-auth.test",
    });
    await expect(duplicate.query(getPortalTopicIndexData, {})).rejects.toThrow("ambiguous canonical identity");

    const mismatch = t.withIdentity({
      tokenIdentifier: "https://auth.test|unknown-token",
      subject: "mismatched-subject",
      issuer: "https://legacy-auth.test",
    });
    await expect(mismatch.mutation(createWorkspace, {
      schoolId,
      name: "Mismatched prelink",
      mode: "school_admin",
    })).rejects.toThrow("mismatched canonical identity link");
  });
});
