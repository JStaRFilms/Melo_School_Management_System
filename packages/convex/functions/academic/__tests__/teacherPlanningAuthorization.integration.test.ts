import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import type { PermissionCapability } from "../rbac";
import { seedReviewedTenantOperatorWithCapabilities } from "./securityFixtures";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);
const academic = api.functions.academic;

type TeacherKey = "none" | "planning" | "planningUpload" | "curriculum" | "curriculumUpload" | "unassigned";

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "Planning School",
      slug: "planning-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "JSS 1A",
      gradeName: "JSS 1",
      level: "secondary",
      createdAt: 1,
      updatedAt: 1,
    });
    const subjectId = await ctx.db.insert("subjects", {
      schoolId,
      name: "Mathematics",
      code: "MTH",
      createdAt: 1,
      updatedAt: 1,
    });
    const otherSubjectId = await ctx.db.insert("subjects", {
      schoolId,
      name: "History",
      code: "HIS",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("classSubjects", {
      schoolId,
      classId,
      subjectId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("classSubjects", {
      schoolId,
      classId,
      subjectId: otherSubjectId,
      createdAt: 1,
      updatedAt: 1,
    });
    const sessionId = await ctx.db.insert("academicSessions", {
      schoolId,
      name: "2026/2027",
      startDate: 1,
      endDate: 100,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const termId = await ctx.db.insert("academicTerms", {
      schoolId,
      sessionId,
      name: "First Term",
      startDate: 1,
      endDate: 50,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });

    const capabilitySets: Record<TeacherKey, readonly PermissionCapability[]> = {
      none: [],
      planning: ["academic.planning.use"],
      planningUpload: ["academic.planning.use", "assets.upload"],
      curriculum: ["academic.curriculum.manage"],
      curriculumUpload: ["academic.curriculum.manage", "assets.upload"],
      unassigned: ["academic.planning.use", "assets.upload"],
    };
    const userIds = {} as Record<TeacherKey, Id<"users">>;
    for (const [key, capabilities] of Object.entries(capabilitySets) as [TeacherKey, readonly PermissionCapability[]][]) {
      const token = `test|planning-${key}`;
      const operator = await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], token, capabilities, { role: "teacher" });
      userIds[key] = operator.memberships[0].userId;
      if (key !== "unassigned") {
        await ctx.db.insert("teacherAssignments", {
          schoolId,
          teacherId: userIds[key],
          classId,
          subjectId,
          createdAt: 1,
          updatedAt: 1,
        });
      }
    }
    return { schoolId, classId, subjectId, otherSubjectId, termId, userIds };
  });

  const teacher = (key: TeacherKey) => t.withIdentity({
    tokenIdentifier: `test|planning-${key}`,
    subject: `planning-${key}`,
  });
  return { t, teacher, ...ids };
}

const uploadArgs = (subjectId: Id<"subjects">) => ({
  title: "Assigned source",
  description: null,
  subjectId,
  level: "JSS 1",
  topicLabel: "Algebra",
  sourceType: "file_upload" as const,
  uploadIntent: "private_draft" as const,
});

describe("managed teacher planning capability contract", () => {
  it("allows only assignment-scoped planning data and grants no curriculum administration", async () => {
    const f = await fixture();
    await expect(f.teacher("none").query(academic.lessonKnowledgeTeacher.listTeacherLibrarySubjects, {})).rejects.toThrow("capability");
    await expect(f.teacher("none").mutation(academic.drafts.beginFormDraft, {
      schoolId: f.schoolId,
      formKey: "curriculum_plan",
      schemaVersion: 1,
    })).rejects.toThrow("capability");

    const planningViewer = await f.teacher("planning").query(api.functions.auth.getViewerContext, {
      capabilities: ["academic.planning.use", "academic.curriculum.manage"],
    });
    expect(planningViewer).toMatchObject({ role: "teacher", schoolId: f.schoolId });
    await expect(f.teacher("planning").mutation(academic.drafts.beginFormDraft, {
      schoolId: f.schoolId,
      formKey: "curriculum_plan",
      schemaVersion: 1,
    })).resolves.toMatchObject({ revision: 0 });
    expect(await f.teacher("planning").query(academic.lessonKnowledgeAssessmentProfiles.listAssessmentGenerationProfiles, {})).toEqual([]);

    const subjects = await f.teacher("planning").query(academic.lessonKnowledgeTeacher.listTeacherLibrarySubjects, {});
    expect(subjects).toEqual([{ id: f.subjectId, name: "Mathematics", code: "MTH" }]);
    await expect(f.teacher("planning").query(academic.curriculumReadiness.getAdminCurriculumReadiness, {
      subjectId: f.subjectId,
      termId: f.termId,
      level: "JSS 1",
    })).rejects.toThrow("capability");

    expect(await f.teacher("curriculum").query(academic.lessonKnowledgeTeacher.listTeacherLibrarySubjects, {})).toHaveLength(1);
    await expect(f.teacher("curriculum").query(academic.curriculumReadiness.getAdminCurriculumReadiness, {
      subjectId: f.subjectId,
      termId: f.termId,
      level: "JSS 1",
    })).rejects.toThrow("Admin access required");
  });

  it("keeps source upload capability independent while secure transport remains unavailable", async () => {
    const f = await fixture();
    await expect(f.teacher("planning").mutation(
      academic.lessonKnowledgeIngestion.requestKnowledgeMaterialUploadUrl,
      uploadArgs(f.subjectId),
    )).rejects.toThrow("capability");
    await expect(f.teacher("curriculum").mutation(
      academic.lessonKnowledgeIngestion.requestKnowledgeMaterialUploadUrl,
      uploadArgs(f.subjectId),
    )).rejects.toThrow("capability");

    for (const key of ["planningUpload", "curriculumUpload"] as const) {
      await expect(f.teacher(key).mutation(
        academic.lessonKnowledgeIngestion.requestKnowledgeMaterialUploadUrl,
        uploadArgs(f.subjectId),
      )).rejects.toThrow("Uploads unavailable");
    }
    await expect(f.teacher("unassigned").mutation(
      academic.lessonKnowledgeIngestion.requestKnowledgeMaterialUploadUrl,
      uploadArgs(f.subjectId),
    )).rejects.toThrow("assigned");
    await expect(f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestKnowledgeMaterialUploadUrl,
      uploadArgs(f.otherSubjectId),
    )).rejects.toThrow("assigned");
  });
});
