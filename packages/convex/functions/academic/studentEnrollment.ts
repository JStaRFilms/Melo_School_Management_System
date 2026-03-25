import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
} from "./auth";
import { normalizeHumanName } from "@school/shared";

function toStudentAuthId(schoolId: string, admissionNumber: string) {
  return `student:${schoolId}:${admissionNumber.trim().toLowerCase()}`;
}

// ==================== STUDENT ROSTER ====================

export const createStudent = mutation({
  args: {
    name: v.string(),
    admissionNumber: v.string(),
    classId: v.id("classes"),
  },
  returns: v.id("students"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    // Check for duplicate admission number
    const existing = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .filter((q) => q.eq(q.field("admissionNumber"), args.admissionNumber))
      .unique();

    if (existing) {
      throw new ConvexError("A student with this admission number already exists");
    }

    const now = Date.now();
    const studentUserId = await ctx.db.insert("users", {
      schoolId,
      authId: toStudentAuthId(String(schoolId), args.admissionNumber),
      name: normalizeHumanName(args.name),
      email: `${args.admissionNumber.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}@students.local`,
      role: "student",
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.insert("students", {
      schoolId,
      classId: args.classId,
      userId: studentUserId,
      admissionNumber: args.admissionNumber,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listStudentsByClass = query({
  args: { classId: v.id("classes") },
  returns: v.array(
    v.object({
      _id: v.id("students"),
      studentName: v.string(),
      admissionNumber: v.string(),
      classId: v.id("classes"),
      createdAt: v.number(),
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

    const students = await ctx.db
      .query("students")
      .withIndex("by_school_and_class", (q) =>
        q.eq("schoolId", schoolId).eq("classId", args.classId)
      )
      .collect();

    const results = await Promise.all(
      students
        .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber))
        .map(async (student) => {
          const studentUser = await ctx.db.get(student.userId);
          return {
            _id: student._id,
            studentName: normalizeHumanName(studentUser?.name ?? "Unnamed Student"),
            admissionNumber: student.admissionNumber,
            classId: student.classId,
            createdAt: student.createdAt,
          };
        })
    );

    return results;
  },
});

export const updateStudent = mutation({
  args: {
    studentId: v.id("students"),
    name: v.optional(v.string()),
    admissionNumber: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    // Verify new class if changing
    if (args.classId) {
      const classDoc = await ctx.db.get(args.classId);
      if (!classDoc || classDoc.schoolId !== schoolId) {
        throw new ConvexError("Cross-school access denied");
      }
    }

    // Check for duplicate admission number if changing
    if (args.admissionNumber && args.admissionNumber !== student.admissionNumber) {
      const existing = await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .filter((q) => q.eq(q.field("admissionNumber"), args.admissionNumber))
        .unique();

      if (existing) {
        throw new ConvexError("A student with this admission number already exists");
      }
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) {
      await ctx.db.patch(student.userId, {
        name: normalizeHumanName(args.name),
        updatedAt: Date.now(),
      });
    }
    if (args.admissionNumber !== undefined) updates.admissionNumber = args.admissionNumber;
    if (args.classId !== undefined) updates.classId = args.classId;
    updates.updatedAt = Date.now();

    await ctx.db.patch(args.studentId, updates);
    return null;
  },
});

export const deleteStudent = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    // Delete related subject selections first
    const selections = await ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    for (const selection of selections) {
      await ctx.db.delete(selection._id);
    }

    await ctx.db.delete(args.studentId);
    await ctx.db.delete(student.userId);
    return null;
  },
});

// ==================== STUDENT SUBJECT ENROLLMENT ====================

export const setStudentSubjectSelections = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    subjectIds: v.array(v.id("subjects")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);

    // Teachers can edit subject selections for their assigned classes
    if (role === "teacher") {
      // Verify teacher is assigned to this class for at least one subject
      const assignment = await ctx.db
        .query("teacherAssignments")
        .withIndex("by_teacher_and_class", (q) =>
          q.eq("teacherId", userId).eq("classId", args.classId)
        )
        .first();

      if (!assignment) {
        throw new ConvexError("Not assigned to this class");
      }
    } else if (role !== "admin") {
      throw new ConvexError("Admin or teacher access required");
    }

    // Verify school boundary
    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    // Verify all subjects are offered in this class
    const classOfferings = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const offeredSubjectIds = new Set(
      classOfferings.map((o) => String(o.subjectId))
    );

    for (const subjectId of args.subjectIds) {
      if (!offeredSubjectIds.has(String(subjectId))) {
        const subject = await ctx.db.get(subjectId);
        throw new ConvexError(
          `Subject "${subject?.name ?? subjectId}" is not offered in this class`
        );
      }

      // Verify subject belongs to this school
      const subject = await ctx.db.get(subjectId);
      if (!subject || subject.schoolId !== schoolId) {
        throw new ConvexError("Cross-school access denied for subject");
      }
    }

    // Remove existing selections for this student/class/session
    const existingSelections = await ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_student_and_class_and_session", (q) =>
        q
          .eq("studentId", args.studentId)
          .eq("classId", args.classId)
          .eq("sessionId", args.sessionId)
      )
      .collect();

    for (const selection of existingSelections) {
      await ctx.db.delete(selection._id);
    }

    // Insert new selections
    const now = Date.now();
    for (const subjectId of args.subjectIds) {
      await ctx.db.insert("studentSubjectSelections", {
        schoolId,
        studentId: args.studentId,
        classId: args.classId,
        subjectId,
        sessionId: args.sessionId,
        createdAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

export const getStudentSubjectSelections = query({
  args: {
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("studentSubjectSelections"),
      subjectId: v.id("subjects"),
      subjectName: v.string(),
      subjectCode: v.string(),
      classId: v.id("classes"),
    })
  ),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);

    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const selections = await ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_student_and_session", (q) =>
        q.eq("studentId", args.studentId).eq("sessionId", args.sessionId)
      )
      .collect();

    const results = [];
    for (const selection of selections) {
      const subject = await ctx.db.get(selection.subjectId);
      if (!subject) continue;

      results.push({
        _id: selection._id,
        subjectId: selection.subjectId,
          subjectName: normalizeHumanName(subject.name),
        subjectCode: subject.code,
        classId: selection.classId,
      });
    }

    return results.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  },
});

export const getClassStudentSubjectMatrix = query({
  args: {
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
  },
  returns: v.object({
    subjects: v.array(
      v.object({
        _id: v.id("subjects"),
        name: v.string(),
        code: v.string(),
      })
    ),
    students: v.array(
      v.object({
        _id: v.id("students"),
        studentName: v.string(),
        admissionNumber: v.string(),
        selectedSubjectIds: v.array(v.id("subjects")),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);

    // Teachers can view their assigned classes
    if (role === "teacher") {
      const assignment = await ctx.db
        .query("teacherAssignments")
        .withIndex("by_teacher_and_class", (q) =>
          q.eq("teacherId", userId).eq("classId", args.classId)
        )
        .first();

      if (!assignment) {
        throw new ConvexError("Not assigned to this class");
      }
    } else if (role !== "admin") {
      throw new ConvexError("Admin or teacher access required");
    }

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    // Get subjects offered in this class
    const offerings = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const subjects = [];
    for (const offering of offerings) {
      const subject = await ctx.db.get(offering.subjectId);
      if (subject) {
        subjects.push({
          _id: subject._id,
            name: normalizeHumanName(subject.name),
          code: subject.code,
        });
      }
    }

    // Get students in this class
    const students = await ctx.db
      .query("students")
      .withIndex("by_school_and_class", (q) =>
        q.eq("schoolId", schoolId).eq("classId", args.classId)
      )
      .collect();

    // Get all selections for this class/session
    const allSelections = await ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_class_and_session", (q) =>
        q.eq("classId", args.classId).eq("sessionId", args.sessionId)
      )
      .collect();

    // Build selection map
    const selectionMap = new Map<string, string[]>();
    for (const selection of allSelections) {
      const key = String(selection.studentId);
      if (!selectionMap.has(key)) {
        selectionMap.set(key, []);
      }
      selectionMap.get(key)!.push(String(selection.subjectId));
    }

    const studentResults = students
      .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber))
      .map(async (student) => {
        const studentUser = await ctx.db.get(student.userId);
        return {
          _id: student._id,
            studentName: normalizeHumanName(studentUser?.name ?? "Unnamed Student"),
          admissionNumber: student.admissionNumber,
          selectedSubjectIds: (selectionMap.get(String(student._id)) ?? []).map(
            (id) => id as any
          ),
        };
      });

    return {
      subjects: subjects.sort((a, b) => a.name.localeCompare(b.name)),
      students: await Promise.all(studentResults),
    };
  },
});
