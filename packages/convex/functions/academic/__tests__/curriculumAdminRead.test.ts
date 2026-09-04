import { convexTest } from "convex-test";
import type { FunctionReference, RegisteredQuery } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import * as curriculumAdminRead from "../curriculumAdminRead";

declare global { interface ImportMeta { glob(pattern: string): Record<string, () => Promise<unknown>>; } }
const modules = import.meta.glob("../../../**/*.ts");
const listContext = curriculumAdminRead.listCurriculumImportContext as unknown as FunctionReference<"query", "public", Record<string, never>, unknown>;
const admin = { subject: "admin-auth", issuer: "https://legacy-auth.test" };

describe("curriculum admin read", () => {
  it("reads ready sources after indexed filtering and returns exact recent import labels", async () => {
    const t = convexTest(schema, modules);
    const expected = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Alpha", slug: "alpha", createdAt: 1, updatedAt: 1 });
      const userId = await ctx.db.insert("users", { schoolId, authId: "admin-auth", name: "Admin", email: "admin@test", role: "admin", createdAt: 1, updatedAt: 1 });
      const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Maths", code: "MAT", createdAt: 1, updatedAt: 1 });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Term 1", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
      const material = async (title: string, ready: boolean, createdAt: number, searchStatus: "not_indexed" | "indexed" = "indexed") => ctx.db.insert("knowledgeMaterials", { schoolId, ownerUserId: userId, ownerRole: "admin", sourceType: "imported_curriculum", visibility: "staff_shared", reviewStatus: ready ? "approved" : "pending_review", title, level: "JSS 1", topicLabel: "Scheme", searchStatus, searchText: title, processingStatus: ready ? "ready" : "queued", ingestionErrorMessage: null, ingestionAttemptCount: 0, labelSuggestions: [], chunkCount: 1, indexedAt: searchStatus === "indexed" ? createdAt : null, createdAt, updatedAt: createdAt, createdBy: userId, updatedBy: userId });
      for (let index = 0; index < 151; index += 1) await material(`Older ${index}`, false, index + 1);
      for (let index = 0; index < 61; index += 1) await material(`Unindexed ${index}`, true, index + 160, "not_indexed");
      const readyMaterialId = await material("Late ready source", true, 200);
      const archivedMaterialId = await material("Exact historical source", false, 201);
      const importRecord = async (materialId: typeof readyMaterialId, updatedAt: number) => ctx.db.insert("curriculumImports", { schoolId, materialId, subjectId, level: "JSS 1", termId, status: "ready_for_review", requestedBy: userId, promptVersion: "v1", schemaVersion: "v1", proposedUnitCount: 1, approvedUnitCount: 0, rejectedUnitCount: 0, duplicateWarningCount: 0, createdAt: updatedAt, updatedAt });
      const olderImportId = await importRecord(archivedMaterialId, 10);
      const newerImportId = await importRecord(readyMaterialId, 20);
      return { readyMaterialId, olderImportId, newerImportId };
    });
    const result = await t.withIdentity(admin).query(listContext, {}) as { sources: Array<{ _id: string; title: string }>; imports: Array<{ _id: string; sourceLabel: string }> };
    expect(result.sources).toContainEqual(expect.objectContaining({ _id: expected.readyMaterialId, title: "Late ready source" }));
    expect(result.imports.map((item) => item._id)).toEqual([expected.newerImportId, expected.olderImportId]);
    expect(result.imports.find((item) => item._id === expected.olderImportId)?.sourceLabel).toBe("Exact historical source");
  });
});
