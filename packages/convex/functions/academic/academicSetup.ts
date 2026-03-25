import { action, internalMutation, internalQuery, mutation, query } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { authComponent, createAuth } from "../../betterAuth";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
} from "./auth";
import {
  formatClassDisplayName,
  normalizeClassGradeName,
  normalizeClassLabel,
  normalizeHumanName,
  normalizePersonName,
} from "@school/shared";

// ==================== TEACHER MANAGEMENT ====================

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeTeacherEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildClassName(args: {
  gradeName?: string | null;
  classLabel?: string | null;
  legacyName?: string | null;
}) {
  return formatClassDisplayName({
    gradeName: args.gradeName,
    classLabel: args.classLabel,
    name: args.legacyName,
  });
}

function getStoredGradeName(classDoc: {
  gradeName?: string | null;
  name: string;
}) {
  return normalizeClassGradeName(classDoc.gradeName ?? classDoc.name);
}

function getStoredClassLabel(classDoc: {
  classLabel?: string | null;
}) {
  return classDoc.classLabel ? normalizeClassLabel(classDoc.classLabel) : undefined;
}

async function ensureActingAdminAuthRole(ctx: any, schoolId: Id<"schools">) {
  const { auth, headers } = await authComponent.getAuth(createAuth, ctx);

  await auth.api.updateUser({
    headers,
    body: {
      role: "admin",
      schoolId: String(schoolId),
    },
  });

  return { auth, headers };
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
    const normalizedEmail = normalizeTeacherEmail(args.email);
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("email"), normalizedEmail))
      .unique();

    if (existingUser) {
      throw new ConvexError("A user with this email already exists");
    }

    const now = Date.now();
    const teacherId = await ctx.db.insert("users", {
      schoolId: args.schoolId,
      authId: args.authId,
      name: normalizePersonName(args.name),
      email: normalizedEmail,
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
    const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {});
    if (!viewer) {
      throw new ConvexError("Unauthorized");
    }
    if (viewer.role !== "admin") {
      throw new ConvexError("Admin access required");
    }

    const schoolId = viewer.schoolId;
    const normalizedEmail = normalizeTeacherEmail(args.email);

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
        name: normalizePersonName(args.name),
        email: normalizedEmail,
        password: args.temporaryPassword,
        role: "teacher",
        schoolId: String(schoolId),
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
        name: normalizeHumanName(args.name),
        email: normalizedEmail,
        authId: signUpPayload.user.id,
      }
    );

    return {
      teacherId,
      email: normalizedEmail,
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
        name: normalizePersonName(t.name),
        email: t.email,
        createdAt: t.createdAt,
      }));
  },
});

export const getTeacherRecordInternal = internalQuery({
  args: {
    teacherId: v.id("users"),
    schoolId: v.id("schools"),
  },
  returns: v.object({
    _id: v.id("users"),
    authId: v.string(),
    email: v.string(),
    name: v.string(),
  }),
  handler: async (ctx, args) => {
    const teacher = await ctx.db.get(args.teacherId);
    if (!teacher || teacher.schoolId !== args.schoolId || teacher.role !== "teacher") {
      throw new ConvexError("Teacher not found");
    }

    return {
      _id: teacher._id,
      authId: teacher.authId,
      email: teacher.email,
      name: teacher.name,
    };
  },
});

export const findTeacherByEmailInternal = internalQuery({
  args: {
    schoolId: v.id("schools"),
    email: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeTeacherEmail(args.email);
    const teacher = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) =>
        q.and(
          q.eq(q.field("role"), "teacher"),
          q.eq(q.field("email"), normalizedEmail)
        )
      )
      .unique();

    if (!teacher) {
      return null;
    }

    return {
      _id: teacher._id,
      email: teacher.email,
    };
  },
});

export const updateTeacherRecordInternal = internalMutation({
  args: {
    teacherId: v.id("users"),
    schoolId: v.id("schools"),
    name: v.string(),
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teacher = await ctx.db.get(args.teacherId);
    if (!teacher || teacher.schoolId !== args.schoolId || teacher.role !== "teacher") {
      throw new ConvexError("Teacher not found");
    }

    await ctx.db.patch(args.teacherId, {
      name: normalizeHumanName(args.name),
      email: normalizeTeacherEmail(args.email),
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const updateTeacherProfile = action({
  args: {
    teacherId: v.id("users"),
    name: v.string(),
    email: v.string(),
  },
  returns: v.object({
    teacherId: v.id("users"),
    name: v.string(),
    email: v.string(),
  }),
  handler: async (ctx, args) => {
    const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {});
    if (!viewer) {
      throw new ConvexError("Unauthorized");
    }
    if (viewer.role !== "admin") {
      throw new ConvexError("Admin access required");
    }

    const teacher = await ctx.runQuery(
      (internal as any).functions.academic.academicSetup.getTeacherRecordInternal,
      {
        teacherId: args.teacherId,
        schoolId: viewer.schoolId,
      }
    );

    const normalizedName = normalizeHumanName(args.name);
    const normalizedEmail = normalizeTeacherEmail(args.email);

    const duplicateTeacher = await ctx.runQuery(
      (internal as any).functions.academic.academicSetup.findTeacherByEmailInternal,
      {
        schoolId: viewer.schoolId,
        email: normalizedEmail,
      }
    );

    if (duplicateTeacher && duplicateTeacher._id !== args.teacherId) {
      throw new ConvexError("A teacher with this email already exists");
    }

    const { auth, headers } = await ensureActingAdminAuthRole(ctx, viewer.schoolId);

    await auth.api.adminUpdateUser({
      headers,
      body: {
        userId: teacher.authId,
        data: {
          name: normalizedName,
          email: normalizedEmail,
          role: "teacher",
          schoolId: String(viewer.schoolId),
        },
      },
    });

    await ctx.runMutation(
      (internal as any).functions.academic.academicSetup.updateTeacherRecordInternal,
      {
        teacherId: args.teacherId,
        schoolId: viewer.schoolId,
        name: normalizedName,
        email: normalizedEmail,
      }
    );

    return {
      teacherId: args.teacherId,
      name: normalizedName,
      email: normalizedEmail,
    };
  },
});

export const resetTeacherPassword = action({
  args: {
    teacherId: v.id("users"),
    temporaryPassword: v.string(),
  },
  returns: v.object({
    teacherId: v.id("users"),
    temporaryPassword: v.string(),
  }),
  handler: async (ctx, args) => {
    const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {});
    if (!viewer) {
      throw new ConvexError("Unauthorized");
    }
    if (viewer.role !== "admin") {
      throw new ConvexError("Admin access required");
    }

    const teacher = await ctx.runQuery(
      (internal as any).functions.academic.academicSetup.getTeacherRecordInternal,
      {
        teacherId: args.teacherId,
        schoolId: viewer.schoolId,
      }
    );

    const { auth, headers } = await ensureActingAdminAuthRole(ctx, viewer.schoolId);

    await auth.api.setUserPassword({
      headers,
      body: {
        userId: teacher.authId,
        newPassword: args.temporaryPassword,
      },
    });

    await auth.api.revokeUserSessions({
      headers,
      body: {
        userId: teacher.authId,
      },
    });

    return {
      teacherId: args.teacherId,
      temporaryPassword: args.temporaryPassword,
    };
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
      name: normalizeHumanName(args.name),
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
        name: normalizeHumanName(s.name),
        startDate: s.startDate,
        endDate: s.endDate,
        isActive: s.isActive,
        createdAt: s.createdAt,
      }));
  },
});

export const getSessionActivationWarnings = query({
  args: {},
  returns: v.object({
    activeSessionId: v.union(v.id("academicSessions"), v.null()),
    activeSessionName: v.union(v.string(), v.null()),
    hasStudentSubjectSelections: v.boolean(),
    hasAssessmentRecords: v.boolean(),
    warningMessage: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const activeSession = await ctx.db
      .query("academicSessions")
      .withIndex("by_school_active", (q) =>
        q.eq("schoolId", schoolId).eq("isActive", true)
      )
      .unique();

    if (!activeSession) {
      return {
        activeSessionId: null,
        activeSessionName: null,
        hasStudentSubjectSelections: false,
        hasAssessmentRecords: false,
        warningMessage: null,
      };
    }

    const [selectionRecord, assessmentRecord] = await Promise.all([
      ctx.db
        .query("studentSubjectSelections")
        .withIndex("by_session", (q) => q.eq("sessionId", activeSession._id))
        .first(),
      ctx.db
        .query("assessmentRecords")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .filter((q) => q.eq(q.field("sessionId"), activeSession._id))
        .first(),
    ]);

    const hasStudentSubjectSelections = Boolean(selectionRecord);
    const hasAssessmentRecords = Boolean(assessmentRecord);

    return {
      activeSessionId: activeSession._id,
      activeSessionName: normalizeHumanName(activeSession.name),
      hasStudentSubjectSelections,
      hasAssessmentRecords,
      warningMessage:
        hasStudentSubjectSelections || hasAssessmentRecords
          ? `Changing the active session will keep ${normalizeHumanName(
              activeSession.name
            )} as history, but it already has live enrollment or assessment data.`
          : null,
    };
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

    const nextStartDate = args.startDate ?? session.startDate;
    const nextEndDate = args.endDate ?? session.endDate;
    if (nextEndDate <= nextStartDate) {
      throw new ConvexError("End date must be after start date");
    }

    if (args.isActive === false && session.isActive) {
      throw new ConvexError(
        "An active session cannot be turned off directly. Activate another session instead."
      );
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = normalizeHumanName(args.name);
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
      name: normalizeHumanName(args.name),
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
        name: normalizeHumanName(t.name),
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
      name: normalizeHumanName(args.name),
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
        name: normalizeHumanName(s.name),
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
    if (args.name !== undefined) updates.name = normalizeHumanName(args.name);
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
    name: v.optional(v.string()),
    gradeName: v.optional(v.string()),
    classLabel: v.optional(v.string()),
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

    const gradeName = normalizeClassGradeName(args.gradeName ?? args.name ?? "");
    if (!gradeName) {
      throw new ConvexError("Class grade name is required");
    }

    const classLabel = args.classLabel
      ? normalizeClassLabel(args.classLabel)
      : undefined;
    const displayName = buildClassName({
      gradeName,
      classLabel,
      legacyName: args.name,
    });

    const now = Date.now();
    return await ctx.db.insert("classes", {
      schoolId,
      name: displayName,
      level: args.level,
      gradeName,
      ...(classLabel ? { classLabel } : {}),
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
      gradeName: v.string(),
      classLabel: v.optional(v.string()),
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
                  return subject?.name ? normalizeHumanName(subject.name) : null;
                })
              )
            ).filter((name): name is string => Boolean(name));

            return {
              _id: classDoc._id,
              name: buildClassName({
                gradeName: classDoc.gradeName ?? classDoc.name,
                classLabel: classDoc.classLabel,
                legacyName: classDoc.name,
              }),
              level: classDoc.level,
              gradeName: getStoredGradeName(classDoc),
              classLabel: getStoredClassLabel(classDoc),
              formTeacherId: classDoc.formTeacherId,
        formTeacherName: teacher?.name ? normalizePersonName(teacher.name) : undefined,
              subjectNames,
              studentCount: students.length,
              createdAt: classDoc.createdAt,
          };
        })
    );

    return results;
  },
});

export const backfillClassNaming = mutation({
  args: {},
  returns: v.object({
    updatedCount: v.number(),
  }),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classes = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();

    let updatedCount = 0;
    for (const classDoc of classes) {
      const gradeName = getStoredGradeName(classDoc);
      const classLabel = getStoredClassLabel(classDoc);
      const name = buildClassName({
        gradeName,
        classLabel,
        legacyName: classDoc.name,
      });

      if (
        classDoc.gradeName !== gradeName ||
        classDoc.classLabel !== classLabel ||
        classDoc.name !== name
      ) {
        await ctx.db.patch(classDoc._id, {
          gradeName,
          name,
          ...(classLabel ? { classLabel } : {}),
          updatedAt: Date.now(),
        });
        updatedCount += 1;
      }
    }

    return { updatedCount };
  },
});

export const updateClass = mutation({
  args: {
    classId: v.id("classes"),
    name: v.optional(v.string()),
    gradeName: v.optional(v.string()),
    level: v.optional(v.string()),
    classLabel: v.optional(v.union(v.string(), v.null())),
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
    const nextGradeName = normalizeClassGradeName(
      args.gradeName ?? args.name ?? getStoredGradeName(classDoc)
    );
    if (!nextGradeName) {
      throw new ConvexError("Class grade name is required");
    }
    const nextLevel = args.level ?? classDoc.level;
    const nextClassLabel =
      args.classLabel === null
        ? undefined
        : args.classLabel !== undefined
          ? args.classLabel.trim()
            ? normalizeClassLabel(args.classLabel)
            : undefined
          : getStoredClassLabel(classDoc);
    const nextName = buildClassName({
      gradeName: nextGradeName,
      classLabel: nextClassLabel,
      legacyName: args.name ?? classDoc.name,
    });
    const nextFormTeacherId =
      args.formTeacherId === undefined
        ? classDoc.formTeacherId
        : args.formTeacherId ?? undefined;

    if (args.formTeacherId === null || args.classLabel === null) {
      const replacement = {
        schoolId: classDoc.schoolId,
        name: nextName,
        level: nextLevel,
        gradeName: nextGradeName,
        ...(nextClassLabel ? { classLabel: nextClassLabel } : {}),
        ...(nextFormTeacherId ? { formTeacherId: nextFormTeacherId } : {}),
        createdAt: classDoc.createdAt,
        updatedAt,
      };
      await ctx.db.replace(args.classId, replacement);
      return null;
    }

    const updates: Record<string, unknown> = {
      name: nextName,
      level: nextLevel,
      gradeName: nextGradeName,
      updatedAt,
    };

    if (args.classLabel !== undefined) {
      updates.classLabel = nextClassLabel;
    }
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

    const nextSubjectIds = new Set(args.subjectIds.map((subjectId) => String(subjectId)));

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

    const removedSubjectIds = new Set(
      existingOfferings
        .map((offering) => String(offering.subjectId))
        .filter((subjectId) => !nextSubjectIds.has(subjectId))
    );

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

    if (removedSubjectIds.size > 0) {
      const activeSession = await ctx.db
        .query("academicSessions")
        .withIndex("by_school_active", (q) =>
          q.eq("schoolId", schoolId).eq("isActive", true)
        )
        .unique();

      if (activeSession) {
        const activeSelections = await ctx.db
          .query("studentSubjectSelections")
          .withIndex("by_class_and_session", (q) =>
            q.eq("classId", args.classId).eq("sessionId", activeSession._id)
          )
          .collect();

        for (const selection of activeSelections) {
          if (removedSubjectIds.has(String(selection.subjectId))) {
            await ctx.db.delete(selection._id);
          }
        }
      }
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
        teacherName = teacher?.name ? normalizePersonName(teacher.name) : undefined;
      }

      results.push({
        _id: offering._id,
        subjectId: offering.subjectId,
        subjectName: normalizeHumanName(subject.name),
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
