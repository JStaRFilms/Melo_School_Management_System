import { action, internalMutation, mutation, query } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
} from "./auth";

// ==================== TEACHER MANAGEMENT ====================

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const createTeacherRecordInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    email: v.string(),
    authId: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("email"), args.email))
      .unique();

    if (existingUser) {
      throw new ConvexError("A user with this email already exists");
    }

    const now = Date.now();
    const teacherId = await ctx.db.insert("users", {
      schoolId: args.schoolId,
      authId: args.authId,
      name: args.name,
      email: args.email,
      role: "teacher",
      createdAt: now,
      updatedAt: now,
    });

    return teacherId;
  },
});

export const createTeacher = action({
  args: {
    name: v.string(),
    email: v.string(),
    temporaryPassword: v.string(),
    origin: v.string(),
  },
  returns: v.object({
    teacherId: v.id("users"),
    email: v.string(),
    temporaryPassword: v.string(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    teacherId: Id<"users">;
    email: string;
    temporaryPassword: string;
  }> => {
    const { schoolId, userId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const authBaseUrl = process.env.CONVEX_SITE_URL?.trim();
    if (!authBaseUrl) {
      throw new ConvexError(
        "CONVEX_SITE_URL is not configured on the Convex deployment."
      );
    }

    const signUpResponse = await fetch(`${authBaseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: args.origin,
      },
      body: JSON.stringify({
        name: args.name,
        email: args.email,
        password: args.temporaryPassword,
      }),
    });

    const signUpPayload = await readJsonSafe(signUpResponse);
    if (!signUpResponse.ok || !signUpPayload?.user?.id) {
      throw new ConvexError(
        signUpPayload?.message ?? "Failed to provision teacher account"
      );
    }

    const teacherId: Id<"users"> = await ctx.runMutation(
      (internal as any).functions.academic.academicSetup.createTeacherRecordInternal,
      {
        schoolId,
        name: args.name,
        email: args.email,
        authId: signUpPayload.user.id,
      }
    );

    return {
      teacherId,
      email: args.email,
      temporaryPassword: args.temporaryPassword,
    };
  },
});

export const listTeachers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const teachers = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .filter((q) => q.eq(q.field("role"), "teacher"))
      .collect();

    return teachers
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({
        _id: t._id,
        name: t.name,
        email: t.email,
        createdAt: t.createdAt,
      }));
  },
});

// ==================== SESSION MANAGEMENT ====================

export const createSession = mutation({
  args: {
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
  },
  returns: v.id("academicSessions"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    if (args.endDate <= args.startDate) {
      throw new ConvexError("End date must be after start date");
    }

    // If setting as active, deactivate other sessions
    if (args.isActive) {
      const activeSessions = await ctx.db
        .query("academicSessions")
        .withIndex("by_school_active", (q) =>
          q.eq("schoolId", schoolId).eq("isActive", true)
        )
        .collect();

      for (const session of activeSessions) {
        await ctx.db.patch(session._id, {
          isActive: false,
          updatedAt: Date.now(),
        });
      }
    }

    const now = Date.now();
    return await ctx.db.insert("academicSessions", {
      schoolId,
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: args.isActive,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listSessions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("academicSessions"),
      name: v.string(),
      startDate: v.number(),
      endDate: v.number(),
      isActive: v.boolean(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const sessions = await ctx.db
      .query("academicSessions")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();

    return sessions
      .sort((a, b) => b.startDate - a.startDate)
      .map((s) => ({
        _id: s._id,
        name: s.name,
        startDate: s.startDate,
        endDate: s.endDate,
        isActive: s.isActive,
        createdAt: s.createdAt,
      }));
  },
});

export const updateSession = mutation({
  args: {
    sessionId: v.id("academicSessions"),
    name: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    updates.updatedAt = Date.now();

    // If activating, deactivate others
    if (args.isActive === true) {
      const activeSessions = await ctx.db
        .query("academicSessions")
        .withIndex("by_school_active", (q) =>
          q.eq("schoolId", schoolId).eq("isActive", true)
        )
        .collect();

      for (const s of activeSessions) {
        if (s._id !== args.sessionId) {
          await ctx.db.patch(s._id, { isActive: false, updatedAt: Date.now() });
        }
      }
    }

    await ctx.db.patch(args.sessionId, updates);
    return null;
  },
});

// ==================== TERM MANAGEMENT ====================

export const createTerm = mutation({
  args: {
    sessionId: v.id("academicSessions"),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
  },
  returns: v.id("academicTerms"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    if (args.endDate <= args.startDate) {
      throw new ConvexError("End date must be after start date");
    }

    // If setting as active, deactivate other terms in same school
    if (args.isActive) {
      const activeTerms = await ctx.db
        .query("academicTerms")
        .withIndex("by_school_active", (q) =>
          q.eq("schoolId", schoolId).eq("isActive", true)
        )
        .collect();

      for (const term of activeTerms) {
        await ctx.db.patch(term._id, {
          isActive: false,
          updatedAt: Date.now(),
        });
      }
    }

    const now = Date.now();
    return await ctx.db.insert("academicTerms", {
      schoolId,
      sessionId: args.sessionId,
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: args.isActive,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listTermsBySession = query({
  args: { sessionId: v.id("academicSessions") },
  returns: v.array(
    v.object({
      _id: v.id("academicTerms"),
      name: v.string(),
      startDate: v.number(),
      endDate: v.number(),
      isActive: v.boolean(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const terms = await ctx.db
      .query("academicTerms")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return terms
      .sort((a, b) => a.startDate - b.startDate)
      .map((t) => ({
        _id: t._id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        isActive: t.isActive,
        createdAt: t.createdAt,
      }));
  },
});

// ==================== SUBJECT CATALOG ====================

export const createSubject = mutation({
  args: {
    name: v.string(),
    code: v.string(),
  },
  returns: v.id("subjects"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    // Check for duplicate code within school
    const existing = await ctx.db
      .query("subjects")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .filter((q) => q.eq(q.field("code"), args.code))
      .unique();

    if (existing) {
      throw new ConvexError("A subject with this code already exists");
    }

    const now = Date.now();
    return await ctx.db.insert("subjects", {
      schoolId,
      name: args.name,
      code: args.code,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listSubjects = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("subjects"),
      name: v.string(),
      code: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const subjects = await ctx.db
      .query("subjects")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();

    return subjects
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        _id: s._id,
        name: s.name,
        code: s.code,
        createdAt: s.createdAt,
      }));
  },
});

export const updateSubject = mutation({
  args: {
    subjectId: v.id("subjects"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const subject = await ctx.db.get(args.subjectId);
    if (!subject || subject.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    // Check for duplicate code if changing
    if (args.code && args.code !== subject.code) {
      const existing = await ctx.db
        .query("subjects")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .filter((q) => q.eq(q.field("code"), args.code))
        .unique();

      if (existing) {
        throw new ConvexError("A subject with this code already exists");
      }
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.code !== undefined) updates.code = args.code;
    updates.updatedAt = Date.now();

    await ctx.db.patch(args.subjectId, updates);
    return null;
  },
});

export const deleteSubject = mutation({
  args: { subjectId: v.id("subjects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const subject = await ctx.db.get(args.subjectId);
    if (!subject || subject.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    // Check for existing class-subject offerings
    const offerings = await ctx.db
      .query("classSubjects")
      .withIndex("by_subject", (q) => q.eq("subjectId", args.subjectId))
      .first();

    if (offerings) {
      throw new ConvexError(
        "Cannot delete subject with existing class offerings"
      );
    }

    await ctx.db.delete(args.subjectId);
    return null;
  },
});

// ==================== CLASS MANAGEMENT ====================

export const createClass = mutation({
  args: {
    name: v.string(),
    level: v.string(),
    formTeacherId: v.optional(v.union(v.id("users"), v.null())),
  },
  returns: v.id("classes"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    if (args.formTeacherId) {
      const teacher = await ctx.db.get(args.formTeacherId);
      if (!teacher || teacher.schoolId !== schoolId || teacher.role !== "teacher") {
        throw new ConvexError("Invalid form teacher");
      }
    }

    const now = Date.now();
    return await ctx.db.insert("classes", {
      schoolId,
      name: args.name,
      level: args.level,
      ...(args.formTeacherId ? { formTeacherId: args.formTeacherId } : {}),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listClasses = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("classes"),
      name: v.string(),
      level: v.string(),
      formTeacherId: v.optional(v.id("users")),
      formTeacherName: v.optional(v.string()),
      subjectNames: v.array(v.string()),
      studentCount: v.number(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classes = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();

    const results = await Promise.all(
      classes
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (classDoc) => {
          const [teacher, offerings, students] = await Promise.all([
            classDoc.formTeacherId ? ctx.db.get(classDoc.formTeacherId) : null,
            ctx.db
              .query("classSubjects")
              .withIndex("by_class", (q) => q.eq("classId", classDoc._id))
              .collect(),
            ctx.db
              .query("students")
              .withIndex("by_school_and_class", (q) =>
                q.eq("schoolId", schoolId).eq("classId", classDoc._id)
              )
              .collect(),
          ]);

          const subjectNames = (
            await Promise.all(
              offerings.map(async (offering) => {
                const subject = await ctx.db.get(offering.subjectId);
                return subject?.name ?? null;
              })
            )
          ).filter((name): name is string => Boolean(name));

          return {
            _id: classDoc._id,
            name: classDoc.name,
            level: classDoc.level,
            formTeacherId: classDoc.formTeacherId,
            formTeacherName: teacher?.name,
            subjectNames,
            studentCount: students.length,
            createdAt: classDoc.createdAt,
          };
        })
    );

    return results;
  },
});

export const updateClass = mutation({
  args: {
    classId: v.id("classes"),
    name: v.optional(v.string()),
    level: v.optional(v.string()),
    formTeacherId: v.optional(v.union(v.id("users"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    if (args.formTeacherId) {
      const teacher = await ctx.db.get(args.formTeacherId);
      if (!teacher || teacher.schoolId !== schoolId || teacher.role !== "teacher") {
        throw new ConvexError("Invalid form teacher");
      }
    }

    const updatedAt = Date.now();
    const nextName = args.name ?? classDoc.name;
    const nextLevel = args.level ?? classDoc.level;

    if (args.formTeacherId === null) {
      const replacement = {
        schoolId: classDoc.schoolId,
        name: nextName,
        level: nextLevel,
        createdAt: classDoc.createdAt,
        updatedAt,
      };
      await ctx.db.replace(args.classId, replacement);
      return null;
    }

    const updates: Record<string, unknown> = {
      name: nextName,
      level: nextLevel,
      updatedAt,
    };

    if (args.formTeacherId !== undefined) {
      updates.formTeacherId = args.formTeacherId;
    }

    await ctx.db.patch(args.classId, updates);
    return null;
  },
});

// ==================== CLASS SUBJECT OFFERINGS ====================

export const setClassSubjects = mutation({
  args: {
    classId: v.id("classes"),
    subjectIds: v.array(v.id("subjects")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    // Verify all subjects belong to this school
    for (const subjectId of args.subjectIds) {
      const subject = await ctx.db.get(subjectId);
      if (!subject || subject.schoolId !== schoolId) {
        throw new ConvexError("Cross-school access denied for subject");
      }
    }

    // Reset offerings and subject-teacher assignments for the class, then rebuild
    const existingOfferings = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    for (const offering of existingOfferings) {
      await ctx.db.delete(offering._id);
    }

    const existingAssignments = await ctx.db
      .query("teacherAssignments")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    for (const assignment of existingAssignments) {
      await ctx.db.delete(assignment._id);
    }

    // Insert new offerings
    const now = Date.now();
    for (const subjectId of args.subjectIds) {
      await ctx.db.insert("classSubjects", {
        schoolId,
        classId: args.classId,
        subjectId,
        createdAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

export const getClassSubjects = query({
  args: { classId: v.id("classes") },
  returns: v.array(
    v.object({
      _id: v.id("classSubjects"),
      subjectId: v.id("subjects"),
      subjectName: v.string(),
      subjectCode: v.string(),
      teacherId: v.optional(v.id("users")),
      teacherName: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const offerings = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const results = [];
    for (const offering of offerings) {
      const subject = await ctx.db.get(offering.subjectId);
      if (!subject) continue;

      let teacherName: string | undefined;
      if (offering.teacherId) {
        const teacher = await ctx.db.get(offering.teacherId);
        teacherName = teacher?.name;
      }

      results.push({
        _id: offering._id,
        subjectId: offering.subjectId,
        subjectName: subject.name,
        subjectCode: subject.code,
        teacherId: offering.teacherId,
        teacherName,
      });
    }

    return results.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  },
});

export const assignTeacherToClassSubject = mutation({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const subject = await ctx.db.get(args.subjectId);
    if (!subject || subject.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const teacher = await ctx.db.get(args.teacherId);
    if (!teacher || teacher.schoolId !== schoolId || teacher.role !== "teacher") {
      throw new ConvexError("Invalid teacher");
    }

    // Find the class-subject offering
    const offering = await ctx.db
      .query("classSubjects")
      .withIndex("by_class_and_subject", (q) =>
        q.eq("classId", args.classId).eq("subjectId", args.subjectId)
      )
      .unique();

    if (!offering) {
      throw new ConvexError("Class-subject offering not found");
    }

    await ctx.db.patch(offering._id, {
      teacherId: args.teacherId,
      updatedAt: Date.now(),
    });

    // Also create/update teacher assignment record
    const existingAssignments = await ctx.db
      .query("teacherAssignments")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    for (const assignment of existingAssignments) {
      if (assignment.subjectId === args.subjectId) {
        await ctx.db.delete(assignment._id);
      }
    }

    const now = Date.now();
    await ctx.db.insert("teacherAssignments", {
      schoolId,
      teacherId: args.teacherId,
      classId: args.classId,
      subjectId: args.subjectId,
      createdAt: now,
      updatedAt: now,
    });

    return null;
  },
});
