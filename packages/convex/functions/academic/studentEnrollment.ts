import { mutation, query } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
  teacherHasClassAccess,
} from "./auth";
import { normalizeHumanName } from "@school/shared/name-format";
import {
  getReadableUserName,
  resolveStoredUserNameFields,
} from "./studentNameCompat";
import { listActiveClassSubjectAggregations } from "./subjectAggregationHelpers";
import {
  deriveEffectiveSubjectSelectionIds,
  listClassAggregationOptOuts,
  listStudentAggregationOptOuts,
} from "./subjectAggregationSelectionHelpers";

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

function normalizeAdmissionNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ConvexError("Admission number is required");
  }

  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeGender(
  value: string | null | undefined,
  options?: { required?: boolean }
) {
  if (value === undefined || value === null) {
    if (options?.required) {
      throw new ConvexError("Gender is required");
    }
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    if (options?.required) {
      throw new ConvexError("Gender is required");
    }
    return undefined;
  }

  if (normalized === "male") {
    return "Male";
  }

  if (normalized === "female") {
    return "Female";
  }

  throw new ConvexError("Select a valid gender");
}

function getValidatedPhotoMetadata(args: {
  photoStorageId?: Id<"_storage"> | null;
  photoFileName?: string | null;
  photoContentType?: string | null;
}) {
  if (
    args.photoStorageId === undefined &&
    (args.photoFileName !== undefined || args.photoContentType !== undefined)
  ) {
    throw new ConvexError("Photo upload metadata is incomplete");
  }

  if (args.photoStorageId === undefined || args.photoStorageId === null) {
    return null;
  }

  const fileName = args.photoFileName?.trim();
  const contentType = args.photoContentType?.trim();
  if (!fileName || !contentType) {
    throw new ConvexError("Photo upload metadata is incomplete");
  }

  if (!contentType.startsWith("image/")) {
    throw new ConvexError("Student photo must be an image file");
  }

  return {
    fileName,
    contentType,
  };
}

// ==================== STUDENT ROSTER ====================

export const createStudent = mutation({
  args: {
    name: v.optional(v.union(v.string(), v.null())),
    firstName: v.optional(v.union(v.string(), v.null())),
    lastName: v.optional(v.union(v.string(), v.null())),
    admissionNumber: v.string(),
    classId: v.id("classes"),
    houseName: v.optional(v.union(v.string(), v.null())),
    gender: v.string(),
    dateOfBirth: v.optional(v.union(v.number(), v.null())),
    guardianName: v.optional(v.union(v.string(), v.null())),
    guardianPhone: v.optional(v.union(v.string(), v.null())),
    address: v.optional(v.union(v.string(), v.null())),
    photoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    photoFileName: v.optional(v.union(v.string(), v.null())),
    photoContentType: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.id("students"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const studentName = resolveStoredUserNameFields({
      name: args.name,
      firstName: args.firstName,
      lastName: args.lastName,
      requiredMessage: "Student name is required",
    });
    const admissionNumber = normalizeAdmissionNumber(args.admissionNumber);
    const gender = normalizeGender(args.gender, { required: true });
    const houseName = normalizeOptionalHouseName(args.houseName);
    const dateOfBirth = args.dateOfBirth ?? undefined;
    const guardianName = normalizeOptionalText(args.guardianName);
    const guardianPhone = normalizeOptionalText(args.guardianPhone);
    const address = normalizeOptionalText(args.address);
    const photoMetadata = getValidatedPhotoMetadata(args);

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Selected class is not available");
    }

    // Check for duplicate admission number
    const existing = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .filter((q) => q.eq(q.field("admissionNumber"), admissionNumber))
      .unique();

    if (existing) {
      throw new ConvexError("A student with this admission number already exists");
    }

    const now = Date.now();
    const studentUserId = await ctx.db.insert("users", {
      schoolId,
      authId: toStudentAuthId(String(schoolId), admissionNumber),
      name: studentName.name,
      ...(studentName.firstName ? { firstName: studentName.firstName } : {}),
      ...(studentName.lastName ? { lastName: studentName.lastName } : {}),
      email: `${admissionNumber.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}@students.local`,
      role: "student",
      createdAt: now,
      updatedAt: now,
    });

    const studentRecord: Record<string, unknown> = {
      schoolId,
      classId: args.classId,
      userId: studentUserId,
      admissionNumber,
      gender,
      createdAt: now,
      updatedAt: now,
    };

    if (houseName) {
      studentRecord.houseName = houseName;
    }
    if (dateOfBirth) {
      studentRecord.dateOfBirth = dateOfBirth;
    }
    if (guardianName) {
      studentRecord.guardianName = guardianName;
    }
    if (guardianPhone) {
      studentRecord.guardianPhone = guardianPhone;
    }
    if (address) {
      studentRecord.address = address;
    }
    if (photoMetadata) {
      studentRecord.photoStorageId = args.photoStorageId;
      studentRecord.photoFileName = photoMetadata.fileName;
      studentRecord.photoContentType = photoMetadata.contentType;
      studentRecord.photoUpdatedAt = now;
    }

    return await ctx.db.insert("students", studentRecord as any);
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
    const { userId, schoolId, role, isSchoolAdmin } =
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
          const studentName = getReadableUserName(studentUser);
          return {
            _id: student._id,
            studentName: studentName.displayName || "Unnamed Student",
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
    name: v.optional(v.union(v.string(), v.null())),
    firstName: v.optional(v.union(v.string(), v.null())),
    lastName: v.optional(v.union(v.string(), v.null())),
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
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId) {
      throw new ConvexError("Student not found");
    }
    const studentUser = await ctx.db.get(student.userId);
    if (!studentUser || studentUser.schoolId !== schoolId) {
      throw new ConvexError("Student account not found");
    }

    // Verify new class if changing
    if (args.classId) {
      const classDoc = await ctx.db.get(args.classId);
      if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
        throw new ConvexError("Selected class is not available");
      }
    }

    // Check for duplicate admission number if changing
    const nextAdmissionNumber =
      args.admissionNumber === undefined
        ? student.admissionNumber
        : normalizeAdmissionNumber(args.admissionNumber);

    if (nextAdmissionNumber !== student.admissionNumber) {
      const existing = await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .filter((q) => q.eq(q.field("admissionNumber"), nextAdmissionNumber))
        .unique();

      if (existing) {
        throw new ConvexError("A student with this admission number already exists");
      }
    }

    const userName = resolveStoredUserNameFields({
      name: args.name,
      firstName: args.firstName,
      lastName: args.lastName,
      fallbackName: studentUser.name,
      fallbackFirstName: studentUser.firstName,
      fallbackLastName: studentUser.lastName,
      requiredMessage: "Student name is required",
    });

    const nextUserRecord: Record<string, unknown> = {
      schoolId: studentUser.schoolId,
      authId: studentUser.authId,
      name: userName.name,
      email: studentUser.email,
      role: studentUser.role,
      createdAt: studentUser.createdAt,
      updatedAt: Date.now(),
      ...(studentUser.isArchived !== undefined ? { isArchived: studentUser.isArchived } : {}),
      ...(studentUser.archivedAt !== undefined ? { archivedAt: studentUser.archivedAt } : {}),
      ...(studentUser.archivedBy !== undefined ? { archivedBy: studentUser.archivedBy } : {}),
      ...(userName.firstName ? { firstName: userName.firstName } : {}),
      ...(userName.lastName ? { lastName: userName.lastName } : {}),
    };
    if (args.admissionNumber !== undefined) {
      nextUserRecord.authId = toStudentAuthId(
        String(schoolId),
        nextAdmissionNumber
      );
      nextUserRecord.email = `${nextAdmissionNumber
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()}@students.local`;
    }
    const uploadedPhotoMetadata = getValidatedPhotoMetadata(args);

    const nextStudentRecord: any = {
      schoolId: student.schoolId,
      classId: args.classId ?? student.classId,
      userId: student.userId,
      admissionNumber: nextAdmissionNumber,
      createdAt: student.createdAt,
      updatedAt: Date.now(),
    };

    const nextGender =
      args.gender === undefined
        ? student.gender
        : normalizeGender(args.gender ?? undefined);
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
        : normalizeOptionalText(args.guardianName);
    const nextGuardianPhone =
      args.guardianPhone === undefined
        ? student.guardianPhone
        : normalizeOptionalText(args.guardianPhone);
    const nextAddress =
      args.address === undefined
        ? student.address
        : normalizeOptionalText(args.address);
    const nextPhotoStorageId =
      args.photoStorageId === undefined
        ? student.photoStorageId
        : args.photoStorageId ?? undefined;
    const nextPhotoFileName =
      args.photoStorageId === undefined
        ? student.photoFileName
        : args.photoStorageId
          ? uploadedPhotoMetadata?.fileName ?? student.photoFileName
          : undefined;
    const nextPhotoContentType =
      args.photoStorageId === undefined
        ? student.photoContentType
        : args.photoStorageId
          ? uploadedPhotoMetadata?.contentType ?? student.photoContentType
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

    await ctx.db.replace(studentUser._id, nextUserRecord as any);
    await ctx.db.replace(args.studentId, nextStudentRecord);
    return null;
  },
});

export const getStudentProfile = query({
  args: { studentId: v.id("students") },
  returns: v.object({
    _id: v.id("students"),
    name: v.string(),
    displayName: v.string(),
    firstName: v.union(v.string(), v.null()),
    lastName: v.union(v.string(), v.null()),
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
    const { userId, schoolId, role, isSchoolAdmin } =
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

    const studentName = getReadableUserName(studentUser);

    return {
      _id: student._id,
      name: studentName.displayName || "Unnamed Student",
      displayName: studentName.displayName || "Unnamed Student",
      firstName: studentName.firstName,
      lastName: studentName.lastName,
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
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    return await ctx.storage.generateUploadUrl();
  },
});

export const deleteStudent = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
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

    const optOuts = await ctx.db
      .query("studentSubjectAggregationOptOuts")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    for (const optOut of optOuts) {
      await ctx.db.delete(optOut._id);
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
    const { userId, schoolId, role, isSchoolAdmin } =
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
    } else if (!isSchoolAdmin && role !== "admin") {
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

    const [existingSelections, aggregations, existingOptOuts] = await Promise.all([
      ctx.db
        .query("studentSubjectSelections")
        .withIndex("by_student_and_class_and_session", (q) =>
          q
            .eq("studentId", args.studentId)
            .eq("classId", args.classId)
            .eq("sessionId", args.sessionId)
        )
        .collect(),
      listActiveClassSubjectAggregations(ctx, {
        schoolId,
        classId: args.classId,
      }),
      listStudentAggregationOptOuts(ctx, {
        studentId: args.studentId,
        classId: args.classId,
        sessionId: args.sessionId,
      }),
    ]);

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

    const selectedSubjectIdSet = new Set(
      subjectIdsToSave.map((subjectId) => String(subjectId))
    );
    const existingOptOutByAggregationId = new Map<string, any>(
      existingOptOuts.map((optOut: any) => [
        String(optOut.aggregationId),
        optOut,
      ] as const)
    );
    const sanitizedSubjectIdsToSave = [...subjectIdsToSave];

    const now = Date.now();

    for (const aggregation of aggregations) {
      const aggregationId = String(aggregation._id);
      const umbrellaSubjectId = String(aggregation.umbrellaSubjectId);
      const allComponentsSelected = aggregation.components.every((component) =>
        selectedSubjectIdSet.has(String(component.componentSubjectId))
      );
      const umbrellaSelected = selectedSubjectIdSet.has(umbrellaSubjectId);
      const existingOptOut = existingOptOutByAggregationId.get(aggregationId);

      if (!allComponentsSelected && umbrellaSelected) {
        selectedSubjectIdSet.delete(umbrellaSubjectId);
        const index = sanitizedSubjectIdsToSave.findIndex(
          (subjectId) => String(subjectId) === umbrellaSubjectId
        );
        if (index >= 0) {
          sanitizedSubjectIdsToSave.splice(index, 1);
        }
      }

      if (allComponentsSelected && selectedSubjectIdSet.has(umbrellaSubjectId)) {
        if (existingOptOut) {
          await ctx.db.delete(existingOptOut._id);
        }
        continue;
      }

      if (allComponentsSelected) {
        if (!existingOptOut) {
          await ctx.db.insert("studentSubjectAggregationOptOuts", {
            schoolId,
            studentId: args.studentId,
            classId: args.classId,
            sessionId: args.sessionId,
            aggregationId: aggregation._id,
            umbrellaSubjectId: aggregation.umbrellaSubjectId,
            createdAt: now,
            updatedAt: now,
            updatedBy: userId,
          });
        }
      }
    }

    // Insert new selections
    for (const subjectId of sanitizedSubjectIdsToSave) {
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
    const { userId, schoolId, role, isSchoolAdmin } =
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
    const { userId, schoolId, role, isSchoolAdmin } =
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
    } else if (!isSchoolAdmin && role !== "admin") {
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

    const [allSelections, aggregations, optOuts] = await Promise.all([
      ctx.db
        .query("studentSubjectSelections")
        .withIndex("by_class_and_session", (q) =>
          q.eq("classId", args.classId).eq("sessionId", args.sessionId)
        )
        .collect(),
      listActiveClassSubjectAggregations(ctx, {
        schoolId,
        classId: args.classId,
      }),
      listClassAggregationOptOuts(ctx, {
        classId: args.classId,
        sessionId: args.sessionId,
      }),
    ]);

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
    const optOutMap = new Map<string, Set<string>>();
    for (const optOut of optOuts) {
      const studentKey = String(optOut.studentId);
      if (!optOutMap.has(studentKey)) {
        optOutMap.set(studentKey, new Set());
      }
      optOutMap.get(studentKey)!.add(String(optOut.aggregationId));
    }

    const studentResults = students
      .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber))
        .map(async (student) => {
          const studentUser = await ctx.db.get(student.userId);
          const studentName = getReadableUserName(studentUser);
          const effectiveSubjectIds = deriveEffectiveSubjectSelectionIds({
            explicitSubjectIds: selectionMap.get(String(student._id)) ?? [],
            aggregations,
            optOutAggregationIds: optOutMap.get(String(student._id)) ?? new Set(),
          });
          return {
            _id: student._id,
            studentName: studentName.displayName || "Unnamed Student",
            admissionNumber: student.admissionNumber,
            selectedSubjectIds: Array.from(effectiveSubjectIds)
              .filter((id) => visibleSubjectIds.has(id))
              .map((id) => id as any),
        };
      });

    return {
      subjects: subjects.sort((a, b) => a.name.localeCompare(b.name)),
      students: await Promise.all(studentResults),
    };
  },
});
