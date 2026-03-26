import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
  teacherHasClassAccess,
} from "./auth";
import { normalizeHumanName, normalizePersonName } from "@school/shared/name-format";

function toStudentAuthId(schoolId: string, admissionNumber: string) {
  return `student:${schoolId}:${admissionNumber.trim().toLowerCase()}`;
}

function normalizeOptionalHouseName(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return normalizeHumanName(trimmed);
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
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
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
      name: normalizePersonName(args.name),
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
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
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
            studentName: normalizePersonName(studentUser?.name ?? "Unnamed Student"),
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
    houseName: v.optional(v.union(v.string(), v.null())),
    gender: v.optional(v.union(v.string(), v.null())),
    dateOfBirth: v.optional(v.union(v.number(), v.null())),
    guardianName: v.optional(v.union(v.string(), v.null())),
    guardianPhone: v.optional(v.union(v.string(), v.null())),
    address: v.optional(v.union(v.string(), v.null())),
    photoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    photoFileName: v.optional(v.union(v.string(), v.null())),
    photoContentType: v.optional(v.union(v.string(), v.null())),
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
      if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
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

    const userUpdates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) {
      userUpdates.name = normalizePersonName(args.name);
    }
    const nextAdmissionNumber = args.admissionNumber ?? student.admissionNumber;
    if (args.admissionNumber !== undefined) {
      userUpdates.authId = toStudentAuthId(
        String(schoolId),
        args.admissionNumber
      );
      userUpdates.email = `${args.admissionNumber
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()}@students.local`;
    }
    if (
      args.photoStorageId === undefined &&
      (args.photoFileName !== undefined || args.photoContentType !== undefined)
    ) {
      throw new ConvexError("Photo upload metadata is incomplete");
    }

    const nextStudentRecord: any = {
      schoolId: student.schoolId,
      classId: args.classId ?? student.classId,
      userId: student.userId,
      admissionNumber: nextAdmissionNumber,
      createdAt: student.createdAt,
      updatedAt: Date.now(),
    };

    const nextGender = args.gender === undefined ? student.gender : args.gender ?? undefined;
    const nextHouseName =
      args.houseName === undefined
        ? student.houseName
        : normalizeOptionalHouseName(args.houseName);
    const nextDateOfBirth =
      args.dateOfBirth === undefined
        ? student.dateOfBirth
        : args.dateOfBirth ?? undefined;
    const nextGuardianName =
      args.guardianName === undefined
        ? student.guardianName
        : args.guardianName ?? undefined;
    const nextGuardianPhone =
      args.guardianPhone === undefined
        ? student.guardianPhone
        : args.guardianPhone ?? undefined;
    const nextAddress =
      args.address === undefined ? student.address : args.address ?? undefined;
    const nextPhotoStorageId =
      args.photoStorageId === undefined
        ? student.photoStorageId
        : args.photoStorageId ?? undefined;
    const nextPhotoFileName =
      args.photoStorageId === undefined
        ? student.photoFileName
        : args.photoStorageId
          ? args.photoFileName ?? student.photoFileName
          : undefined;
    const nextPhotoContentType =
      args.photoStorageId === undefined
        ? student.photoContentType
        : args.photoStorageId
          ? args.photoContentType ?? student.photoContentType
          : undefined;
    const nextPhotoUpdatedAt =
      args.photoStorageId === undefined
        ? student.photoUpdatedAt
        : args.photoStorageId
          ? Date.now()
          : undefined;

    if (nextHouseName) nextStudentRecord.houseName = nextHouseName;
    if (nextGender) nextStudentRecord.gender = nextGender;
    if (nextDateOfBirth) nextStudentRecord.dateOfBirth = nextDateOfBirth;
    if (nextGuardianName) nextStudentRecord.guardianName = nextGuardianName;
    if (nextGuardianPhone) nextStudentRecord.guardianPhone = nextGuardianPhone;
    if (nextAddress) nextStudentRecord.address = nextAddress;
    if (nextPhotoStorageId) nextStudentRecord.photoStorageId = nextPhotoStorageId;
    if (nextPhotoFileName) nextStudentRecord.photoFileName = nextPhotoFileName;
    if (nextPhotoContentType) {
      nextStudentRecord.photoContentType = nextPhotoContentType;
    }
    if (nextPhotoUpdatedAt) nextStudentRecord.photoUpdatedAt = nextPhotoUpdatedAt;

    await ctx.db.patch(student.userId, userUpdates);
    await ctx.db.replace(args.studentId, nextStudentRecord);
    return null;
  },
});

export const getStudentProfile = query({
  args: { studentId: v.id("students") },
  returns: v.object({
    _id: v.id("students"),
    name: v.string(),
    admissionNumber: v.string(),
    classId: v.id("classes"),
    className: v.string(),
    houseName: v.union(v.string(), v.null()),
    gender: v.union(v.string(), v.null()),
    dateOfBirth: v.union(v.number(), v.null()),
    guardianName: v.union(v.string(), v.null()),
    guardianPhone: v.union(v.string(), v.null()),
    address: v.union(v.string(), v.null()),
    photoUrl: v.union(v.string(), v.null()),
    photoFileName: v.union(v.string(), v.null()),
    photoContentType: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId) {
      throw new ConvexError("Student not found");
    }

    const [studentUser, classDoc, photoUrl] = await Promise.all([
      ctx.db.get(student.userId),
      ctx.db.get(student.classId),
      student.photoStorageId ? ctx.storage.getUrl(student.photoStorageId) : null,
    ]);

    if (!classDoc || classDoc.schoolId !== schoolId) {
      throw new ConvexError("Student class not found");
    }

    return {
      _id: student._id,
      name: normalizePersonName(studentUser?.name ?? "Unnamed Student"),
      admissionNumber: student.admissionNumber,
      classId: student.classId,
      className: normalizeHumanName(classDoc.name),
      houseName: student.houseName ?? null,
      gender: student.gender ?? null,
      dateOfBirth: student.dateOfBirth ?? null,
      guardianName: student.guardianName ?? null,
      guardianPhone: student.guardianPhone ?? null,
      address: student.address ?? null,
      photoUrl,
      photoFileName: student.photoFileName ?? null,
      photoContentType: student.photoContentType ?? null,
    };
  },
});

export const generateStudentPhotoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    return await ctx.storage.generateUploadUrl();
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
      const hasAccess = await teacherHasClassAccess(
        ctx,
        userId,
        schoolId,
        args.classId
      );

      if (!hasAccess) {
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
    if (student.classId !== args.classId) {
      throw new ConvexError("Student is not enrolled in this class");
    }

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Cross-school access denied");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.schoolId !== schoolId || session.isArchived) {
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

    const existingSelections = await ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_student_and_class_and_session", (q) =>
        q
          .eq("studentId", args.studentId)
          .eq("classId", args.classId)
          .eq("sessionId", args.sessionId)
      )
      .collect();

    const existingSubjectIds = new Set(
      existingSelections.map((selection) => String(selection.subjectId))
    );

    const subjectIdsToSave: typeof args.subjectIds = [];
    const seenSubjectIds = new Set<string>();

    for (const subjectId of args.subjectIds) {
      const subjectKey = String(subjectId);
      if (seenSubjectIds.has(subjectKey)) {
        continue;
      }
      seenSubjectIds.add(subjectKey);

      const subject = await ctx.db.get(subjectId);
      if (!subject || subject.schoolId !== schoolId || subject.isArchived) {
        throw new ConvexError("Cross-school access denied for subject");
      }

      if (!offeredSubjectIds.has(subjectKey)) {
        if (existingSubjectIds.has(subjectKey)) {
          continue;
        }

        throw new ConvexError(
          "One of the selected subjects is no longer offered for this class. Refresh the grid and try again."
        );
      }

      subjectIdsToSave.push(subjectId);
    }

    // Remove existing selections for this student/class/session
    for (const selection of existingSelections) {
      await ctx.db.delete(selection._id);
    }

    // Insert new selections
    const now = Date.now();
    for (const subjectId of subjectIdsToSave) {
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
    if (!session || session.schoolId !== schoolId || session.isArchived) {
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
      if (!subject || subject.isArchived) continue;

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
      const hasAccess = await teacherHasClassAccess(
        ctx,
        userId,
        schoolId,
        args.classId
      );

      if (!hasAccess) {
        throw new ConvexError("Not assigned to this class");
      }
    } else if (role !== "admin") {
      throw new ConvexError("Admin or teacher access required");
    }

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
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
      if (subject && !subject.isArchived) {
        subjects.push({
          _id: subject._id,
            name: normalizeHumanName(subject.name),
          code: subject.code,
        });
      }
    }
    const visibleSubjectIds = new Set(subjects.map((subject) => String(subject._id)));

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
      if (!visibleSubjectIds.has(String(selection.subjectId))) {
        continue;
      }

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
            studentName: normalizePersonName(studentUser?.name ?? "Unnamed Student"),
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
