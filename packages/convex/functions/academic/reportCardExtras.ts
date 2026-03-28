import { mutation, query } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
  teacherHasClassAccess,
} from "./auth";
import {
  buildExtrasCollectionView,
  normalizeBundleSections,
  normalizeScaleTemplateOptions,
  normalizeStoredExtraValues,
  reportCardExtraBundleFieldInputValidator,
  reportCardExtraBundleSectionInputValidator,
  reportCardExtraEditorBundleValidator,
  reportCardExtraScaleOptionInputValidator,
  reportCardExtraValueInputValidator,
} from "./reportCardExtrasModel";
import { getReadableUserName } from "./studentNameCompat";

const scaleTemplateValidator = v.object({
  _id: v.id("reportCardExtraScaleTemplates"),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  options: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      shortLabel: v.union(v.string(), v.null()),
      order: v.number(),
    })
  ),
});

const bundleValidator = v.object({
  _id: v.id("reportCardExtraBundles"),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  sections: v.array(
    v.object({
      id: v.string(),
      label: v.string(),
      order: v.number(),
      fields: v.array(
        v.object({
          id: v.string(),
          label: v.string(),
          type: v.union(
            v.literal("text"),
            v.literal("number"),
            v.literal("boolean"),
            v.literal("scale")
          ),
          scaleTemplateId: v.union(v.id("reportCardExtraScaleTemplates"), v.null()),
          printable: v.boolean(),
          order: v.number(),
        })
      ),
    })
  ),
});

const classBundleAssignmentValidator = v.object({
  classId: v.id("classes"),
  bundleAssignments: v.array(
    v.object({
      bundleId: v.id("reportCardExtraBundles"),
      bundleName: v.string(),
      order: v.number(),
    })
  ),
});

const bundleValueInputValidator = v.object({
  bundleId: v.id("reportCardExtraBundles"),
  values: v.array(reportCardExtraValueInputValidator),
});

async function getExtrasWorkspaceAccess(
  ctx: any,
  args: { userId: Id<"users">; schoolId: Id<"schools">; role: string; classId: Id<"classes"> }
) {
  if (args.role === "admin") {
    await assertAdminForSchool(ctx, args.userId, args.schoolId, args.role);
    return { canEdit: true };
  }
  if (args.role !== "teacher") {
    throw new ConvexError("Admin or form teacher access required");
  }

  const [viewer, classDoc, hasClassAccess] = await Promise.all([
    ctx.db.get(args.userId),
    ctx.db.get(args.classId),
    teacherHasClassAccess(ctx, args.userId, args.schoolId, args.classId),
  ]);

  if (!classDoc || classDoc.schoolId !== args.schoolId || classDoc.isArchived) {
    throw new ConvexError("Class not found");
  }
  if (!hasClassAccess) {
    throw new ConvexError("Not assigned to this class");
  }

  const formTeacher = classDoc.formTeacherId ? await ctx.db.get(classDoc.formTeacherId) : null;
  const isExactFormTeacher = String(classDoc.formTeacherId) === String(args.userId);
  const isLinkedFormTeacher =
    viewer?.email && formTeacher?.email && viewer.email.toLowerCase() === formTeacher.email.toLowerCase();

  return { canEdit: isExactFormTeacher || isLinkedFormTeacher };
}

async function assertExtrasEditorAccess(
  ctx: any,
  args: { userId: Id<"users">; schoolId: Id<"schools">; role: string; classId: Id<"classes"> }
) {
  const access = await getExtrasWorkspaceAccess(ctx, args);
  if (!access.canEdit) {
    throw new ConvexError("Form teacher access required");
  }
}

export const listReportCardExtraScaleTemplates = query({
  args: {},
  returns: v.array(scaleTemplateValidator),
  handler: async (ctx) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const templates = await ctx.db
      .query("reportCardExtraScaleTemplates")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();

    return templates
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((template) => ({
        _id: template._id,
        name: template.name,
        description: template.description ?? null,
        options: template.options.slice().sort((a, b) => a.order - b.order).map((option) => ({
          id: option.id,
          label: option.label,
          shortLabel: option.shortLabel ?? null,
          order: option.order,
        })),
      }));
  },
});

export const saveReportCardExtraScaleTemplate = mutation({
  args: {
    templateId: v.optional(v.union(v.id("reportCardExtraScaleTemplates"), v.null())),
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    options: v.array(reportCardExtraScaleOptionInputValidator),
  },
  returns: v.id("reportCardExtraScaleTemplates"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const name = args.name.trim();
    if (!name) throw new ConvexError("Scale template name is required");
    const description = args.description?.trim() || undefined;
    const options = normalizeScaleTemplateOptions(args.options);
    const now = Date.now();

    if (args.templateId) {
      const existing = await ctx.db.get(args.templateId);
      if (!existing || existing.schoolId !== schoolId) {
        throw new ConvexError("Scale template not found");
      }
      await ctx.db.replace(args.templateId, {
        schoolId,
        name,
        ...(description ? { description } : {}),
        options,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
        updatedAt: now,
        updatedBy: userId,
      });
      return args.templateId;
    }

    return await ctx.db.insert("reportCardExtraScaleTemplates", {
      schoolId,
      name,
      ...(description ? { description } : {}),
      options,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    });
  },
});

export const listReportCardExtraBundles = query({
  args: {},
  returns: v.array(bundleValidator),
  handler: async (ctx) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const bundles = await ctx.db
      .query("reportCardExtraBundles")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();

    return bundles
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((bundle) => ({
        _id: bundle._id,
        name: bundle.name,
        description: bundle.description ?? null,
        sections: bundle.sections.slice().sort((a, b) => a.order - b.order).map((section) => ({
          id: section.id,
          label: section.label,
          order: section.order,
          fields: section.fields.slice().sort((a, b) => a.order - b.order).map((field) => ({
            id: field.id,
            label: field.label,
            type: field.type,
            scaleTemplateId: field.scaleTemplateId ?? null,
            printable: field.printable,
            order: field.order,
          })),
        })),
      }));
  },
});

export const saveReportCardExtraBundle = mutation({
  args: {
    bundleId: v.optional(v.union(v.id("reportCardExtraBundles"), v.null())),
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    sections: v.array(reportCardExtraBundleSectionInputValidator),
  },
  returns: v.id("reportCardExtraBundles"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const name = args.name.trim();
    if (!name) throw new ConvexError("Bundle name is required");
    const description = args.description?.trim() || undefined;
    const sections = await normalizeBundleSections(ctx, schoolId, args.sections as any);
    const now = Date.now();

    if (args.bundleId) {
      const existing = await ctx.db.get(args.bundleId);
      if (!existing || existing.schoolId !== schoolId) {
        throw new ConvexError("Bundle not found");
      }
      await ctx.db.replace(args.bundleId, {
        schoolId,
        name,
        ...(description ? { description } : {}),
        sections,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
        updatedAt: now,
        updatedBy: userId,
      });
      return args.bundleId;
    }

    return await ctx.db.insert("reportCardExtraBundles", {
      schoolId,
      name,
      ...(description ? { description } : {}),
      sections,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    });
  },
});

export const setClassReportCardExtraBundles = mutation({
  args: {
    classId: v.id("classes"),
    bundleIds: v.array(v.id("reportCardExtraBundles")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Class not found");
    }

    const dedupedBundleIds = args.bundleIds.filter((bundleId, index, source) =>
      source.findIndex((candidate) => String(candidate) === String(bundleId)) === index
    );
    const bundles = await Promise.all(dedupedBundleIds.map((bundleId) => ctx.db.get(bundleId)));
    for (const bundle of bundles) {
      if (!bundle || bundle.schoolId !== schoolId) {
        throw new ConvexError("Bundle not found");
      }
    }

    const existingAssignments = await ctx.db
      .query("reportCardExtraClassAssignments")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();
    for (const assignment of existingAssignments) {
      await ctx.db.delete(assignment._id);
    }

    const now = Date.now();
    for (let index = 0; index < dedupedBundleIds.length; index += 1) {
      await ctx.db.insert("reportCardExtraClassAssignments", {
        schoolId,
        classId: args.classId,
        bundleId: dedupedBundleIds[index],
        order: index,
        createdAt: now,
        assignedBy: userId,
        updatedAt: now,
        updatedBy: userId,
      });
    }

    return null;
  },
});

export const getClassReportCardExtraBundles = query({
  args: { classId: v.id("classes") },
  returns: classBundleAssignmentValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Class not found");
    }

    const assignments = await ctx.db
      .query("reportCardExtraClassAssignments")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();
    const bundleAssignments = (
      await Promise.all(
        assignments.map(async (assignment) => {
          const bundle = await ctx.db.get(assignment.bundleId);
          if (!bundle || bundle.schoolId !== schoolId) return null;
          return {
            bundleId: bundle._id,
            bundleName: bundle.name,
            order: assignment.order,
          };
        })
      )
    )
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => a.order - b.order || a.bundleName.localeCompare(b.bundleName));

    return { classId: args.classId, bundleAssignments };
  },
});

export const getStudentReportCardExtrasEntry = query({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
  },
  returns: v.object({
    studentId: v.id("students"),
    studentName: v.string(),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    canEdit: v.boolean(),
    bundles: v.array(reportCardExtraEditorBundleValidator),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    const access = await getExtrasWorkspaceAccess(ctx, {
      userId,
      schoolId,
      role,
      classId: args.classId,
    });

    const [student, session, term] = await Promise.all([
      ctx.db.get(args.studentId),
      ctx.db.get(args.sessionId),
      ctx.db.get(args.termId),
    ]);
    if (!student || student.schoolId !== schoolId) throw new ConvexError("Student not found");
    if (student.classId !== args.classId) throw new ConvexError("Student is not enrolled in this class");
    if (!session || session.schoolId !== schoolId || session.isArchived) throw new ConvexError("Session not found");
    if (!term || term.schoolId !== schoolId || term.sessionId !== args.sessionId) throw new ConvexError("Term not found");

    const studentUser = await ctx.db.get(student.userId);
    const { bundles } = await buildExtrasCollectionView(ctx, {
      schoolId,
      classId: args.classId,
      studentId: args.studentId,
      sessionId: args.sessionId,
      termId: args.termId,
    });

    return {
      studentId: args.studentId,
      studentName: getReadableUserName(studentUser).displayName || "Unnamed Student",
      classId: args.classId,
      sessionId: args.sessionId,
      termId: args.termId,
      canEdit: access.canEdit,
      bundles,
    };
  },
});

export const saveStudentReportCardExtrasEntry = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    termId: v.id("academicTerms"),
    bundleValues: v.array(bundleValueInputValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertExtrasEditorAccess(ctx, { userId, schoolId, role, classId: args.classId });

    const [student, classDoc, session, term] = await Promise.all([
      ctx.db.get(args.studentId),
      ctx.db.get(args.classId),
      ctx.db.get(args.sessionId),
      ctx.db.get(args.termId),
    ]);
    if (!student || student.schoolId !== schoolId) throw new ConvexError("Student not found");
    if (student.classId !== args.classId) throw new ConvexError("Student is not enrolled in this class");
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) throw new ConvexError("Class not found");
    if (!session || session.schoolId !== schoolId || session.isArchived) throw new ConvexError("Session not found");
    if (!term || term.schoolId !== schoolId || term.sessionId !== args.sessionId) throw new ConvexError("Term not found");

    const assignments = await ctx.db
      .query("reportCardExtraClassAssignments")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();
    const assignedBundleIds = new Set(assignments.map((assignment) => String(assignment.bundleId)));
    const existingDocs = await ctx.db
      .query("reportCardExtraStudentValues")
      .withIndex("by_student_session_term", (q) =>
        q.eq("studentId", args.studentId).eq("sessionId", args.sessionId).eq("termId", args.termId)
      )
      .collect();

    const dedupedBundleValues = args.bundleValues.filter((entry, index, source) =>
      source.findIndex((candidate) => String(candidate.bundleId) === String(entry.bundleId)) === index
    );

    for (const entry of dedupedBundleValues) {
      if (!assignedBundleIds.has(String(entry.bundleId))) {
        throw new ConvexError("One of the submitted bundles is not assigned to this class");
      }
    }

    const now = Date.now();
    for (const bundleEntry of dedupedBundleValues) {
      const bundle = await ctx.db.get(bundleEntry.bundleId);
      if (!bundle || bundle.schoolId !== schoolId) {
        throw new ConvexError("Assigned extras bundle not found");
      }

      const templateIds = bundle.sections.flatMap((section) =>
        section.fields
          .map((field) => field.scaleTemplateId)
          .filter((templateId): templateId is Id<"reportCardExtraScaleTemplates"> => Boolean(templateId))
      );
      const templates = await Promise.all(templateIds.map((templateId) => ctx.db.get(templateId)));
      const templateMap = new Map(
        templates
          .filter((template): template is NonNullable<typeof template> => Boolean(template && template.schoolId === schoolId))
          .map((template) => [String(template._id), template] as const)
      );
      const values = normalizeStoredExtraValues(bundleEntry.values as any, bundle as any, templateMap as any);

      const existingDoc = existingDocs.find(
        (doc) => String(doc.classId) === String(args.classId) && String(doc.bundleId) === String(bundle._id)
      );
      if (existingDoc) {
        await ctx.db.replace(existingDoc._id, {
          schoolId,
          classId: args.classId,
          studentId: args.studentId,
          sessionId: args.sessionId,
          termId: args.termId,
          bundleId: bundle._id,
          values,
          createdAt: existingDoc.createdAt,
          updatedAt: now,
          updatedBy: userId,
        });
      } else {
        await ctx.db.insert("reportCardExtraStudentValues", {
          schoolId,
          classId: args.classId,
          studentId: args.studentId,
          sessionId: args.sessionId,
          termId: args.termId,
          bundleId: bundle._id,
          values,
          createdAt: now,
          updatedAt: now,
          updatedBy: userId,
        });
      }
    }

    const submittedBundleIds = new Set(dedupedBundleValues.map((entry) => String(entry.bundleId)));
    for (const existingDoc of existingDocs) {
      if (
        String(existingDoc.classId) === String(args.classId) &&
        assignedBundleIds.has(String(existingDoc.bundleId)) &&
        !submittedBundleIds.has(String(existingDoc.bundleId))
      ) {
        await ctx.db.delete(existingDoc._id);
      }
    }

    return null;
  },
});
