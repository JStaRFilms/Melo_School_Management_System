"use node";

import { action } from "../../_generated/server";
import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { TENANT_SCHOOL_TABLES, type TenantSchoolTable } from "./tenantPurgeManifest";
import { TENANT_STORAGE_TABLES } from "./tenantPurgeAction";
import coverage from "../../schemaCoverageRegistry.json";
import schema from "../../schema";
import { schemaReferenceInventory } from "../../schemaCoverage";
import { DEMO_ACCOUNTS, DEMO_SCHOOL_SLUG } from "./demoData";
import { createAuth, getTrustedOrigins } from "../../betterAuth";
import { inspectEmptyDeployment } from "./demoEmptyDeployment";

const linksRef = makeFunctionReference<"query", {}, {
  school: null | { id: Id<"schools">; name: string };
  blockers: string[];
}>("functions/academic/demoPreflight:inspectDemoLinksInternal");
const ownershipRef = makeFunctionReference<"query", { schoolId: Id<"schools"> }, {
  counts: Array<{ name: string; count: number; truncated: boolean }>;
  authIds: string[];
  blockers: string[];
}>("functions/academic/demoPreflight:inspectDemoOwnershipInternal");
const tableRef = makeFunctionReference<"query", {
  schoolId: Id<"schools">; schoolSlug: string; tableName: TenantSchoolTable;
}, { count: number; truncated: boolean }>("functions/academic/tenantPurge:inspectTenantTableInternal");
const tenantStorageRef = makeFunctionReference<"query", {
  schoolId: Id<"schools">; schoolSlug: string; tableName: TenantSchoolTable;
}, Array<Id<"_storage">>>("functions/academic/tenantPurge:collectTenantStorageInternal");
const retainedStorageRef = makeFunctionReference<"query", {
  deletedSchoolId: Id<"schools">; candidateStorageIds: Array<Id<"_storage">>; tableName: TenantSchoolTable;
}, Array<Id<"_storage">>>("functions/academic/tenantPurge:collectRetainedStorageInternal");
const retainedLogosRef = makeFunctionReference<"query", {
  deletedSchoolId: Id<"schools">; candidateStorageIds: Array<Id<"_storage">>;
}, Array<Id<"_storage">>>("functions/academic/tenantPurge:collectRetainedSchoolLogosInternal");

// Keep this exact-path list in step with storageIdsOnRow in seed.ts. The
// registry test catches new schema paths; this guard rejects a mislabelled
// legacy-extractor path before claiming its file inventory is complete.
const extractedPaths = new Set([
  "storageId", "photoStorageId", "logoStorageId", "schoolLogoStorageId",
  "studentPhotoStorageId", "rollbackStorageId", "candidateStorageId", "portraitStorageIds[]",
]);

const logoRef = makeFunctionReference<"query", { schoolId: Id<"schools"> }, Id<"_storage"> | null>(
  "functions/academic/demoPreflight:inspectDemoLogoInternal",
);

// Inspection only. The deployment URL is read on the server, not trusted from caller input.
const preflightArgs = { operatorToken: v.string(), targetIdentity: v.string() };
const preflightReturns = v.object({
    cloudUrl: v.string(),
    e2eOriginsTrusted: v.boolean(),
    school: v.union(v.null(), v.object({ id: v.id("schools"), name: v.string() })),
    tables: v.array(v.object({ name: v.string(), count: v.number(), truncated: v.boolean() })),
    blockers: v.array(v.string()),
    ready: v.boolean(),
  });

export async function inspectDemoSchoolForOperator(ctx: ActionCtx, args: { operatorToken: string; targetIdentity: string }) {
    const token = process.env.DEMO_SEED_OPERATOR_TOKEN?.trim();
    const identity = process.env.DEMO_SEED_DEPLOYMENT_IDENTITY?.trim();
    if (!token || !identity || process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" ||
        args.operatorToken !== token || args.targetIdentity !== identity) {
      throw new ConvexError("Development demo preflight operator gate failed");
    }
    const cloudUrl = process.env.CONVEX_CLOUD_URL;
    if (!cloudUrl) throw new ConvexError("Server CONVEX_CLOUD_URL is unavailable");
    const origins = getTrustedOrigins();
    const e2eOriginsTrusted = [3101, 3102, 3103].every((port) => origins.includes(`http://localhost:${port}`));
    const { school, blockers } = await ctx.runQuery(linksRef, {});
    if (!school) {
      try {
        blockers.push(...await inspectEmptyDeployment(ctx));
      } catch {
        blockers.push("Application schema: empty-deployment registry inspection failed");
      }
      // Better Auth lives outside the app schema. A failed seed can create its
      // credentials before the first school mutation commits.
      try {
        const auth = await createAuth(ctx).$context;
        for (const [index, account] of Object.values(DEMO_ACCOUNTS).entries()) {
          if (await auth.internalAdapter.findUserByEmail(account.email, { includeAccounts: true })) {
            blockers.push(`Better Auth: demo credential ${index + 1} already exists`);
          }
        }
      } catch {
        blockers.push("Better Auth: credential inspection failed");
      }
      return { cloudUrl, e2eOriginsTrusted, school: null, tables: [], blockers, ready: blockers.length === 0 };
    }
    const tables: Array<{ name: string; count: number; truncated: boolean }> = [];
    for (const tableName of TENANT_SCHOOL_TABLES) {
      const { count, truncated } = await ctx.runQuery(tableRef, {
        schoolId: school.id, schoolSlug: DEMO_SCHOOL_SLUG, tableName,
      });
      tables.push({ name: tableName, count, truncated });
      if (truncated) blockers.push(`${tableName}: count exceeds 1000`);
    }
    const ownership = await ctx.runQuery(ownershipRef, { schoolId: school.id });
    tables.push(...ownership.counts);
    blockers.push(...ownership.blockers);
    // The extractor is field-name based. Verify every declared storage path is
    // supported before using its bounded per-table inventory, including empty tables.
    const storageTables = new Set<string>(TENANT_STORAGE_TABLES);
    const actual = schemaReferenceInventory(schema);
    for (const [name, row] of Object.entries(actual)) {
      // Ledger candidates are a reviewed inventory, not file ownership.
      const paths = row.references.filter((ref) => ref.target === "_storage").map((ref) => ref.path);
      const declared = coverage[name as keyof typeof coverage]?.storage;
      if (!declared) {
        blockers.push(`storage: missing registry entry for ${name}`);
        continue;
      }
      for (const path of paths) if (!(path in declared)) blockers.push(`storage: unclassified ${name}.${path}`);
      for (const path of Object.keys(declared)) if (!paths.includes(path)) blockers.push(`storage: obsolete ${name}.${path}`);
    }
    for (const [name, entry] of Object.entries(coverage)) {
      for (const [path, disposition] of Object.entries(entry.storage)) {
        if (disposition === "inventory-not-owner" && name === "demoResetOperations" &&
            ["storageCandidateIds[]", "storageAcknowledgedIds[]", "retainedStorageIds[]"].includes(path)) continue;
        if (disposition === "unsupported-block-reset" ||
            disposition === "legacy-extractor" && (!storageTables.has(name) || !extractedPaths.has(path)) ||
            disposition === "school-logo" && (name !== "schools" || path !== "logoStorageId") ||
            !["legacy-extractor", "school-logo", "unsupported-block-reset"].includes(disposition)) {
          // Unsupported paths with no target rows cannot claim a target file.
          if (name === "schools" || tables.find((table) => table.name === name)?.count ||
              !tables.some((table) => table.name === name)) {
            blockers.push(`storage: unsupported or missing inventory for ${name}.${path}`);
          }
        }
      }
    }
    const candidateIds = new Set<Id<"_storage">>();
    // Fetch the logo from a server-side query, not a caller-provided value.
    const logo = await ctx.runQuery(logoRef, { schoolId: school.id });
    if (logo) candidateIds.add(logo);
    for (const tableName of TENANT_STORAGE_TABLES) {
      try {
        const ids = await ctx.runQuery(tenantStorageRef, { schoolId: school.id, schoolSlug: DEMO_SCHOOL_SLUG, tableName });
        for (const id of ids) candidateIds.add(id);
      } catch {
        blockers.push(`storage: ${tableName} candidate inventory failed or exceeded 1000`);
      }
    }
    if (candidateIds.size > 50) blockers.push("storage: candidate inventory exceeds 50");
    if (candidateIds.size && candidateIds.size <= 50) {
      const candidateStorageIds = [...candidateIds];
      for (const tableName of TENANT_STORAGE_TABLES) {
        try {
          if ((await ctx.runQuery(retainedStorageRef, {
            deletedSchoolId: school.id, candidateStorageIds, tableName,
          })).length) blockers.push(`storage: ${tableName} has retained/shared claims`);
        } catch {
          blockers.push(`storage: ${tableName} retained inventory failed or exceeded 1000`);
        }
      }
      try {
        if ((await ctx.runQuery(retainedLogosRef, { deletedSchoolId: school.id, candidateStorageIds })).length) {
          blockers.push("storage: retained school logo claim");
        }
      } catch {
        blockers.push("storage: retained school logo inspection failed");
      }
    }
    // Better Auth is a separate component; app-schema inspection cannot prove
    // that the recorded IDs own exactly the expected credential accounts.
    if (ownership.authIds.length === 3) {
      try {
        const auth = await createAuth(ctx).$context;
        for (const [index, account] of Object.values(DEMO_ACCOUNTS).entries()) {
          const existing = await auth.internalAdapter.findUserByEmail(account.email, { includeAccounts: true });
          if (!existing || existing.user.id !== ownership.authIds[index] ||
              existing.accounts?.length !== 1 ||
              existing.accounts[0].providerId !== "credential" ||
              existing.accounts[0].accountId !== ownership.authIds[index]) {
            blockers.push(`Better Auth: demo credential ${index + 1} is missing or ambiguous`);
          }
        }
      } catch {
        blockers.push("Better Auth: credential ownership inspection failed");
      }
    }
    return { cloudUrl, e2eOriginsTrusted, school, tables, blockers, ready: blockers.length === 0 };
}

export const inspectDemoSchool = action({
  args: preflightArgs,
  returns: preflightReturns,
  handler: inspectDemoSchoolForOperator,
});
