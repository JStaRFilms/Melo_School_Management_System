import { action, internalMutation, internalQuery, mutation, query } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
  teacherHasClassAccess,
} from "./auth";
import { normalizeHumanName } from "@school/shared/name-format";
import { provisionSchoolPortalAuthUser } from "../platform/provisioningHelpers";
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

function archivedRecordNotice(recordType: string) {
  return `This failed because the ${recordType} was previously archived. Check the archives.`;
}

async function findStudentsByAdmissionNumber(
  ctx: any,
  schoolId: Id<"schools">,
  admissionNumber: string
) {
  return await ctx.db
    .query("students")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .filter((q: any) => q.eq(q.field("admissionNumber"), admissionNumber))
    .collect();
}

async function findStudentUserByAdmissionNumber(
  ctx: any,
  schoolId: Id<"schools">,
  admissionNumber: string
) {
  const normalizedAuthId = toStudentAuthId(String(schoolId), admissionNumber);
  const normalizedEmail = `${admissionNumber
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()}@students.local`;

  const users = await ctx.db
    .query("users")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .filter((q: any) =>
      q.or(
        q.eq(q.field("authId"), normalizedAuthId),
        q.eq(q.field("email"), normalizedEmail)
      )
    )
    .collect();

  return users.find((user: any) => user.role === "student") ?? null;
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

function normalizeOptionalEmail(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new ConvexError("Enter a valid email address");
  }

  return trimmed;
}

function normalizeOptionalPhone(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function buildFamilyName(args: { studentName: string; parentName?: string; familyName?: string | null | undefined; }) {
  const explicitFamilyName = normalizeOptionalText(args.familyName);
  if (explicitFamilyName) {
    return normalizeHumanName(explicitFamilyName);
  }

  const baseName = normalizeHumanName(args.parentName ?? args.studentName);
  if (!baseName) {
    throw new ConvexError("Family name could not be generated");
  }

  return `${baseName} Family`;
}

export const updatePortalUserAuthIdInternal = internalMutation({
  args: {
    userId: v.id("users"),
    schoolId: v.id("schools"),
    authId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.schoolId !== args.schoolId) {
      throw new ConvexError("User not found");
    }

    await ctx.db.patch(args.userId, {
      authId: args.authId,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const getPortalUserInternal = internalQuery({
  args: {
    userId: v.id("users"),
    schoolId: v.id("schools"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      authId: v.string(),
      role: v.union(
        v.literal("student"),
        v.literal("parent"),
        v.literal("teacher"),
        v.literal("admin")
      ),
      isArchived: v.union(v.boolean(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.schoolId !== args.schoolId) {
      return null;
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      authId: user.authId,
      role: user.role,
      isArchived: user.isArchived ?? null,
    };
  },
});

async function findParentUsersByEmail(
  ctx: any,
  schoolId: Id<"schools">,
  email: string
) {
  return await ctx.db
    .query("users")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .filter((q: any) => q.eq(q.field("email"), email))
    .collect();
}

async function findFamiliesForParentUser(
  ctx: any,
  schoolId: Id<"schools">,
  parentUserId: Id<"users">
) {
  const familyLinks = await ctx.db
    .query("familyMembers")
    .withIndex("by_parent_user", (q: any) => q.eq("parentUserId", parentUserId))
    .collect();

  const families = await Promise.all(
    familyLinks.map(async (familyLink: any) => {
      const family = await ctx.db.get(familyLink.familyId);
      if (!family || family.schoolId !== schoolId) {
        return null;
      }

      return {
        ...family,
        familyLink,
      };
    })
  );

  return families
    .filter((family: any) => family && !family.isArchived)
    .sort((a: any, b: any) => a.createdAt - b.createdAt);
}

async function getFamilyMembers(
  ctx: any,
  familyId: Id<"families">
) {
  return await ctx.db
    .query("familyMembers")
    .withIndex("by_family", (q: any) => q.eq("familyId", familyId))
    .collect();
}

async function getStudentsForFamily(ctx: any, familyId: Id<"families">) {
  return await ctx.db
    .query("students")
    .withIndex("by_family", (q: any) => q.eq("familyId", familyId))
    .collect();
}

async function findReusableOrphanFamilyByName(
  ctx: any,
  schoolId: Id<"schools">,
  familyName: string
) {
  const matches = await ctx.db
    .query("families")
    .withIndex("by_school_and_name", (q: any) =>
      q.eq("schoolId", schoolId).eq("name", familyName)
    )
    .collect();

  const orphanFamilies = [] as any[];

  for (const family of matches) {
    const [members, students] = await Promise.all([
      getFamilyMembers(ctx, family._id),
      getStudentsForFamily(ctx, family._id),
    ]);

    const activeStudents = students.filter((student: any) => !student.isArchived);
    if (members.length === 0 && activeStudents.length > 0) {
      orphanFamilies.push(family);
    }
  }

  return orphanFamilies.length === 1 ? orphanFamilies[0] : null;
}

async function deleteFamilyIfEmpty(ctx: any, familyId: Id<"families">) {
  const [members, students] = await Promise.all([
    getFamilyMembers(ctx, familyId),
    getStudentsForFamily(ctx, familyId),
  ]);

  const activeStudents = students.filter((student: any) => !student.isArchived);
  if (members.length === 0 && activeStudents.length === 0) {
    await ctx.db.delete(familyId);
  }
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
    const existingStudents = await findStudentsByAdmissionNumber(
      ctx,
      schoolId,
      admissionNumber
    );
    const activeDuplicate = existingStudents.find(
      (student: any) => !student.isArchived
    );
    const archivedDuplicate = existingStudents.find(
      (student: any) => student.isArchived
    );

    if (activeDuplicate) {
      throw new ConvexError("A student with this admission number already exists");
    }

    if (archivedDuplicate) {
      throw new ConvexError(archivedRecordNotice("student"));
    }

    const duplicateStudentUser = await findStudentUserByAdmissionNumber(
      ctx,
      schoolId,
      admissionNumber
    );
    if (duplicateStudentUser) {
      throw new ConvexError(
        duplicateStudentUser.isArchived
          ? archivedRecordNotice("student")
          : "A student with this admission number already exists"
      );
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
        .filter((student) => !student.isArchived)
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
    if (!student || student.schoolId !== schoolId || student.isArchived) {
      throw new ConvexError("Student not found");
    }
    const studentUser = await ctx.db.get(student.userId);
    if (
      !studentUser ||
      studentUser.schoolId !== schoolId ||
      studentUser.isArchived
    ) {
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
      const existingStudents = await findStudentsByAdmissionNumber(
        ctx,
        schoolId,
        nextAdmissionNumber
      );
      const duplicateStudent = existingStudents.find(
        (candidate: any) => candidate._id !== args.studentId
      );

      if (duplicateStudent) {
        throw new ConvexError(
          duplicateStudent.isArchived
            ? archivedRecordNotice("student")
            : "A student with this admission number already exists"
        );
      }

      const duplicateStudentUser = await findStudentUserByAdmissionNumber(
        ctx,
        schoolId,
        nextAdmissionNumber
      );
      if (
        duplicateStudentUser &&
        duplicateStudentUser._id !== student.userId
      ) {
        throw new ConvexError(
          duplicateStudentUser.isArchived
            ? archivedRecordNotice("student")
            : "A student with this admission number already exists"
        );
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
      ...(student.familyId ? { familyId: student.familyId } : {}),
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
    userId: v.id("users"),
    email: v.string(),
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
    if (!student || student.schoolId !== schoolId || student.isArchived) {
      throw new ConvexError("Student not found");
    }

    const [studentUser, classDoc, photoUrl] = await Promise.all([
      ctx.db.get(student.userId),
      ctx.db.get(student.classId),
      student.photoStorageId ? ctx.storage.getUrl(student.photoStorageId) : null,
    ]);

    if (
      !studentUser ||
      studentUser.schoolId !== schoolId ||
      studentUser.isArchived
    ) {
      throw new ConvexError("Student account not found");
    }

    if (!classDoc || classDoc.schoolId !== schoolId) {
      throw new ConvexError("Student class not found");
    }

    const studentName = getReadableUserName(studentUser);

    return {
      _id: student._id,
      userId: studentUser._id,
      email: studentUser.email,
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

async function archiveStudentRecord(
  ctx: any,
  args: {
    studentId: Id<"students">;
    actingUserId: Id<"users">;
    schoolId: Id<"schools">;
  }
) {
  const student = await ctx.db.get(args.studentId);
  if (!student || student.schoolId !== args.schoolId) {
    throw new ConvexError("Cross-school access denied");
  }

  const studentUser = await ctx.db.get(student.userId);
  if (
    !studentUser ||
    studentUser.schoolId !== args.schoolId ||
    studentUser.isArchived
  ) {
    throw new ConvexError("Student account not found");
  }

  if (student.isArchived) {
    throw new ConvexError("Student is already archived");
  }

  const now = Date.now();
  await ctx.db.patch(args.studentId, {
    isArchived: true,
    archivedAt: now,
    archivedBy: args.actingUserId,
    updatedAt: now,
  });
  await ctx.db.patch(student.userId, {
    isArchived: true,
    archivedAt: now,
    archivedBy: args.actingUserId,
    updatedAt: now,
  });
}

export const archiveStudent = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    await archiveStudentRecord(ctx, {
      studentId: args.studentId,
      actingUserId: userId,
      schoolId,
    });
    return null;
  },
});

export const deleteStudent = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    await archiveStudentRecord(ctx, {
      studentId: args.studentId,
      actingUserId: userId,
      schoolId,
    });
    return null;
  },
});

export const restoreStudent = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId) {
      throw new ConvexError("Student not found");
    }

    const studentUser = await ctx.db.get(student.userId);
    if (!studentUser || studentUser.schoolId !== schoolId) {
      throw new ConvexError("Student account not found");
    }

    if (!student.isArchived) {
      throw new ConvexError("Student is not archived");
    }

    const duplicateStudents = await findStudentsByAdmissionNumber(
      ctx,
      schoolId,
      student.admissionNumber
    );
    const activeStudentDuplicate = duplicateStudents.find(
      (candidate: any) =>
        candidate._id !== args.studentId && !candidate.isArchived
    );
    if (activeStudentDuplicate) {
      throw new ConvexError(
        "Restore blocked because an active student already uses this admission number."
      );
    }

    const studentUserDuplicate = await findStudentUserByAdmissionNumber(
      ctx,
      schoolId,
      student.admissionNumber
    );
    if (
      studentUserDuplicate &&
      studentUserDuplicate._id !== student.userId &&
      !studentUserDuplicate.isArchived
    ) {
      throw new ConvexError(
        "Restore blocked because an active student account already uses this admission number."
      );
    }

    const now = Date.now();
    await ctx.db.patch(args.studentId, {
      isArchived: false,
      updatedAt: now,
    });
    await ctx.db.patch(student.userId, {
      isArchived: false,
      updatedAt: now,
    });

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
    if (!student || student.schoolId !== schoolId || student.isArchived) {
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
    if (!student || student.schoolId !== schoolId || student.isArchived) {
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
      .filter((student) => !student.isArchived)
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

async function loadStudentFamilyProfile(
  ctx: any,
  schoolId: Id<"schools">,
  studentId: Id<"students">
) {
  const student = await ctx.db.get(studentId);
  if (!student || student.schoolId !== schoolId || student.isArchived) {
    throw new ConvexError("Student not found");
  }

  if (!student.familyId) {
    return {
      family: null,
      parents: [],
      students: [],
    };
  }

  const family = await ctx.db.get(student.familyId);
  if (!family || family.schoolId !== schoolId) {
    return {
      family: null,
      parents: [],
      students: [],
    };
  }

  const familyMembers = await getFamilyMembers(ctx, family._id);
  const parentRows = await Promise.all(
    familyMembers.map(async (familyMember: any) => {
      const parentUser = await ctx.db.get(familyMember.parentUserId);
      if (
        !parentUser ||
        parentUser.schoolId !== schoolId ||
        parentUser.isArchived ||
        parentUser.role !== "parent"
      ) {
        return null;
      }

      const parentName = getReadableUserName(parentUser);
      return {
        _id: familyMember._id,
        parentUserId: parentUser._id,
        name: parentName.displayName || "Unnamed Parent",
        firstName: parentName.firstName,
        lastName: parentName.lastName,
        email: parentUser.email,
        phone: parentUser.phone ?? null,
        relationship: familyMember.relationship ?? null,
        isPrimaryContact: familyMember.isPrimaryContact,
      };
    })
  );

  const parents = parentRows
    .filter((parent): parent is NonNullable<typeof parent> => Boolean(parent))
    .sort((a, b) => a.name.localeCompare(b.name));

  const familyStudents = await ctx.db
    .query("students")
    .withIndex("by_family", (q: any) => q.eq("familyId", family._id))
    .collect();

  const activeStudents = familyStudents.filter((familyStudent: any) => !familyStudent.isArchived);
  const classIds = [...new Set(activeStudents.map((familyStudent: any) => String(familyStudent.classId)))];
  const classDocs = await Promise.all(
    classIds.map(async (classId) => ctx.db.get(classId as Id<"classes">))
  );
  const classNameById = new Map<string, string>();
  for (const classDoc of classDocs) {
    if (!classDoc || classDoc.schoolId !== schoolId) {
      continue;
    }

    classNameById.set(String(classDoc._id), normalizeHumanName(classDoc.name));
  }

  const students = await Promise.all(
    activeStudents
      .sort((a: any, b: any) => a.admissionNumber.localeCompare(b.admissionNumber))
      .map(async (familyStudent: any) => {
        const familyStudentUser = await ctx.db.get(familyStudent.userId);
        const studentName = getReadableUserName(familyStudentUser);
        return {
          _id: familyStudent._id,
          studentName: studentName.displayName || "Unnamed Student",
          admissionNumber: familyStudent.admissionNumber,
          classId: familyStudent.classId,
          className:
            classNameById.get(String(familyStudent.classId)) ?? "Unknown class",
        };
      })
  );

  return {
    family: {
      _id: family._id,
      name: family.name,
      studentCount: students.length,
      parentCount: parents.length,
    },
    parents,
    students,
  };
}

export const getStudentFamilyProfile = query({
  args: { studentId: v.id("students") },
  returns: v.object({
    family: v.union(
      v.null(),
      v.object({
        _id: v.id("families"),
        name: v.string(),
        studentCount: v.number(),
        parentCount: v.number(),
      })
    ),
    parents: v.array(
      v.object({
        _id: v.id("familyMembers"),
        parentUserId: v.id("users"),
        name: v.string(),
        firstName: v.union(v.string(), v.null()),
        lastName: v.union(v.string(), v.null()),
        email: v.string(),
        phone: v.union(v.string(), v.null()),
        relationship: v.union(v.string(), v.null()),
        isPrimaryContact: v.boolean(),
      })
    ),
    students: v.array(
      v.object({
        _id: v.id("students"),
        studentName: v.string(),
        admissionNumber: v.string(),
        classId: v.id("classes"),
        className: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    return await loadStudentFamilyProfile(ctx, schoolId, args.studentId);
  },
});

export const upsertStudentFamilyLink = mutation({
  args: {
    studentId: v.id("students"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.union(v.string(), v.null())),
    relationship: v.optional(v.union(v.string(), v.null())),
    familyName: v.optional(v.union(v.string(), v.null())),
    isPrimaryContact: v.optional(v.boolean()),
  },
  returns: v.object({
    familyId: v.id("families"),
    parentUserId: v.id("users"),
    familyMemberId: v.id("familyMembers"),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId || student.isArchived) {
      throw new ConvexError("Student not found");
    }

    const studentUser = await ctx.db.get(student.userId);
    if (!studentUser || studentUser.schoolId !== schoolId || studentUser.isArchived) {
      throw new ConvexError("Student account not found");
    }

    const normalizedEmail = normalizeOptionalEmail(args.email);
    if (!normalizedEmail) {
      throw new ConvexError("Parent email is required");
    }

    const normalizedPhone = normalizeOptionalPhone(args.phone);
    const parentName = resolveStoredUserNameFields({
      firstName: args.firstName,
      lastName: args.lastName,
      requiredMessage: "Parent first and last name are required",
    });
    const relationship = normalizeOptionalText(args.relationship)
      ? normalizeHumanName(normalizeOptionalText(args.relationship) as string)
      : undefined;
    const now = Date.now();

    const matchingUsers = await findParentUsersByEmail(ctx, schoolId, normalizedEmail);
    const archivedDuplicate = matchingUsers.find((candidate: any) => candidate.isArchived);
    if (archivedDuplicate) {
      throw new ConvexError(archivedRecordNotice("parent"));
    }

    let parentUser = matchingUsers.find((candidate: any) => !candidate.isArchived);
    if (parentUser && parentUser.role !== "parent") {
      throw new ConvexError("A user with this email already exists");
    }

    if (!parentUser) {
      const parentUserId = await ctx.db.insert("users", {
        schoolId,
        authId: `parent:${String(schoolId)}:${normalizedEmail}`,
        name: parentName.name,
        ...(parentName.firstName ? { firstName: parentName.firstName } : {}),
        ...(parentName.lastName ? { lastName: parentName.lastName } : {}),
        email: normalizedEmail,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
        role: "parent",
        createdAt: now,
        updatedAt: now,
      });
      parentUser = await ctx.db.get(parentUserId);
    } else {
      const nextParentRecord: Record<string, unknown> = {
        updatedAt: now,
        name: parentName.name,
        email: normalizedEmail,
      };

      if (parentName.firstName) {
        nextParentRecord.firstName = parentName.firstName;
      }
      if (parentName.lastName) {
        nextParentRecord.lastName = parentName.lastName;
      }
      if (normalizedPhone !== undefined) {
        nextParentRecord.phone = normalizedPhone;
      }

      await ctx.db.patch(parentUser._id, nextParentRecord as any);
      parentUser = {
        ...parentUser,
        ...nextParentRecord,
      } as any;
    }

    if (!parentUser) {
      throw new ConvexError("Parent record could not be created");
    }

    const studentName = getReadableUserName(studentUser);
    let familyId = student.familyId;
    let familyDoc: any = null;

    if (familyId) {
      familyDoc = await ctx.db.get(familyId);
      if (!familyDoc || familyDoc.schoolId !== schoolId) {
        throw new ConvexError("Family not found");
      }
    } else {
      const familyName = buildFamilyName({
        studentName: studentName.displayName || studentUser.name,
        parentName: parentName.name,
        familyName: args.familyName,
      });
      const parentFamilies = await findFamiliesForParentUser(ctx, schoolId, parentUser._id);
      if (parentFamilies.length > 0) {
        familyDoc = parentFamilies[0];
        familyId = familyDoc._id;
      } else {
        const reusableOrphanFamily = await findReusableOrphanFamilyByName(
          ctx,
          schoolId,
          familyName
        );
        if (reusableOrphanFamily) {
          familyDoc = reusableOrphanFamily;
          familyId = reusableOrphanFamily._id;
        } else {
          familyId = await ctx.db.insert("families", {
            schoolId,
            name: familyName,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
          });
          familyDoc = await ctx.db.get(familyId);
        }
      }
    }

    if (!familyDoc) {
      throw new ConvexError("Family could not be created");
    }

    const familyNameOverride = normalizeOptionalText(args.familyName);
    if (familyNameOverride && normalizeHumanName(familyNameOverride) !== familyDoc.name) {
      await ctx.db.patch(familyDoc._id, {
        name: normalizeHumanName(familyNameOverride),
        updatedAt: now,
        updatedBy: userId,
      });
      familyDoc = await ctx.db.get(familyDoc._id);
    }

    if (!familyDoc) {
      throw new ConvexError("Family could not be updated");
    }

    if (!student.familyId || String(student.familyId) !== String(familyDoc._id)) {
      await ctx.db.patch(student._id, {
        familyId: familyDoc._id,
        updatedAt: now,
      });
    }

    const familyMembers = await getFamilyMembers(ctx, familyDoc._id);
    const existingLink = familyMembers.find(
      (familyMember: any) => String(familyMember.parentUserId) === String(parentUser._id)
    );
    const nextIsPrimaryContact =
      args.isPrimaryContact ??
      (familyMembers.length === 0 && !existingLink ? true : existingLink?.isPrimaryContact ?? false);

    if (nextIsPrimaryContact) {
      for (const familyMember of familyMembers) {
        if (String(familyMember._id) === String(existingLink?._id)) {
          continue;
        }
        if (familyMember.isPrimaryContact) {
          await ctx.db.patch(familyMember._id, {
            isPrimaryContact: false,
            updatedAt: now,
            updatedBy: userId,
          });
        }
      }
    }

    if (existingLink) {
      await ctx.db.patch(existingLink._id, {
        relationship,
        isPrimaryContact: nextIsPrimaryContact,
        updatedAt: now,
        updatedBy: userId,
      });

      return {
        familyId: familyDoc._id,
        parentUserId: parentUser._id,
        familyMemberId: existingLink._id,
      };
    }

    const familyMemberId = await ctx.db.insert("familyMembers", {
      schoolId,
      familyId: familyDoc._id,
      parentUserId: parentUser._id,
      relationship,
      isPrimaryContact: nextIsPrimaryContact,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    });

    return {
      familyId: familyDoc._id,
      parentUserId: parentUser._id,
      familyMemberId,
    };
  },
});

export const unlinkStudentFromFamily = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { schoolId, role, userId } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId || student.isArchived) {
      throw new ConvexError("Student not found");
    }

    if (!student.familyId) {
      return null;
    }

    const familyId = student.familyId;
    await ctx.db.patch(student._id, {
      familyId: undefined,
      updatedAt: Date.now(),
    });

    await deleteFamilyIfEmpty(ctx, familyId);
    return null;
  },
});

export const removeStudentFamilyLink = mutation({
  args: { familyMemberId: v.id("familyMembers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const familyMember = await ctx.db.get(args.familyMemberId);
    if (!familyMember || familyMember.schoolId !== schoolId) {
      throw new ConvexError("Family link not found");
    }

    const family = await ctx.db.get(familyMember.familyId);
    if (!family || family.schoolId !== schoolId) {
      throw new ConvexError("Family not found");
    }

    const [remainingMembersBeforeDelete, linkedStudents] = await Promise.all([
      getFamilyMembers(ctx, family._id),
      getStudentsForFamily(ctx, family._id),
    ]);
    const activeStudents = linkedStudents.filter((student: any) => !student.isArchived);

    if (remainingMembersBeforeDelete.length === 1 && activeStudents.length > 0) {
      throw new ConvexError(
        "Cannot remove the last parent from a family that still has linked students. Unlink the student from the family instead."
      );
    }

    const wasPrimaryContact = familyMember.isPrimaryContact;
    await ctx.db.delete(args.familyMemberId);

    if (wasPrimaryContact) {
      const remainingMembers = await getFamilyMembers(ctx, family._id);
      const nextPrimaryMember = remainingMembers.find((member: any) => member.isPrimaryContact);
      if (!nextPrimaryMember && remainingMembers.length > 0) {
        await ctx.db.patch(remainingMembers[0]._id, {
          isPrimaryContact: true,
          updatedAt: Date.now(),
          updatedBy: userId,
        });
      }
    }

    await deleteFamilyIfEmpty(ctx, family._id);
    return null;
  },
});

type PortalCredentialProvisionResult = {
  userId: Id<"users">;
  email: string;
  temporaryPassword: string;
};

type PortalUserRecord = {
  _id: Id<"users">;
  name: string;
  email: string;
  authId: string;
  role: "student" | "parent" | "teacher" | "admin";
  isArchived: boolean | null;
};

async function upsertPortalCredentialsHandler(
  ctx: any,
  args: {
    userId: Id<"users">;
    temporaryPassword: string;
  }
): Promise<PortalCredentialProvisionResult> {
  const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {});
  if (!viewer) {
    throw new ConvexError("Unauthorized");
  }
  if (viewer.isSchoolAdmin !== true) {
    throw new ConvexError("Admin access required");
  }

  const targetUser = (await ctx.runQuery(
    (internal as any).functions.academic.studentEnrollment.getPortalUserInternal,
    {
      userId: args.userId,
      schoolId: viewer.schoolId,
    }
  )) as PortalUserRecord | null;

  if (!targetUser || targetUser.isArchived) {
    throw new ConvexError("User not found");
  }

  if (targetUser.role !== "student" && targetUser.role !== "parent") {
    throw new ConvexError(
      "Portal credentials are only available for students and parents"
    );
  }

  const normalizedName = resolveStoredUserNameFields({
    name: targetUser.name,
    requiredMessage: "User name is required",
  }).name;
  const normalizedEmail = normalizeOptionalEmail(targetUser.email);
  if (!normalizedEmail) {
    throw new ConvexError(
      "A valid email address is required before portal access can be provisioned"
    );
  }

  const authId = await provisionSchoolPortalAuthUser(ctx, {
    appUserId: String(targetUser._id),
    currentAuthId: targetUser.authId,
    email: normalizedEmail,
    name: normalizedName,
    temporaryPassword: args.temporaryPassword,
  });

  if (authId !== targetUser.authId) {
    await ctx.runMutation(
      (internal as any).functions.academic.studentEnrollment.updatePortalUserAuthIdInternal,
      {
        userId: targetUser._id,
        schoolId: viewer.schoolId,
        authId,
      }
    );
  }

  return {
    userId: targetUser._id,
    email: normalizedEmail,
    temporaryPassword: args.temporaryPassword,
  };
}

export const upsertPortalCredentials = action({
  args: {
    userId: v.id("users"),
    temporaryPassword: v.string(),
  },
  returns: v.object({
    userId: v.id("users"),
    email: v.string(),
    temporaryPassword: v.string(),
  }),
  handler: upsertPortalCredentialsHandler,
});

export const getStudentPortalTargetInternal = internalQuery({
  args: {
    studentId: v.id("students"),
    schoolId: v.id("schools"),
  },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
    })
  ),
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== args.schoolId || student.isArchived) {
      return null;
    }

    return {
      userId: student.userId,
    };
  },
});

const upsertStudentPortalCredentialsByStudentIdHandler = async (
  ctx: any,
  args: {
    studentId: Id<"students">;
    temporaryPassword: string;
  }
): Promise<PortalCredentialProvisionResult> => {
  const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {});
  if (!viewer) {
    throw new ConvexError("Unauthorized");
  }
  if (viewer.isSchoolAdmin !== true) {
    throw new ConvexError("Admin access required");
  }

  const target = (await ctx.runQuery(
    (internal as any).functions.academic.studentEnrollment.getStudentPortalTargetInternal,
    {
      studentId: args.studentId,
      schoolId: viewer.schoolId,
    }
  )) as { userId: Id<"users"> } | null;

  if (!target) {
    throw new ConvexError("Student not found");
  }

  return await upsertPortalCredentialsHandler(ctx, {
    userId: target.userId,
    temporaryPassword: args.temporaryPassword,
  });
};

export const upsertStudentPortalCredentialsByStudentId = action({
  args: {
    studentId: v.id("students"),
    temporaryPassword: v.string(),
  },
  returns: v.object({
    userId: v.id("users"),
    email: v.string(),
    temporaryPassword: v.string(),
  }),
  handler: upsertStudentPortalCredentialsByStudentIdHandler,
});
