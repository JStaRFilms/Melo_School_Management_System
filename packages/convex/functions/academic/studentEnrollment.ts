import {
  assertStorageUnclaimed,
  getUnboundStorageUrl,
  secureUploadUnavailable,
  storageClaimedOnlyBy,
} from "./assetStorageBoundary";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
  type ActionCtx,
} from "../../_generated/server";
import {
  allocateNextAdmissionNumberHelper,
  claimAdmissionNumberHelper,
  commitManualAdmissionNumberHelper,
} from "./admissionNumbers";
import { api, internal } from "../../_generated/api";
import type { Doc, Id, TableNames } from "../../_generated/dataModel";
import schema from "../../schema";
import { schemaReferenceInventory } from "../../schemaCoverage";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { ConvexError } from "convex/values";
import {
  getAuthenticatedSchoolMembership,
  assertAdminForSchool,
} from "./auth";
import {
  teacherHasClassAccess,
} from "./teacherAccess";
import { normalizeHumanName } from "@school/shared/name-format";
import { provisionSchoolPortalAuthUser, prepareSchoolPortalPassword } from "../platform/provisioningHelpers";
import {
  getReadableUserName,
  resolveStoredUserNameFields,
} from "./studentNameCompat";
import { listActiveClassSubjectAggregations } from "./subjectAggregationHelpers";
import { finishFormDraft } from "./drafts";
import { requireCapability } from "./rbac";
import {
  adjustSchoolEnrollmentCount,
  isCurrentEnrollment,
} from "./studentEnrollmentCounts";
import {
  deriveEffectiveSubjectSelectionIds,
  listClassAggregationOptOuts,
  listStudentAggregationOptOuts,
} from "./subjectAggregationSelectionHelpers";
import { getStudentClassForSession, isStudentEnrolledInClassForSession } from "./studentClassMembership";
import { assertBranchDoc } from "../foundation/tenantScope";
import { isEmailAddress } from "../foundation/normalize";
import { studentLoginSuffix } from "./institutionalEmail";

async function activeStudentAssignment(ctx: QueryCtx | MutationCtx, student: Doc<"students">) {
  const sessions = await ctx.db.query("academicSessions")
    .withIndex("by_school_active", q => q.eq("schoolId", student.schoolId).eq("isActive", true)).take(2);
  if (sessions.length > 1) throw new ConvexError("Active academic session configuration requires review");
  return { sessionId: sessions[0]?._id ?? null, classId: sessions[0]
    ? await getStudentClassForSession(ctx, { student, schoolId: student.schoolId, sessionId: sessions[0]._id }) : student.classId };
}

export async function allocateStudentLogin(ctx: MutationCtx, userId: Id<"users">, schoolId: Id<"schools">, admissionNumber: string) {
  const suffix = await studentLoginSuffix(ctx, schoolId);
  const prefix = admissionNumber.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "student";
  const immutablePart = String(userId);
  if (!/^[a-z0-9]+$/.test(immutablePart) || immutablePart.length > 54) throw new ConvexError("Student identifier cannot be allocated");
  const email = `${prefix.slice(0, 63 - immutablePart.length)}.${immutablePart}@${suffix}`;
  if (email.length > 254) throw new ConvexError("Student login domain is too long");
  const [user, platform, mailbox] = await Promise.all([
    ctx.db.query("users").withIndex("by_email", q => q.eq("email", email)).first(),
    ctx.db.query("platformAdmins").withIndex("by_email", q => q.eq("email", email)).first(),
    ctx.db.query("institutionalMailboxes").withIndex("by_email", q => q.eq("email", email)).first(),
  ]);
  if (user || platform || mailbox) throw new ConvexError("Student login identifier is already reserved");
  await ctx.db.patch(userId, { email });
  return email;
}

async function enrollmentIntentFingerprint(intent: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(intent)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  admissionNumber: string,
) {
  return await ctx.db
    .query("students")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .filter((q: any) => q.eq(q.field("admissionNumber"), admissionNumber))
    .collect();
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
  options?: { required?: boolean },
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

async function getValidatedPhotoMetadata(
  _ctx: MutationCtx,
  args: {
    photoStorageId?: Id<"_storage"> | null;
    photoFileName?: string | null;
    photoContentType?: string | null;
  },
): Promise<{ fileName: string; contentType: string } | null> {
  if (
    args.photoStorageId === undefined &&
    (args.photoFileName !== undefined || args.photoContentType !== undefined)
  ) {
    throw new ConvexError("Photo upload metadata is incomplete");
  }

  if (args.photoStorageId === undefined || args.photoStorageId === null) {
    return null;
  }

  return secureUploadUnavailable<{ fileName: string; contentType: string }>();
}

function normalizeOptionalEmail(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }

  if (!isEmailAddress(trimmed)) {
    throw new ConvexError("Enter a valid email address");
  }

  return trimmed;
}

function normalizeOptionalPhone(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes("@") || /[a-zA-Z]/.test(trimmed)) {
    throw new ConvexError(
      "Contact phone number cannot contain letters or email addresses.",
    );
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    throw new ConvexError(
      "Contact phone number must contain between 7 and 15 digits.",
    );
  }

  return trimmed;
}

function buildFamilyName(args: {
  studentName: string;
  parentName?: string;
  familyName?: string | null | undefined;
}) {
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

const portalAccountStateValidator = v.union(v.literal("not_provisioned"), v.literal("provisioning"), v.literal("resetting"), v.literal("provisioned"), v.literal("reconciliation_required"));

async function portalAccountState(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  const evidence = user.portalAccount;
  if (evidence?.state === "provisioning" || evidence?.state === "resetting") return evidence.state;
  if (evidence?.state === "reconciliation_required") return evidence.state;
  if (!evidence) return user.authTokenIdentifier || user.personId || !/^(student:|parent:|migration:)/.test(user.authId)
    ? "reconciliation_required" as const : "not_provisioned" as const;
  if (evidence.authId !== user.authId || evidence.expectedEmail !== user.email || !user.personId || !user.authTokenIdentifier)
    return "reconciliation_required" as const;
  const personId = user.personId;
  const person = await ctx.db.get(personId);
  const memberships = await ctx.db.query("branchMemberships")
    .withIndex("by_person_and_school", q => q.eq("personId", personId).eq("schoolId", user.schoolId)).take(2);
  return person?.status === "active" && person.identityReconciliationState === "resolved" && person.authTokenIdentifier === user.authTokenIdentifier &&
    memberships.length === 1 && memberships[0].status === "active" && memberships[0].legacyUserId === user._id
    ? "provisioned" as const : "reconciliation_required" as const;
}

export const getPortalAccountState = query({
  args: { userId: v.id("users") },
  returns: v.object({ userId: v.id("users"), email: v.string(), state: portalAccountStateValidator }),
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, { capability: "enrollment.intakes.manage" });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);
    const user = await ctx.db.get(args.userId);
    if (!user || user.schoolId !== actor.schoolId || user.isArchived) throw new ConvexError("User not found");
    return { userId: user._id, email: user.email, state: await portalAccountState(ctx, user) };
  },
});

export const beginPortalProvisionInternal = internalMutation({
  args: { userId: v.id("users"), operationId: v.string() },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, { capability: "enrollment.intakes.manage" });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);
    const user = await ctx.db.get(args.userId);
    if (!user || user.schoolId !== actor.schoolId || user.isArchived || (user.role !== "student" && user.role !== "parent"))
      throw new ConvexError("Portal user not found");
    if (user.portalAccount?.state === "provisioning" || user.portalAccount?.state === "resetting")
      throw new ConvexError("A portal operation is already in progress. Review access state before retrying.");
    if (user.portalAccount?.operationId === args.operationId)
      throw new ConvexError("This operation has already run. Reload access state before starting another operation.");
    const state = await portalAccountState(ctx, user);
    const issuer = process.env.CONVEX_SITE_URL?.trim().replace(/\/$/, "");
    if (!issuer) throw new ConvexError("Authentication issuer is not configured");
    const authId = user.portalAccount?.authId ?? user.authId;
    const token = `${issuer}|${authId}`;
    const person = user.personId ? await ctx.db.get(user.personId) : null;
    if ((user.personId && !person) || (person && (person.status !== "active" || (person.authTokenIdentifier && person.authTokenIdentifier !== token))) ||
        (user.authTokenIdentifier && user.authTokenIdentifier !== token))
      throw new ConvexError("Canonical portal identity requires reconciliation before provisioning");
    const matches = await ctx.db.query("persons").withIndex("by_token_identifier", q => q.eq("authTokenIdentifier", token)).take(2);
    if (matches.length > 1 || (matches[0] && matches[0]._id !== user.personId))
      throw new ConvexError("Authentication identity belongs to another canonical person");
    await ctx.db.patch(user._id, {
      portalAccount: { state: state === "provisioned" ? "resetting" : "provisioning", operationId: args.operationId,
        expectedEmail: user.email, expectedAuthId: user.authId, ...(user.portalAccount?.authId ? { authId: user.portalAccount.authId } : {}), updatedAt: Date.now() },
    });
    return { userId: user._id, schoolId: user.schoolId, name: getReadableUserName(user).displayName, email: user.email,
      authId: user.portalAccount?.authId ?? user.authId };
  },
});

export const recordPortalAuthInternal = internalMutation({
  args: { userId: v.id("users"), schoolId: v.id("schools"), operationId: v.string(), authId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.schoolId !== args.schoolId || user.portalAccount?.operationId !== args.operationId)
      throw new ConvexError("Portal operation changed");
    await ctx.db.patch(user._id, { portalAccount: { ...user.portalAccount, authId: args.authId, updatedAt: Date.now() } });
  },
});

export const finishPortalProvisionInternal = internalMutation({
  args: { userId: v.id("users"), schoolId: v.id("schools"), operationId: v.string(), authId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, { capability: "enrollment.intakes.manage" });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);
    const user = await ctx.db.get(args.userId);
    if (!user || user.schoolId !== args.schoolId || actor.schoolId !== args.schoolId || user.portalAccount?.operationId !== args.operationId)
      throw new ConvexError("Portal operation changed");
    const evidence = user.portalAccount;
    if (!args.authId) {
      await ctx.db.patch(user._id, { portalAccount: { ...evidence, state: "reconciliation_required", updatedAt: Date.now() } });
      return null;
    }
    if (user.isArchived || (user.role !== "student" && user.role !== "parent") || user.email !== evidence.expectedEmail || user.authId !== evidence.expectedAuthId)
      throw new ConvexError("Portal identity changed during provisioning");
    const issuer = process.env.CONVEX_SITE_URL?.trim().replace(/\/$/, "");
    if (!issuer) throw new ConvexError("Authentication issuer is not configured");
    const authId = args.authId;
    const token = `${issuer}|${authId}`;
    const [people, authUsers] = await Promise.all([
      ctx.db.query("persons").withIndex("by_token_identifier", q => q.eq("authTokenIdentifier", token)).take(2),
      ctx.db.query("users").withIndex("by_auth", q => q.eq("authId", authId)).take(101),
    ]);
    if (people.length > 1 || authUsers.length > 100 || authUsers.some(entry => entry._id !== user._id && (!user.personId || entry.personId !== user.personId)))
      throw new ConvexError("Authentication identity belongs to another user");
    const linkedPerson = user.personId ? await ctx.db.get(user.personId) : null;
    if ((user.personId && !linkedPerson) || (user.authTokenIdentifier && user.authTokenIdentifier !== token) ||
        (linkedPerson && (linkedPerson.status !== "active" || (linkedPerson.authTokenIdentifier && linkedPerson.authTokenIdentifier !== token))) ||
        (people[0] && people[0]._id !== user.personId))
      throw new ConvexError("Canonical identity requires reconciliation");
    const now = Date.now();
    const personId = linkedPerson?._id ?? await ctx.db.insert("persons", {
      name: user.name, firstName: user.firstName, middleName: user.middleName, lastName: user.lastName,
      email: user.email, authTokenIdentifier: token, identityReconciliationState: "resolved",
      status: "active", primarySchoolId: user.schoolId, createdAt: now, updatedAt: now,
    });
    if (linkedPerson) await ctx.db.patch(personId, { authTokenIdentifier: token, identityReconciliationState: "resolved", updatedAt: now });
    const memberships = await ctx.db.query("branchMemberships")
      .withIndex("by_person_and_school", q => q.eq("personId", personId).eq("schoolId", user.schoolId)).take(2);
    if (memberships.length > 1 || (memberships[0] && (memberships[0].legacyUserId !== user._id || memberships[0].status !== "active")))
      throw new ConvexError("Portal branch membership requires reconciliation");
    if (!memberships.length) await ctx.db.insert("branchMemberships", {
      personId, schoolId: user.schoolId, status: "active", isDefaultBranch: true, legacyUserId: user._id, joinedAt: now, updatedAt: now,
    });
    await ctx.db.patch(user._id, { authId: args.authId, authTokenIdentifier: token, personId, updatedAt: now,
      portalAccount: { ...evidence, state: "provisioned", authId: args.authId, updatedAt: now } });
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
        v.literal("staff"),
        v.literal("admin"),
      ),
      isArchived: v.union(v.boolean(), v.null()),
    }),
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

async function findUsersByEmail(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  email: string,
) {
  return await ctx.db
    .query("users")
    .withIndex("by_school_and_email", q => q.eq("schoolId", schoolId).eq("email", email))
    .take(3);
}

async function findFamiliesForParentUser(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  parentUserId: Id<"users">,
) {
  const familyLinks = await ctx.db
    .query("familyMembers")
    .withIndex("by_parent_user", q => q.eq("parentUserId", parentUserId))
    .take(21);
  if (familyLinks.length > 20) throw new ConvexError("Contact households require bounded operator review");

  const families = await Promise.all(
    familyLinks.map(async (familyLink) => {
      const family = await ctx.db.get(familyLink.familyId);
      if (!family || family.schoolId !== schoolId || familyLink.schoolId !== schoolId) {
        return null;
      }

      return {
        ...family,
        familyLink,
      };
    }),
  );

  return families
    .filter((family): family is NonNullable<typeof family> => family !== null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

async function summarizeFamiliesForParentUser(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  parentUserId: Id<"users">,
) {
  const families = await findFamiliesForParentUser(ctx, schoolId, parentUserId);
  return await Promise.all(
    families.map(async (family) => {
      const [members, students] = await Promise.all([
        getFamilyMembers(ctx, family._id),
        getStudentsForFamily(ctx, family._id),
      ]);

      const activeStudents = students.filter(
        (student: any) => !student.isArchived,
      );
      const primaryMembers = members.filter(member => member.isPrimaryContact && member.schoolId === schoolId);
      const primaryUser = primaryMembers.length === 1 ? await ctx.db.get(primaryMembers[0].parentUserId) : null;
      return {
        _id: family._id,
        name: family.name,
        residentialAddress: family.residentialAddress ?? null,
        contactAddressMode: family.familyLink.addressMode ?? null,
        contactAddressOverride: family.familyLink.addressOverride ?? null,
        contactAddress: family.familyLink.addressMode === "residential" ? family.residentialAddress ?? null : family.familyLink.addressOverride ?? null,
        contactAddressSource: family.familyLink.addressMode ?? ("legacy" as const),
        primaryContact: primaryUser && primaryUser.schoolId === schoolId && !primaryUser.isArchived && primaryUser.role !== "student"
          ? { userId: primaryUser._id, name: getReadableUserName(primaryUser).displayName, phone: primaryUser.phone ?? null, email: primaryUser.email } : null,
        studentCount: activeStudents.length,
        parentCount: members.length,
      };
    }),
  );
}

async function getFamilyMembers(ctx: QueryCtx | MutationCtx, familyId: Id<"families">) {
  const rows = await ctx.db
    .query("familyMembers")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .take(101);
  if (rows.length > 100) throw new ConvexError("Household size requires bounded operator review");
  const family = await ctx.db.get(familyId);
  if (!family || rows.some(row => row.schoolId !== family.schoolId)) throw new ConvexError("Household member scope requires review");
  return rows;
}

async function getStudentsForFamily(ctx: QueryCtx | MutationCtx, familyId: Id<"families">) {
  const rows = await ctx.db
    .query("students")
    .withIndex("by_family", (q) => q.eq("familyId", familyId))
    .take(101);
  if (rows.length > 100) throw new ConvexError("Household size requires bounded operator review");
  return rows;
}

async function deleteFamilyIfEmpty(ctx: MutationCtx, familyId: Id<"families">) {
  const [members, students] = await Promise.all([
    getFamilyMembers(ctx, familyId),
    getStudentsForFamily(ctx, familyId),
  ]);

  if (members.length === 0 && students.length === 0) {
    // Unlinking must retain a household referenced by admissions or reviewed imports.
    try { await assertNoRetainedReferences(ctx, String(familyId), "families"); }
    catch (error) { if (error instanceof ConvexError) return; throw error; }
    await ctx.db.delete(familyId);
  }
}

export async function createCanonicalStudentEnrollmentHelper(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    classId: Id<"classes">;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    name: string;
    admissionNumber: string;
    gender?: string;
    dateOfBirth?: number;
    guardianName?: string;
    guardianPhone?: string;
    address?: string;
    houseName?: string;
    photo?: {
      storageId: Id<"_storage">;
      fileName: string;
      contentType: string;
      sourceApplicationId?: Id<"admissionsApplications">;
      sourceDocumentId?: Id<"admissionsDocuments">;
    };
    sourceApplicationId?: Id<"admissionsApplications">;
    overrideReason?: string;
    overrideConfirmed?: boolean;
    overrideCounterDecision?: "keep" | "advance";
    advanceCounterTo?: number;
    numberingVersion?: number;
    numberingFormatVersion?: string;
    numberingCounterKey?: string;
    numberingCounterVersion?: number;
    numberingSessionId?: Id<"academicSessions">;
    numberingResetPeriod?: string;
    requestedByUserId?: Id<"users">;
  },
) {
  const classDoc = await ctx.db.get(args.classId);
  if (!classDoc || classDoc.schoolId !== args.schoolId || classDoc.isArchived) {
    throw new ConvexError("Selected class is not available");
  }
  if (args.sourceApplicationId) {
    const existingOrigin = await ctx.db.query("students")
      .withIndex("by_source_application", (query) => query.eq("sourceApplicationId", args.sourceApplicationId))
      .take(2);
    if (existingOrigin.length) throw new ConvexError("Application is already linked to a student");
  }
  let admissionNumber = args.admissionNumber.trim();
  if (admissionNumber) {
    const numberingPolicy = await ctx.db.query("admissionNumberPolicies")
      .withIndex("by_school", (query) => query.eq("schoolId", args.schoolId)).unique();
    if (numberingPolicy) {
      await commitManualAdmissionNumberHelper(ctx, {
        schoolId: args.schoolId,
        number: admissionNumber,
        level: classDoc.level,
        reason: args.overrideReason,
        confirmed: args.overrideConfirmed,
        counterDecision: args.overrideCounterDecision,
        advanceTo: args.advanceCounterTo,
        expectedVersion: args.numberingVersion,
        expectedFormatVersion: args.numberingFormatVersion,
        expectedCounterKey: args.numberingCounterKey,
        expectedCounterVersion: args.numberingCounterVersion,
        expectedSessionId: args.numberingSessionId,
        expectedResetPeriod: args.numberingResetPeriod,
        ...(args.requestedByUserId ? { requestedByUserId: args.requestedByUserId } : {}),
      });
    } else {
      await claimAdmissionNumberHelper(ctx, args.schoolId, admissionNumber);
    }
  } else {
    if (args.numberingVersion === undefined || !args.numberingFormatVersion || !args.numberingCounterKey ||
        args.numberingCounterVersion === undefined || args.numberingSessionId === undefined || !args.numberingResetPeriod) {
      throw new ConvexError("Automatic admission numbering requires the complete reviewed policy, counter, session, and reset-period context");
    }
    const allocation = await allocateNextAdmissionNumberHelper(ctx, {
      schoolId: args.schoolId,
      level: classDoc.level,
      expectedVersion: args.numberingVersion,
      expectedFormatVersion: args.numberingFormatVersion,
      expectedCounterKey: args.numberingCounterKey,
      expectedCounterVersion: args.numberingCounterVersion,
      expectedSessionId: args.numberingSessionId,
      expectedResetPeriod: args.numberingResetPeriod,
    });
    admissionNumber = allocation.allocatedNumber;
  }
  const duplicates = await ctx.db.query("students")
    .withIndex("by_school_and_admission_number", (query) => query.eq("schoolId", args.schoolId).eq("admissionNumber", admissionNumber))
    .take(2);
  if (duplicates.length) throw new ConvexError(duplicates.some((student) => !student.isArchived) ? "A student with this admission number already exists" : archivedRecordNotice("student"));
  const authId = `student:pending:${crypto.randomUUID()}`;
  const studentEmail = "pending@student.invalid";
  const now = Date.now();
  const nameFields = resolveStoredUserNameFields(args);
  const studentUserId = await ctx.db.insert("users", {
    schoolId: args.schoolId,
    authId,
    ...nameFields,
    email: studentEmail,
    role: "student",
    createdAt: now,
    updatedAt: now,
  });
  await allocateStudentLogin(ctx, studentUserId, args.schoolId, admissionNumber);
  await ctx.db.patch(studentUserId, { authId: `student:${args.schoolId}:${studentUserId}` });
  const studentId = await ctx.db.insert("students", {
    schoolId: args.schoolId,
    classId: args.classId,
    userId: studentUserId,
    admissionNumber,
    ...(args.gender ? { gender: args.gender } : {}),
    ...(args.dateOfBirth ? { dateOfBirth: args.dateOfBirth } : {}),
    ...(args.guardianName ? { guardianName: args.guardianName } : {}),
    ...(args.guardianPhone ? { guardianPhone: args.guardianPhone } : {}),
    ...(args.address ? { address: args.address } : {}),
    ...(args.houseName ? { houseName: args.houseName } : {}),
    ...(args.sourceApplicationId ? { sourceApplicationId: args.sourceApplicationId } : {}),
    ...(args.photo ? {
      photoStorageId: args.photo.storageId,
      photoFileName: args.photo.fileName,
      photoContentType: args.photo.contentType,
      photoUpdatedAt: now,
      ...(args.photo.sourceApplicationId && args.photo.sourceDocumentId ? {
        photoProvenance: "application_upload" as const,
        photoSourceDocumentId: args.photo.sourceDocumentId,
        photoRetentionHold: true,
      } : { photoProvenance: "school_upload" as const }),
    } : {}),
    createdAt: now,
    updatedAt: now,
  });
  // Canonical creation path: every caller (manual enrollment, admissions
  // conversion) counts the new student here. adjust is a no-op until the
  // platform backfill initializes the school's counter row.
  await adjustSchoolEnrollmentCount(ctx, args.schoolId, 1);
  return { studentId, studentUserId, admissionNumber };
}

function contactAddressPatch(
  args: { addressMode?: "residential" | "different"; addressOverride?: string | null },
  existing?: Doc<"familyMembers">,
): Pick<Doc<"familyMembers">, "addressMode" | "addressOverride"> {
  if (args.addressMode === undefined && args.addressOverride === undefined)
    return existing ? { addressMode: existing.addressMode, addressOverride: existing.addressOverride } : { addressMode: "residential" };
  const mode = args.addressMode ?? existing?.addressMode;
  if (!mode) throw new ConvexError("Choose same residential address or different address");
  const addressOverride = mode === "different" ? normalizeOptionalText(args.addressOverride === undefined ? existing?.addressOverride : args.addressOverride) : undefined;
  if (mode === "different" && !addressOverride) throw new ConvexError("Enter the different contact address");
  return { addressMode: mode, addressOverride };
}

const parentGuardianValidator = v.union(
  v.object({ kind: v.literal("none") }),
  v.object({ kind: v.literal("existing"), parentUserId: v.id("users"), relationship: v.optional(v.union(v.string(), v.null())), isPrimaryContact: v.optional(v.boolean()), confirmPrimaryChange: v.optional(v.boolean()) }),
  v.object({ kind: v.literal("new"), firstName: v.string(), middleName: v.optional(v.string()), lastName: v.string(), email: v.string(), phone: v.optional(v.union(v.string(), v.null())), relationship: v.optional(v.union(v.string(), v.null())), familyName: v.optional(v.union(v.string(), v.null())), isPrimaryContact: v.optional(v.boolean()), confirmPrimaryChange: v.optional(v.boolean()), addressMode: v.optional(v.union(v.literal("residential"), v.literal("different"))), addressOverride: v.optional(v.union(v.string(), v.null())) }),
);

// ==================== STUDENT ROSTER ====================

export const createStudent = mutation({
  args: {
    requestKey: v.optional(v.string()),
    numberingVersion: v.optional(v.number()),
    numberingFormatVersion: v.optional(v.string()),
    numberingCounterKey: v.optional(v.string()),
    numberingCounterVersion: v.optional(v.number()),
    numberingSessionId: v.optional(v.id("academicSessions")),
    numberingResetPeriod: v.optional(v.string()),
    draftId: v.optional(v.id("formDrafts")),
    expectedDraftRevision: v.optional(v.number()),
    draftFormKey: v.optional(v.union(v.literal("student_onboarding"), v.literal("family_onboarding"))),
    overrideReason: v.optional(v.string()),
    overrideConfirmed: v.optional(v.boolean()),
    overrideCounterDecision: v.optional(
      v.union(v.literal("keep"), v.literal("advance")),
    ),
    advanceCounterTo: v.optional(v.number()),
    name: v.optional(v.union(v.string(), v.null())),
    firstName: v.optional(v.union(v.string(), v.null())),
    middleName: v.optional(v.union(v.string(), v.null())),
    lastName: v.optional(v.union(v.string(), v.null())),
    emergencyContactMode: v.optional(v.union(v.literal("primary"), v.literal("override"))),
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
    parentGuardian: v.optional(parentGuardianValidator),
    addressMode: v.optional(v.union(v.literal("residential"), v.literal("different"))),
    parentLink: v.optional(
      v.object({
        firstName: v.string(),
        middleName: v.optional(v.string()),
        lastName: v.string(),
        email: v.string(),
        phone: v.optional(v.union(v.string(), v.null())),
        relationship: v.optional(v.union(v.string(), v.null())),
        familyName: v.optional(v.union(v.string(), v.null())),
        isPrimaryContact: v.optional(v.boolean()),
      }),
    ),
    confirmDuplicateLink: v.optional(v.boolean()),
  },
  returns: v.id("students"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "enrollment.intakes.manage",
      });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const draftClosureFields = [args.draftId, args.expectedDraftRevision, args.draftFormKey];
    if (draftClosureFields.some((value) => value !== undefined) && draftClosureFields.some((value) => value === undefined))
      throw new ConvexError("Draft closure requires an ID, revision, and form key");
    const intentFingerprint = args.requestKey
      ? await enrollmentIntentFingerprint({
          ...args,
          requestKey: undefined,
          draftId: undefined,
          expectedDraftRevision: undefined,
          draftFormKey: undefined,
        })
      : undefined;

    if (args.requestKey) {
      if (args.requestKey.length > 100)
        throw new ConvexError("Invalid enrollment request key");
      const key = args.requestKey;
      const prior = await ctx.db
        .query("enrollmentRequests")
        .withIndex("by_school_key", (q) =>
          q.eq("schoolId", schoolId).eq("key", key),
        )
        .unique();
      if (prior) {
        if (prior.userId !== userId)
          throw new ConvexError(
            "Enrollment request belongs to a different operator",
          );
        if (!prior.intentFingerprint || prior.intentFingerprint !== intentFingerprint)
          throw new ConvexError(
            "Enrollment request intent changed; use a new request key after reviewing the current form",
          );
        return prior.studentId;
      }
    }
    const studentName = resolveStoredUserNameFields({
      name: args.name,
      firstName: args.firstName,
      middleName: args.middleName,
      lastName: args.lastName,
      requiredMessage: "Student name is required",
    });
    const gender = normalizeGender(args.gender, { required: true });
    const houseName = normalizeOptionalHouseName(args.houseName);
    const dateOfBirth = args.dateOfBirth ?? undefined;
    const guardianName = normalizeOptionalText(args.guardianName);
    const guardianPhone = normalizeOptionalText(args.guardianPhone);
    const address = normalizeOptionalText(args.address);
    const photoMetadata = await getValidatedPhotoMetadata(ctx, args);
    if (args.admissionNumber.trim()) {
      const numberingPolicy = await ctx.db.query("admissionNumberPolicies").withIndex("by_school", (query) => query.eq("schoolId", schoolId)).unique();
      if (numberingPolicy) await requireCapability(ctx, schoolId, "enrollment.admissions.override_number");
    }
    const enrollment = await createCanonicalStudentEnrollmentHelper(ctx, {
      schoolId,
      classId: args.classId,
      name: studentName.name,
      ...(studentName.firstName ? { firstName: studentName.firstName } : {}),
      ...(studentName.middleName ? { middleName: studentName.middleName } : {}),
      ...(studentName.lastName ? { lastName: studentName.lastName } : {}),
      admissionNumber: args.admissionNumber,
      gender,
      ...(houseName ? { houseName } : {}),
      ...(dateOfBirth ? { dateOfBirth } : {}),
      ...(guardianName ? { guardianName } : {}),
      ...(guardianPhone ? { guardianPhone } : {}),
      ...(address ? { address } : {}),
      ...(photoMetadata && args.photoStorageId ? { photo: { storageId: args.photoStorageId, fileName: photoMetadata.fileName, contentType: photoMetadata.contentType } } : {}),
      overrideReason: args.overrideReason,
      overrideConfirmed: args.overrideConfirmed,
      overrideCounterDecision: args.overrideCounterDecision,
      advanceCounterTo: args.advanceCounterTo,
      numberingVersion: args.numberingVersion,
      numberingFormatVersion: args.numberingFormatVersion,
      numberingCounterKey: args.numberingCounterKey,
      numberingCounterVersion: args.numberingCounterVersion,
      numberingSessionId: args.numberingSessionId,
      numberingResetPeriod: args.numberingResetPeriod,
    });
    const studentId = enrollment.studentId;
    if (args.requestKey)
      await ctx.db.insert("enrollmentRequests", {
        schoolId,
        key: args.requestKey,
        userId,
        studentId,
        intentFingerprint,
      });

    if (args.parentLink && args.parentGuardian) throw new ConvexError("Choose one contact input");
    if (args.emergencyContactMode === "primary" && (guardianName || guardianPhone)) throw new ConvexError("Primary-contact mode cannot include separate emergency details");
    await ctx.db.patch(studentId, {
      emergencyContactMode: args.emergencyContactMode ?? (guardianName || guardianPhone ? "override" : "primary"),
      addressMode: args.addressMode ?? (address ? "different" : "residential"),
    });
    const chosenContact = args.parentGuardian && args.parentGuardian.kind !== "none"
      ? args.parentGuardian : undefined;
    if (args.parentLink || chosenContact) {
      const { kind: _kind, ...contact } = chosenContact ?? { kind: "new", ...args.parentLink };
      const linked: { familyId: Id<"families">; parentUserId: Id<"users">; familyMemberId: Id<"familyMembers">; createdHousehold: boolean } = await ctx.runMutation(
        api.functions.academic.studentEnrollment.upsertStudentFamilyLink,
        {
          studentId,
          ...contact,
          confirmDuplicateLink: args.confirmDuplicateLink,
        },
      );
      if (linked.createdHousehold && args.addressMode === undefined)
        await ctx.db.patch(studentId, { addressMode: "residential" });
    }
    if (args.draftId !== undefined && args.expectedDraftRevision !== undefined && args.draftFormKey !== undefined) {
      await finishFormDraft(ctx, {
        schoolId,
        draftId: args.draftId,
        expectedRevision: args.expectedDraftRevision,
        expectedFormKey: args.draftFormKey,
      }, "committed");
    }

    return studentId;
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
    }),
  ),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "enrollment.intakes.manage",
      });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const classDoc = await ctx.db.get(args.classId);
    assertBranchDoc(classDoc, schoolId, { excludeArchived: true });

    const students = await ctx.db
      .query("students")
      .withIndex("by_school_and_class", (q) =>
        q.eq("schoolId", schoolId).eq("classId", args.classId),
      )
      .collect();

    const results = (
      await Promise.all(
        students
          .filter((student) => !student.isArchived)
          .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber))
          .map(async (student) => {
            const studentUser = await ctx.db.get(student.userId);
            if (!studentUser || studentUser.isArchived) {
              return null;
            }
            const studentName = getReadableUserName(studentUser);
            return {
              _id: student._id,
              studentName: studentName.displayName || "Unnamed Student",
              admissionNumber: student.admissionNumber,
              classId: student.classId,
              createdAt: student.createdAt,
            };
          }),
      )
    ).filter((s): s is NonNullable<typeof s> => s !== null);

    return results;
  },
});

async function reconcileActiveSessionSubjectSelections(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    studentId: Id<"students">;
    targetClassId: Id<"classes">;
  },
) {
  const [activeSessions, targetOfferings] = await Promise.all([
    ctx.db
      .query("academicSessions")
      .withIndex("by_school_active", (q) =>
        q.eq("schoolId", args.schoolId).eq("isActive", true),
      )
      .take(11),
    ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.targetClassId))
      .take(201),
  ]);
  if (activeSessions.length > 10)
    throw new ConvexError("Active academic session configuration requires review");
  if (targetOfferings.length > 200)
    throw new ConvexError("Target class subject directory requires review");

  const targetSubjectIds = new Set(
    targetOfferings
      .filter((offering) => offering.schoolId === args.schoolId)
      .map((offering) => String(offering.subjectId)),
  );
  const now = Date.now();
  for (const session of activeSessions) {
    const selections = await ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_student_and_session", (q) =>
        q.eq("studentId", args.studentId).eq("sessionId", session._id),
      )
      .take(201);
    if (selections.length > 200)
      throw new ConvexError("Student subject selections require review");
    const selectedInTarget = new Set<string>();
    for (const selection of selections) {
      const subjectId = String(selection.subjectId);
      if (!targetSubjectIds.has(subjectId) || selectedInTarget.has(subjectId)) {
        await ctx.db.delete(selection._id);
        continue;
      }
      selectedInTarget.add(subjectId);
      if (selection.classId !== args.targetClassId) {
        await ctx.db.patch(selection._id, {
          classId: args.targetClassId,
          updatedAt: now,
        });
      }
    }
  }
}

async function retireSupersededActiveSessionPromotions(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    studentId: Id<"students">;
    targetClassId: Id<"classes">;
  },
) {
  const activeSessions = await ctx.db
    .query("academicSessions")
    .withIndex("by_school_active", (q) =>
      q.eq("schoolId", args.schoolId).eq("isActive", true),
    )
    .take(11);
  if (activeSessions.length > 10) {
    throw new ConvexError("Active academic session configuration requires review");
  }

  for (const session of activeSessions) {
    const promotions = await ctx.db
      .query("studentPromotions")
      .withIndex("by_student_and_to_session", (q) =>
        q.eq("studentId", args.studentId).eq("toSessionId", session._id),
      )
      .collect();
    for (const promotion of promotions) {
      if (
        promotion.schoolId === args.schoolId &&
        promotion.toClassId !== args.targetClassId
      ) {
        await ctx.db.delete(promotion._id);
      }
    }
  }
}

export const updateStudent = mutation({
  args: {
    overrideReason: v.optional(v.string()),
    overrideConfirmed: v.optional(v.boolean()),
    overrideCounterDecision: v.optional(
      v.union(v.literal("keep"), v.literal("advance")),
    ),
    advanceCounterTo: v.optional(v.number()),
    numberingVersion: v.optional(v.number()),
    numberingFormatVersion: v.optional(v.string()),
    numberingCounterKey: v.optional(v.string()),
    numberingCounterVersion: v.optional(v.number()),
    numberingSessionId: v.optional(v.id("academicSessions")),
    numberingResetPeriod: v.optional(v.string()),
    studentId: v.id("students"),
    emergencyContactMode: v.optional(v.union(v.literal("primary"), v.literal("override"))),
    addressMode: v.optional(v.union(v.literal("residential"), v.literal("different"))),
    name: v.optional(v.union(v.string(), v.null())),
    middleName: v.optional(v.union(v.string(), v.null())),
    firstName: v.optional(v.union(v.string(), v.null())),
    lastName: v.optional(v.union(v.string(), v.null())),
    admissionNumber: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
    confirmClassAssignment: v.optional(v.boolean()),
    expectedClassId: v.optional(v.id("classes")),
    expectedSessionId: v.optional(v.union(v.id("academicSessions"), v.null())),
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
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "enrollment.intakes.manage",
      });
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

    const assignment = await activeStudentAssignment(ctx, student);
    if (args.confirmClassAssignment && !args.classId) throw new ConvexError("Choose a class to confirm assignment");
    if (args.confirmClassAssignment && (!args.expectedClassId || args.expectedSessionId === undefined ||
        args.expectedClassId !== assignment.classId || args.expectedSessionId !== assignment.sessionId))
      throw new ConvexError("Active-session assignment changed or was not reviewed. Reload the profile and confirm again.");
    const nextClass = await ctx.db.get(args.confirmClassAssignment ? args.classId ?? assignment.classId : assignment.classId);
    if (!nextClass || nextClass.schoolId !== schoolId || nextClass.isArchived) {
      throw new ConvexError("Selected class is not available");
    }

    // Check for duplicate admission number if changing
    const nextAdmissionNumber =
      args.admissionNumber === undefined
        ? student.admissionNumber
        : normalizeAdmissionNumber(args.admissionNumber);

    if (nextAdmissionNumber !== student.admissionNumber) {
      await commitManualAdmissionNumberHelper(ctx, {
        schoolId,
        number: nextAdmissionNumber,
        level: nextClass.level,
        reason: args.overrideReason,
        confirmed: args.overrideConfirmed,
        counterDecision: args.overrideCounterDecision,
        advanceTo: args.advanceCounterTo,
        expectedVersion: args.numberingVersion,
        expectedFormatVersion: args.numberingFormatVersion,
        expectedCounterKey: args.numberingCounterKey,
        expectedCounterVersion: args.numberingCounterVersion,
        expectedSessionId: args.numberingSessionId,
        expectedResetPeriod: args.numberingResetPeriod,
      });
      // Retain the original legacy identifier as a permanent claim before an explicit correction.
      const previousClaim = await ctx.db
        .query("admissionNumberClaims")
        .withIndex("by_school_number", (q) =>
          q.eq("schoolId", schoolId).eq("number", student.admissionNumber),
        )
        .unique();
      if (!previousClaim)
        await ctx.db.insert("admissionNumberClaims", {
          schoolId,
          number: student.admissionNumber,
          createdAt: Date.now(),
        });
      const existingStudents = await findStudentsByAdmissionNumber(
        ctx,
        schoolId,
        nextAdmissionNumber,
      );
      const duplicateStudent = existingStudents.find(
        (candidate: any) => candidate._id !== args.studentId,
      );

      if (duplicateStudent) {
        throw new ConvexError(
          duplicateStudent.isArchived
            ? archivedRecordNotice("student")
            : "A student with this admission number already exists",
        );
      }


    }

    const userName = resolveStoredUserNameFields({
      name: args.name,
      firstName: args.firstName,
      lastName: args.lastName,
      fallbackName: studentUser.name,
      fallbackFirstName: studentUser.firstName,
      middleName: args.middleName,
      fallbackMiddleName: studentUser.middleName,
      fallbackLastName: studentUser.lastName,
      requiredMessage: "Student name is required",
    });

    const uploadedPhotoMetadata = await getValidatedPhotoMetadata(ctx, args);
    if (args.confirmClassAssignment && nextClass._id !== assignment.classId) {
      if (!args.classId) throw new ConvexError("Choose a class to confirm assignment");
      await retireSupersededActiveSessionPromotions(ctx, {
        schoolId, studentId: student._id, targetClassId: nextClass._id,
      });
      await reconcileActiveSessionSubjectSelections(ctx, {
        schoolId, studentId: student._id, targetClassId: nextClass._id,
      });
    }

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
        : (args.dateOfBirth ?? undefined);
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
        : (args.photoStorageId ?? undefined);
    const nextPhotoFileName =
      args.photoStorageId === undefined
        ? student.photoFileName
        : args.photoStorageId
          ? (uploadedPhotoMetadata?.fileName ?? student.photoFileName)
          : undefined;
    const nextPhotoContentType =
      args.photoStorageId === undefined
        ? student.photoContentType
        : args.photoStorageId
          ? (uploadedPhotoMetadata?.contentType ?? student.photoContentType)
          : undefined;
    const nextPhotoUpdatedAt =
      args.photoStorageId === undefined
        ? student.photoUpdatedAt
        : args.photoStorageId
          ? Date.now()
          : undefined;

    await ctx.db.patch(studentUser._id, { ...userName, updatedAt: Date.now() });
    await ctx.db.patch(args.studentId, {
      ...(args.confirmClassAssignment && nextClass._id !== assignment.classId ? { classId: nextClass._id } : {}),
      admissionNumber: nextAdmissionNumber,
      houseName: nextHouseName,
      gender: nextGender,
      dateOfBirth: nextDateOfBirth,
      guardianName: args.emergencyContactMode === "primary" ? undefined : nextGuardianName,
      guardianPhone: args.emergencyContactMode === "primary" ? undefined : nextGuardianPhone,
      ...(args.emergencyContactMode === "primary" ? { guardianEmail: undefined } : {}),
      ...(args.emergencyContactMode !== undefined ? { emergencyContactMode: args.emergencyContactMode } : {}),
      address: nextAddress,
      ...(args.addressMode !== undefined || args.address !== undefined ? { addressMode: args.addressMode ?? "different" } : {}),
      photoStorageId: nextPhotoStorageId,
      photoFileName: nextPhotoFileName,
      photoContentType: nextPhotoContentType,
      photoUpdatedAt: nextPhotoUpdatedAt,
      updatedAt: Date.now(),
    });
    return null;
  },
});

const addressSourceValidator = v.union(v.literal("residential"), v.literal("different"), v.literal("legacy"), v.literal("none"));
const emergencyContactValidator = v.object({
  source: v.union(v.literal("primary"), v.literal("override"), v.literal("legacy"), v.literal("none")),
  parentUserId: v.union(v.id("users"), v.null()),
  name: v.union(v.string(), v.null()), phone: v.union(v.string(), v.null()), email: v.union(v.string(), v.null()),
});

async function studentContactDetails(ctx: QueryCtx | MutationCtx, student: Doc<"students">) {
  const family = student.familyId ? await ctx.db.get(student.familyId) : null;
  const authorizedFamily = family?.schoolId === student.schoolId ? family : null;
  const address = student.addressMode === "residential" ? authorizedFamily?.residentialAddress ?? null : student.address ?? null;
  const addressSource = student.addressMode === "residential" ? (authorizedFamily?.residentialAddress ? "residential" as const : "none" as const)
    : student.addressMode === "different" ? "different" as const : student.address ? "legacy" as const : "none" as const;
  const empty = { parentUserId: null, name: null, phone: null, email: null };
  if (student.emergencyContactMode === "override" || (!student.emergencyContactMode && (student.guardianName || student.guardianPhone || student.guardianEmail)))
    return { address, addressSource, emergencyContact: { ...empty, source: student.emergencyContactMode === "override" ? "override" as const : "legacy" as const,
      name: student.guardianName ?? null, phone: student.guardianPhone ?? null, email: student.guardianEmail ?? null } };
  const primary = authorizedFamily ? await ctx.db.query("familyMembers")
    .withIndex("by_family_and_primary", q => q.eq("familyId", authorizedFamily._id).eq("isPrimaryContact", true)).take(2) : [];
  const parent = primary.length === 1 && primary[0].schoolId === student.schoolId ? await ctx.db.get(primary[0].parentUserId) : null;
  return { address, addressSource, emergencyContact: parent && parent.schoolId === student.schoolId && !parent.isArchived && parent.role !== "student"
    ? { source: "primary" as const, parentUserId: parent._id, name: getReadableUserName(parent).displayName, phone: parent.phone ?? null, email: parent.email }
    : { ...empty, source: "none" as const } };
}

export const getStudentProfile = query({
  args: { studentId: v.id("students") },
  returns: v.object({
    _id: v.id("students"),
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    displayName: v.string(),
    firstName: v.union(v.string(), v.null()),
    middleName: v.union(v.string(), v.null()),
    lastName: v.union(v.string(), v.null()),
    admissionNumber: v.string(),
    classId: v.id("classes"),
    className: v.string(),
    activeSessionId: v.union(v.id("academicSessions"), v.null()),
    houseName: v.union(v.string(), v.null()),
    gender: v.union(v.string(), v.null()),
    dateOfBirth: v.union(v.number(), v.null()),
    guardianName: v.union(v.string(), v.null()),
    guardianPhone: v.union(v.string(), v.null()),
    address: v.union(v.string(), v.null()),
    storedAddress: v.union(v.string(), v.null()),
    addressMode: v.union(v.literal("residential"), v.literal("different"), v.null()),
    emergencyContactMode: v.union(v.literal("primary"), v.literal("override"), v.null()),
    addressSource: addressSourceValidator,
    emergencyContact: emergencyContactValidator,
    portalState: portalAccountStateValidator,
    photoUrl: v.union(v.string(), v.null()),
    photoFileName: v.union(v.string(), v.null()),
    photoContentType: v.union(v.string(), v.null()),
    enrollmentStatus: v.union(v.string(), v.null()),
    graduatedAt: v.union(v.number(), v.null()),
    graduatingSessionId: v.union(v.id("academicSessions"), v.null()),
    graduatingSessionName: v.union(v.string(), v.null()),
    graduatingClassId: v.union(v.id("classes"), v.null()),
    graduatingClassName: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "enrollment.intakes.manage",
      });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId || student.isArchived) {
      throw new ConvexError("Student not found");
    }

    const assignment = await activeStudentAssignment(ctx, student);
    const effectiveClassId = assignment.classId;
    const [studentUser, classDoc, photoUrl, gradSessionDoc, gradClassDoc] =
      await Promise.all([
        ctx.db.get(student.userId),
        ctx.db.get(effectiveClassId),
        student.photoStorageId
          ? getUnboundStorageUrl(ctx, student.photoStorageId)
          : null,
        student.graduatingSessionId
          ? ctx.db.get(student.graduatingSessionId)
          : null,
        student.graduatingClassId
          ? ctx.db.get(student.graduatingClassId)
          : null,
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
      middleName: studentName.middleName,
      lastName: studentName.lastName,
      admissionNumber: student.admissionNumber,
      classId: effectiveClassId,
      className: normalizeHumanName(classDoc.name),
      activeSessionId: assignment.sessionId,
      houseName: student.houseName ?? null,
      gender: student.gender ?? null,
      dateOfBirth: student.dateOfBirth ?? null,
      guardianName: student.guardianName ?? null,
      guardianPhone: student.guardianPhone ?? null,
      ...await studentContactDetails(ctx, student),
      storedAddress: student.address ?? null,
      addressMode: student.addressMode ?? null,
      emergencyContactMode: student.emergencyContactMode ?? null,
      portalState: await portalAccountState(ctx, studentUser),
      photoUrl,
      photoFileName: student.photoFileName ?? null,
      photoContentType: student.photoContentType ?? null,
      enrollmentStatus: student.enrollmentStatus ?? "active",
      graduatedAt: student.graduatedAt ?? null,
      graduatingSessionId: student.graduatingSessionId ?? null,
      graduatingSessionName: gradSessionDoc
        ? normalizeHumanName(gradSessionDoc.name)
        : null,
      graduatingClassId: student.graduatingClassId ?? null,
      graduatingClassName: gradClassDoc
        ? normalizeHumanName(gradClassDoc.name)
        : null,
    };
  },
});

export const generateStudentPhotoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "enrollment.intakes.manage",
      });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    return secureUploadUnavailable<string>();
  },
});

const MAX_STUDENT_PHOTO_BYTES = 5 * 1024 * 1024;
const STUDENT_PHOTO_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

function detectStudentPhotoContentType(bytes: Uint8Array): string | null {
  const matches = (...expected: number[]) =>
    expected.every((value, index) => bytes[index] === value);
  if (matches(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return "image/png";
  if (matches(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (
    matches(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

export const authorizeStudentPhotoUpload = internalQuery({
  args: { studentId: v.id("students") },
  returns: v.object({
    schoolId: v.id("schools"),
    userId: v.id("users"),
    studentId: v.id("students"),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "enrollment.intakes.manage",
      });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId || student.isArchived) {
      throw new ConvexError("Student not found");
    }
    return { schoolId, userId, studentId: student._id };
  },
});

export const applyStudentPhotoUpload = internalMutation({
  args: {
    schoolId: v.id("schools"),
    userId: v.id("users"),
    studentId: v.id("students"),
    photoStorageId: v.id("_storage"),
    photoFileName: v.string(),
    photoContentType: v.string(),
  },
  returns: v.object({
    deleteStorageId: v.optional(v.id("_storage")),
  }),
  handler: async (ctx, args) => {
    const membership = await getAuthenticatedSchoolMembership(ctx, {
      capability: "enrollment.intakes.manage",
    });
    await assertAdminForSchool(
      ctx,
      membership.userId,
      membership.schoolId,
      membership.role,
    );
    const student = await ctx.db.get(args.studentId);
    if (
      membership.userId !== args.userId ||
      membership.schoolId !== args.schoolId ||
      !student ||
      student.schoolId !== args.schoolId ||
      student.isArchived
    ) {
      throw new ConvexError("Student photo access changed during upload");
    }
    await assertStorageUnclaimed(ctx, args.photoStorageId);

    let deleteStorageId: Id<"_storage"> | undefined;
    if (student.photoStorageId) {
      const issuedReportReference = await ctx.db
        .query("issuedReportCards")
        .withIndex("by_student_photo_storage", (q) =>
          q.eq("studentPhotoStorageId", student.photoStorageId),
        )
        .first();
      if (!issuedReportReference && !student.photoRetentionHold) {
        const exclusivelyOwned = await storageClaimedOnlyBy(
          ctx,
          student.photoStorageId,
          {
            purpose: "studentPhoto",
            ownerId: String(student._id),
          },
        );
        if (exclusivelyOwned) {
          deleteStorageId = student.photoStorageId;
        } else {
          const sourceDocument = student.photoSourceDocumentId
            ? await ctx.db.get(student.photoSourceDocumentId)
            : null;
          const heldBySourceApplication =
            student.photoProvenance === "application_upload" &&
            sourceDocument?.schoolId === student.schoolId &&
            sourceDocument.storageId === student.photoStorageId;
          if (!heldBySourceApplication) {
            throw new ConvexError(
              "Storage object has conflicting ownership and cannot be replaced",
            );
          }
        }
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.studentId, {
      photoStorageId: args.photoStorageId,
      photoFileName: args.photoFileName,
      photoContentType: args.photoContentType,
      photoUpdatedAt: now,
      photoProvenance: "school_upload",
      photoSourceDocumentId: undefined,
      updatedAt: now,
    });
    return { deleteStorageId };
  },
});

export const saveStudentPhoto = action({
  args: {
    studentId: v.id("students"),
    bytes: v.bytes(),
    photoFileName: v.string(),
    photoContentType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const authorization = await ctx.runQuery(
      internal.functions.academic.studentEnrollment.authorizeStudentPhotoUpload,
      { studentId: args.studentId },
    );
    const fileName = args.photoFileName.trim();
    if (!fileName || fileName.length > 160) {
      throw new ConvexError("Use a photo file name between 1 and 160 characters");
    }
    if (
      args.bytes.byteLength === 0 ||
      args.bytes.byteLength > MAX_STUDENT_PHOTO_BYTES
    ) {
      throw new ConvexError("Student photos must be 5 MB or smaller");
    }
    if (
      !STUDENT_PHOTO_CONTENT_TYPES.includes(
        args.photoContentType as (typeof STUDENT_PHOTO_CONTENT_TYPES)[number],
      ) ||
      detectStudentPhotoContentType(new Uint8Array(args.bytes)) !==
        args.photoContentType
    ) {
      throw new ConvexError("Use a valid PNG, JPEG, or WebP student photo");
    }

    const storageId = await ctx.storage.store(
      new Blob([args.bytes], { type: args.photoContentType }),
    );
    let result: { deleteStorageId?: Id<"_storage"> };
    try {
      result = await ctx.runMutation(
        internal.functions.academic.studentEnrollment.applyStudentPhotoUpload,
        {
          ...authorization,
          photoStorageId: storageId,
          photoFileName: fileName,
          photoContentType: args.photoContentType,
        },
      );
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
    if (result.deleteStorageId) {
      await ctx.storage.delete(result.deleteStorageId);
    }
    return null;
  },
});

async function archiveStudentRecord(
  ctx: any,
  args: {
    studentId: Id<"students">;
    actingUserId: Id<"users">;
    schoolId: Id<"schools">;
  },
) {
  const student = await ctx.db.get(args.studentId);
  assertBranchDoc(student, args.schoolId);

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
  if (isCurrentEnrollment(student)) {
    await adjustSchoolEnrollmentCount(ctx, args.schoolId, -1);
  }
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
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "enrollment.intakes.manage",
      });
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
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
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
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
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
      student.admissionNumber,
    );
    const activeStudentDuplicate = duplicateStudents.find(
      (candidate: any) =>
        candidate._id !== args.studentId && !candidate.isArchived,
    );
    if (activeStudentDuplicate) {
      throw new ConvexError(
        "Restore blocked because an active student already uses this admission number.",
      );
    }

    const userConflicts = await ctx.db.query("users").withIndex("by_school_and_email", q => q.eq("schoolId", schoolId).eq("email", studentUser.email)).take(3);
    if (userConflicts.some(user => user._id !== studentUser._id && !user.isArchived))
      throw new ConvexError("Restore blocked because another active account uses this stored login identifier.");

    const now = Date.now();
    await ctx.db.patch(args.studentId, {
      isArchived: false,
      updatedAt: now,
    });
    if ((student.enrollmentStatus ?? "active") === "active") {
      await adjustSchoolEnrollmentCount(ctx, schoolId, 1);
    }
    await ctx.db.patch(student.userId, {
      isArchived: false,
      updatedAt: now,
    });

    return null;
  },
});

export const reconcileArchivedStudents = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    cursor: v.optional(v.union(v.string(), v.null())),
    numItems: v.optional(v.number()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    reconciledCount: v.number(),
    reconciledStudents: v.array(
      v.object({
        studentId: v.id("students"),
        userId: v.id("users"),
        admissionNumber: v.string(),
        studentName: v.string(),
        reason: v.string(),
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const dryRun = args.dryRun ?? false;
    const now = Date.now();

    const requestedItems = Math.floor(args.numItems ?? 50);
    const numItems = Math.max(1, Math.min(requestedItems, 100));
    const studentPage = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .paginate({ cursor: args.cursor ?? null, numItems });

    const reconciledStudents = [];

    for (const student of studentPage.page) {
      const studentUser = await ctx.db.get(student.userId);
      if (!studentUser || studentUser.schoolId !== schoolId) {
        continue;
      }

      // Case 1: User account is archived, but student record is NOT archived
      if (studentUser.isArchived && !student.isArchived) {
        const studentName =
          getReadableUserName(studentUser).displayName || "Unnamed Student";
        reconciledStudents.push({
          studentId: student._id,
          userId: student.userId,
          admissionNumber: student.admissionNumber,
          studentName,
          reason:
            "User account is archived but student document was active. Synchronized student to archived.",
        });

        if (!dryRun) {
          await ctx.db.patch(student._id, {
            isArchived: true,
            archivedAt: studentUser.archivedAt ?? now,
            archivedBy: (studentUser.archivedBy as Id<"users">) ?? userId,
            updatedAt: now,
          });
          if (isCurrentEnrollment(student)) {
            await adjustSchoolEnrollmentCount(ctx, schoolId, -1);
          }

          // Clean up any pending staged outgoing promotions
          const pendingPromotions = await ctx.db
            .query("studentPromotions")
            .withIndex("by_student", (q) => q.eq("studentId", student._id))
            .collect();
          for (const promo of pendingPromotions) {
            await ctx.db.delete(promo._id);
          }
        }
      }
      // Case 2: Student document is archived, but user account is NOT archived
      else if (student.isArchived && !studentUser.isArchived) {
        const studentName =
          getReadableUserName(studentUser).displayName || "Unnamed Student";
        reconciledStudents.push({
          studentId: student._id,
          userId: student.userId,
          admissionNumber: student.admissionNumber,
          studentName,
          reason:
            "Student document is archived but user account was active. Synchronized user to archived.",
        });

        if (!dryRun) {
          await ctx.db.patch(studentUser._id, {
            isArchived: true,
            archivedAt: student.archivedAt ?? now,
            archivedBy: (student.archivedBy as Id<"users">) ?? userId,
            updatedAt: now,
          });
        }
      }
    }

    return {
      dryRun,
      reconciledCount: reconciledStudents.length,
      reconciledStudents,
      continueCursor: studentPage.continueCursor,
      isDone: studentPage.isDone,
    };
  },
});

const promotionSubjectEnrollmentModeValidator = v.union(
  v.literal("all_target_class_subjects"),
  v.literal("matching_previous_subjects"),
  v.literal("none"),
);

async function listActiveSubjectIdsForClass(
  ctx: any,
  args: { schoolId: Id<"schools">; classId: Id<"classes"> },
) {
  const offerings = await ctx.db
    .query("classSubjects")
    .withIndex("by_class", (q: any) => q.eq("classId", args.classId))
    .collect();

  const subjectIds: Array<Id<"subjects">> = [];
  const seen = new Set<string>();

  for (const offering of offerings) {
    const subject = await ctx.db.get(offering.subjectId);
    const subjectKey = String(offering.subjectId);
    if (
      !subject ||
      subject.schoolId !== args.schoolId ||
      subject.isArchived ||
      seen.has(subjectKey)
    ) {
      continue;
    }

    subjectIds.push(offering.subjectId);
    seen.add(subjectKey);
  }

  return subjectIds;
}

export const promoteStudents = mutation({
  args: {
    studentIds: v.array(v.id("students")),
    fromClassId: v.id("classes"),
    fromSessionId: v.id("academicSessions"),
    toClassId: v.id("classes"),
    toSessionId: v.id("academicSessions"),
    subjectEnrollmentMode: promotionSubjectEnrollmentModeValidator,
  },
  returns: v.object({
    promotedCount: v.number(),
    subjectSelectionCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const uniqueStudentIds = [
      ...new Set(args.studentIds.map((id) => String(id))),
    ] as Array<Id<"students">>;
    if (uniqueStudentIds.length === 0) {
      throw new ConvexError("Select at least one student to promote");
    }
    if (uniqueStudentIds.length > 100) {
      throw new ConvexError("Promote 100 students or fewer at a time");
    }
    if (String(args.fromSessionId) === String(args.toSessionId)) {
      throw new ConvexError(
        "Student promotion requires selecting an upcoming academic session. For mid-session class changes, update the student record directly.",
      );
    }
    if (String(args.fromClassId) === String(args.toClassId)) {
      throw new ConvexError("Choose a different target class for promotion");
    }

    const [fromClass, toClass, fromSession, toSession] = await Promise.all([
      ctx.db.get(args.fromClassId),
      ctx.db.get(args.toClassId),
      ctx.db.get(args.fromSessionId),
      ctx.db.get(args.toSessionId),
    ]);

    if (!fromClass || fromClass.schoolId !== schoolId || fromClass.isArchived) {
      throw new ConvexError("Source class is not available");
    }
    if (!toClass || toClass.schoolId !== schoolId || toClass.isArchived) {
      throw new ConvexError("Target class is not available");
    }
    if (
      !fromSession ||
      fromSession.schoolId !== schoolId ||
      fromSession.isArchived
    ) {
      throw new ConvexError("Source session is not available");
    }
    if (!toSession || toSession.schoolId !== schoolId || toSession.isArchived) {
      throw new ConvexError("Target session is not available");
    }

    if (toSession.startDate <= fromSession.startDate) {
      throw new ConvexError(
        `Cannot promote students backwards to a previous academic session (${toSession.name}). Annual promotions must advance forward to an upcoming academic session.`,
      );
    }

    const targetClassSubjectIds = await listActiveSubjectIdsForClass(ctx, {
      schoolId,
      classId: args.toClassId,
    });
    const targetClassSubjectIdSet = new Set(
      targetClassSubjectIds.map((subjectId) => String(subjectId)),
    );
    const now = Date.now();
    const batchKey = `${now}:${String(args.fromClassId)}:${String(args.toClassId)}`;
    let promotedCount = 0;
    let subjectSelectionCount = 0;

    for (const studentId of uniqueStudentIds) {
      const student = await ctx.db.get(studentId);
      if (!student || student.schoolId !== schoolId || student.isArchived) {
        throw new ConvexError("One selected student is not available");
      }

      const studentUser = await ctx.db.get(student.userId);
      if (
        !studentUser ||
        studentUser.schoolId !== schoolId ||
        studentUser.isArchived
      ) {
        throw new ConvexError("One selected student account is not available");
      }

      // Check existing promotion for this student and fromSession
      const existingPromo = await ctx.db
        .query("studentPromotions")
        .withIndex("by_student_and_from_session", (q) =>
          q.eq("studentId", studentId).eq("fromSessionId", args.fromSessionId),
        )
        .first();

      if (existingPromo) {
        // Clean up previous staged selections if target class or session changed
        if (
          String(existingPromo.toClassId) !== String(args.toClassId) ||
          String(existingPromo.toSessionId) !== String(args.toSessionId)
        ) {
          const oldStaged = await ctx.db
            .query("studentSubjectSelections")
            .withIndex("by_student_and_class_and_session", (q: any) =>
              q
                .eq("studentId", studentId)
                .eq("classId", existingPromo.toClassId)
                .eq("sessionId", existingPromo.toSessionId),
            )
            .collect();
          for (const oldSel of oldStaged) {
            await ctx.db.delete(oldSel._id);
          }
        }
      }

      const previousSelections = await ctx.db
        .query("studentSubjectSelections")
        .withIndex("by_student_and_class_and_session", (q: any) =>
          q
            .eq("studentId", studentId)
            .eq("classId", args.fromClassId)
            .eq("sessionId", args.fromSessionId),
        )
        .collect();
      const existingTargetSelections = await ctx.db
        .query("studentSubjectSelections")
        .withIndex("by_student_and_class_and_session", (q: any) =>
          q
            .eq("studentId", studentId)
            .eq("classId", args.toClassId)
            .eq("sessionId", args.toSessionId),
        )
        .collect();
      const existingTargetSubjectIds = new Set(
        existingTargetSelections.map((selection: any) =>
          String(selection.subjectId),
        ),
      );

      const subjectIdsToEnroll =
        args.subjectEnrollmentMode === "all_target_class_subjects"
          ? targetClassSubjectIds
          : args.subjectEnrollmentMode === "matching_previous_subjects"
            ? previousSelections
                .map((selection: any) => selection.subjectId as Id<"subjects">)
                .filter((subjectId: Id<"subjects">) =>
                  targetClassSubjectIdSet.has(String(subjectId)),
                )
            : [];

      const uniqueSubjectIdsToEnroll = [
        ...new Set(subjectIdsToEnroll.map((subjectId) => String(subjectId))),
      ] as Array<Id<"subjects">>;

      await ctx.db.patch(studentId, { updatedAt: now });

      let insertedForStudent = 0;
      for (const subjectId of uniqueSubjectIdsToEnroll) {
        if (existingTargetSubjectIds.has(String(subjectId))) {
          continue;
        }

        await ctx.db.insert("studentSubjectSelections", {
          schoolId,
          studentId,
          classId: args.toClassId,
          subjectId,
          sessionId: args.toSessionId,
          createdAt: now,
          updatedAt: now,
        });
        insertedForStudent += 1;
      }

      if (existingPromo) {
        await ctx.db.patch(existingPromo._id, {
          fromClassId: args.fromClassId,
          toClassId: args.toClassId,
          fromSessionId: args.fromSessionId,
          toSessionId: args.toSessionId,
          subjectEnrollmentMode: args.subjectEnrollmentMode,
          subjectEnrollmentCount: insertedForStudent,
          batchKey,
          createdAt: now,
          createdBy: userId,
        });
      } else {
        await ctx.db.insert("studentPromotions", {
          schoolId,
          studentId,
          fromClassId: args.fromClassId,
          toClassId: args.toClassId,
          fromSessionId: args.fromSessionId,
          toSessionId: args.toSessionId,
          subjectEnrollmentMode: args.subjectEnrollmentMode,
          subjectEnrollmentCount: insertedForStudent,
          batchKey,
          createdAt: now,
          createdBy: userId,
        });
      }

      promotedCount += 1;
      subjectSelectionCount += insertedForStudent;
    }

    return { promotedCount, subjectSelectionCount };
  },
});

export const cancelStudentPromotion = mutation({
  args: {
    studentId: v.id("students"),
    fromSessionId: v.id("academicSessions"),
  },
  returns: v.object({
    cancelled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const promotion = await ctx.db
      .query("studentPromotions")
      .withIndex("by_student_and_from_session", (q) =>
        q
          .eq("studentId", args.studentId)
          .eq("fromSessionId", args.fromSessionId),
      )
      .first();

    if (!promotion || promotion.schoolId !== schoolId) {
      throw new ConvexError("Promotion record not found for this session");
    }

    // Remove staged subject selections for target class & target session
    const stagedSelections = await ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_student_and_class_and_session", (q) =>
        q
          .eq("studentId", args.studentId)
          .eq("classId", promotion.toClassId)
          .eq("sessionId", promotion.toSessionId),
      )
      .collect();

    for (const sel of stagedSelections) {
      await ctx.db.delete(sel._id);
    }

    await ctx.db.delete(promotion._id);
    await ctx.db.patch(args.studentId, { updatedAt: Date.now() });

    return { cancelled: true };
  },
});

export const graduateStudents = mutation({
  args: {
    studentIds: v.array(v.id("students")),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    graduationDate: v.optional(v.number()),
    honorsOrRemarks: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
  },
  returns: v.object({
    graduatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const uniqueStudentIds = [
      ...new Set(args.studentIds.map((id) => String(id))),
    ] as Array<Id<"students">>;
    if (uniqueStudentIds.length === 0) {
      throw new ConvexError("Select at least one student to graduate");
    }
    if (uniqueStudentIds.length > 100) {
      throw new ConvexError("Graduate 100 students or fewer at a time");
    }

    const [classDoc, sessionDoc] = await Promise.all([
      ctx.db.get(args.classId),
      ctx.db.get(args.sessionId),
    ]);

    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Class is not available");
    }
    if (
      !sessionDoc ||
      sessionDoc.schoolId !== schoolId ||
      sessionDoc.isArchived
    ) {
      throw new ConvexError("Academic session is not available");
    }

    const now = Date.now();
    const effectiveGraduationDate =
      args.graduationDate ?? sessionDoc.endDate ?? now;
    let graduatedCount = 0;

    for (const studentId of uniqueStudentIds) {
      const student = await ctx.db.get(studentId);
      if (!student || student.schoolId !== schoolId || student.isArchived) {
        throw new ConvexError("One selected student is not available");
      }

      const existingGrad = await ctx.db
        .query("studentGraduations")
        .withIndex("by_student_and_session", (q) =>
          q.eq("studentId", studentId).eq("sessionId", args.sessionId),
        )
        .first();

      if (existingGrad) {
        await ctx.db.patch(existingGrad._id, {
          classId: args.classId,
          graduationDate: effectiveGraduationDate,
          certificateNumber: args.certificateNumber?.trim() || undefined,
          honorsOrRemarks: args.honorsOrRemarks?.trim() || undefined,
        });
      } else {
        await ctx.db.insert("studentGraduations", {
          schoolId,
          studentId,
          classId: args.classId,
          sessionId: args.sessionId,
          graduationDate: effectiveGraduationDate,
          certificateNumber: args.certificateNumber?.trim() || undefined,
          honorsOrRemarks: args.honorsOrRemarks?.trim() || undefined,
          createdAt: now,
          createdBy: userId,
        });
      }

      await ctx.db.patch(studentId, {
        enrollmentStatus: "graduated",
        graduatedAt: effectiveGraduationDate,
        graduatingSessionId: args.sessionId,
        graduatingClassId: args.classId,
        updatedAt: now,
      });
      if (isCurrentEnrollment(student)) {
        await adjustSchoolEnrollmentCount(ctx, schoolId, -1);
      }

      // Purge any pending outgoing promotions or staged future selections
      const pendingPromotions = await ctx.db
        .query("studentPromotions")
        .withIndex("by_student_and_from_session", (q) =>
          q.eq("studentId", studentId).eq("fromSessionId", args.sessionId),
        )
        .collect();
      for (const promo of pendingPromotions) {
        const stagedSelections = await ctx.db
          .query("studentSubjectSelections")
          .withIndex("by_student_and_class_and_session", (q: any) =>
            q
              .eq("studentId", studentId)
              .eq("classId", promo.toClassId)
              .eq("sessionId", promo.toSessionId),
          )
          .collect();
        for (const sel of stagedSelections) {
          await ctx.db.delete(sel._id);
        }
        await ctx.db.delete(promo._id);
      }

      graduatedCount += 1;
    }

    return { graduatedCount };
  },
});

export const cancelStudentGraduation = mutation({
  args: {
    studentId: v.id("students"),
    sessionId: v.id("academicSessions"),
  },
  returns: v.object({
    cancelled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId || student.isArchived) {
      throw new ConvexError("Student not found");
    }

    const graduations = await ctx.db
      .query("studentGraduations")
      .withIndex("by_student_and_session", (q) =>
        q.eq("studentId", args.studentId).eq("sessionId", args.sessionId),
      )
      .collect();

    for (const grad of graduations) {
      await ctx.db.delete(grad._id);
    }

    await ctx.db.patch(args.studentId, {
      enrollmentStatus: "active",
      graduatedAt: undefined,
      graduatingSessionId: undefined,
      graduatingClassId: undefined,
      updatedAt: Date.now(),
    });
    if (!isCurrentEnrollment(student)) {
      await adjustSchoolEnrollmentCount(ctx, schoolId, 1);
    }

    return { cancelled: true };
  },
});

// ==================== STUDENT SUBJECT ENROLLMENT ====================

export const setStudentSubjectSelections = mutation({
  args: {
    schoolId: v.optional(v.id("schools")),
    studentId: v.id("students"),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
    subjectIds: v.array(v.id("subjects")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx, {
        schoolId: args.schoolId,
        capability: "enrollment.intakes.manage",
      });

    // Teachers can edit subject selections for their assigned classes
    if (role === "teacher") {
      const hasAccess = await teacherHasClassAccess(
        ctx,
        userId,
        schoolId,
        args.classId,
      );

      if (!hasAccess) {
        throw new ConvexError("Not assigned to this class");
      }
    } else if (!isSchoolAdmin && role !== "admin") {
      throw new ConvexError("Admin or teacher access required");
    }

    // Verify school boundary
    const student = await ctx.db.get(args.studentId);
    assertBranchDoc(student, schoolId, { excludeArchived: true });
    const classDoc = await ctx.db.get(args.classId);
    assertBranchDoc(classDoc, schoolId, { excludeArchived: true });

    const session = await ctx.db.get(args.sessionId);
    assertBranchDoc(session, schoolId, { excludeArchived: true });
    if (!(await isStudentEnrolledInClassForSession(ctx, { student, schoolId, classId: args.classId, sessionId: args.sessionId }))) {
      throw new ConvexError("Student is not enrolled in this class");
    }

    // Verify all subjects are offered in this class
    const classOfferings = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const offeredSubjectIds = new Set(
      classOfferings.map((o) => String(o.subjectId)),
    );

    const [existingSelections, aggregations, existingOptOuts] =
      await Promise.all([
        ctx.db
          .query("studentSubjectSelections")
          .withIndex("by_student_and_class_and_session", (q) =>
            q
              .eq("studentId", args.studentId)
              .eq("classId", args.classId)
              .eq("sessionId", args.sessionId),
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
      existingSelections.map((selection) => String(selection.subjectId)),
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
          "One of the selected subjects is no longer offered for this class. Refresh the grid and try again.",
        );
      }

      subjectIdsToSave.push(subjectId);
    }

    // Remove existing selections for this student/class/session
    for (const selection of existingSelections) {
      await ctx.db.delete(selection._id);
    }

    const selectedSubjectIdSet = new Set(
      subjectIdsToSave.map((subjectId) => String(subjectId)),
    );
    const existingOptOutByAggregationId = new Map<string, any>(
      existingOptOuts.map(
        (optOut: any) => [String(optOut.aggregationId), optOut] as const,
      ),
    );
    const sanitizedSubjectIdsToSave = [...subjectIdsToSave];

    const now = Date.now();

    for (const aggregation of aggregations) {
      const aggregationId = String(aggregation._id);
      const umbrellaSubjectId = String(aggregation.umbrellaSubjectId);
      const allComponentsSelected = aggregation.components.every((component) =>
        selectedSubjectIdSet.has(String(component.componentSubjectId)),
      );
      const umbrellaSelected = selectedSubjectIdSet.has(umbrellaSubjectId);
      const existingOptOut = existingOptOutByAggregationId.get(aggregationId);

      if (!allComponentsSelected && umbrellaSelected) {
        selectedSubjectIdSet.delete(umbrellaSubjectId);
        const index = sanitizedSubjectIdsToSave.findIndex(
          (subjectId) => String(subjectId) === umbrellaSubjectId,
        );
        if (index >= 0) {
          sanitizedSubjectIdsToSave.splice(index, 1);
        }
      }

      if (
        allComponentsSelected &&
        selectedSubjectIdSet.has(umbrellaSubjectId)
      ) {
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
    }),
  ),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "enrollment.intakes.manage",
      });

    const student = await ctx.db.get(args.studentId);
    assertBranchDoc(student, schoolId, { excludeArchived: true });

    const session = await ctx.db.get(args.sessionId);
    assertBranchDoc(session, schoolId, { excludeArchived: true });

    const selections = await ctx.db
      .query("studentSubjectSelections")
      .withIndex("by_student_and_session", (q) =>
        q.eq("studentId", args.studentId).eq("sessionId", args.sessionId),
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
    schoolId: v.optional(v.id("schools")),
    classId: v.id("classes"),
    sessionId: v.id("academicSessions"),
  },
  returns: v.object({
    subjects: v.array(
      v.object({
        _id: v.id("subjects"),
        name: v.string(),
        code: v.string(),
      }),
    ),
    students: v.array(
      v.object({
        _id: v.id("students"),
        studentName: v.string(),
        admissionNumber: v.string(),
        photoUrl: v.union(v.string(), v.null()),
        selectedSubjectIds: v.array(v.id("subjects")),
        promotionStatus: v.union(
          v.object({
            isPromoted: v.boolean(),
            targetClassId: v.optional(v.id("classes")),
            targetClassName: v.optional(v.string()),
            targetSessionId: v.optional(v.id("academicSessions")),
            targetSessionName: v.optional(v.string()),
            promotedAt: v.optional(v.number()),
          }),
          v.null(),
        ),
        graduationStatus: v.union(
          v.object({
            isGraduated: v.boolean(),
            graduationDate: v.optional(v.number()),
            certificateNumber: v.optional(v.string()),
            honorsOrRemarks: v.optional(v.string()),
          }),
          v.null(),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx, {
        schoolId: args.schoolId,
        capability: "enrollment.intakes.manage",
      });

    // Teachers can view their assigned classes
    if (role === "teacher") {
      const hasAccess = await teacherHasClassAccess(
        ctx,
        userId,
        schoolId,
        args.classId,
      );

      if (!hasAccess) {
        throw new ConvexError("Not assigned to this class");
      }
    } else if (!isSchoolAdmin && role !== "admin") {
      throw new ConvexError("Admin or teacher access required");
    }

    const [classDoc, sessionDoc] = await Promise.all([
      ctx.db.get(args.classId),
      ctx.db.get(args.sessionId),
    ]);
    assertBranchDoc(classDoc, schoolId, { excludeArchived: true });
    if (
      !sessionDoc ||
      sessionDoc.schoolId !== schoolId ||
      sessionDoc.isArchived
    ) {
      throw new ConvexError("Selected session is not available");
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
    const visibleSubjectIds = new Set(
      subjects.map((subject) => String(subject._id)),
    );

    // 1. Resolve students for this class and session
    const studentIdSet = new Set<string>();

    if (sessionDoc.isActive) {
      const baselineStudents = await ctx.db
        .query("students")
        .withIndex("by_school_and_class", (q) =>
          q.eq("schoolId", schoolId).eq("classId", args.classId),
        )
        .collect();
      for (const student of baselineStudents) {
        if (!student.isArchived) {
          // If student is graduated in a prior session, exclude them from subsequent sessions
          if (
            student.enrollmentStatus === "graduated" &&
            student.graduatingSessionId
          ) {
            const gradSession = await ctx.db.get(student.graduatingSessionId);
            if (gradSession && sessionDoc.startDate > gradSession.startDate) {
              continue;
            }
          }

          if (
            !(await isStudentEnrolledInClassForSession(ctx, {
              student,
              schoolId,
              classId: args.classId,
              sessionId: args.sessionId,
            }))
          ) {
            continue;
          }

          studentIdSet.add(String(student._id));
        }
      }
    }

    const [promotedIntoClass, graduationsInClassSession] = await Promise.all([
      ctx.db
        .query("studentPromotions")
        .withIndex("by_to_class_and_to_session", (q) =>
          q.eq("toClassId", args.classId).eq("toSessionId", args.sessionId),
        )
        .collect(),
      ctx.db
        .query("studentGraduations")
        .withIndex("by_class_and_session", (q) =>
          q.eq("classId", args.classId).eq("sessionId", args.sessionId),
        )
        .collect(),
    ]);

    for (const promo of promotedIntoClass) {
      const student = await ctx.db.get(promo.studentId);
      if (
        student &&
        (await isStudentEnrolledInClassForSession(ctx, {
          student,
          schoolId,
          classId: args.classId,
          sessionId: args.sessionId,
        }))
      ) {
        studentIdSet.add(String(promo.studentId));
      }
    }

    const graduationMap = new Map<
      string,
      (typeof graduationsInClassSession)[0]
    >();
    for (const grad of graduationsInClassSession) {
      graduationMap.set(String(grad.studentId), grad);
      studentIdSet.add(String(grad.studentId));
    }

    const [allSelections, aggregations, optOuts, outgoingPromotions] =
      await Promise.all([
        ctx.db
          .query("studentSubjectSelections")
          .withIndex("by_class_and_session", (q) =>
            q.eq("classId", args.classId).eq("sessionId", args.sessionId),
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
        ctx.db
          .query("studentPromotions")
          .withIndex("by_from_class_and_from_session", (q) =>
            q
              .eq("fromClassId", args.classId)
              .eq("fromSessionId", args.sessionId),
          )
          .collect(),
      ]);

    for (const selection of allSelections) {
      if (!sessionDoc.isActive || studentIdSet.has(String(selection.studentId))) {
        studentIdSet.add(String(selection.studentId));
      }
    }

    // Build outgoing promotion lookup maps
    const outgoingPromoMap = new Map<string, (typeof outgoingPromotions)[0]>();
    const targetClassIds = new Set<string>();
    const targetSessionIds = new Set<string>();

    for (const promo of outgoingPromotions) {
      outgoingPromoMap.set(String(promo.studentId), promo);
      targetClassIds.add(String(promo.toClassId));
      targetSessionIds.add(String(promo.toSessionId));
    }

    const targetClassDocs = await Promise.all(
      Array.from(targetClassIds).map((id) => ctx.db.get(id as Id<"classes">)),
    );
    const targetClassMap = new Map<string, string>();
    for (const doc of targetClassDocs) {
      if (doc)
        targetClassMap.set(String(doc._id), normalizeHumanName(doc.name));
    }

    const targetSessionDocs = await Promise.all(
      Array.from(targetSessionIds).map((id) =>
        ctx.db.get(id as Id<"academicSessions">),
      ),
    );
    const targetSessionMap = new Map<string, string>();
    for (const doc of targetSessionDocs) {
      if (doc)
        targetSessionMap.set(String(doc._id), normalizeHumanName(doc.name));
    }

    // Fetch student documents
    const studentDocs = (
      await Promise.all(
        Array.from(studentIdSet).map((id) => ctx.db.get(id as Id<"students">)),
      )
    ).filter((student): student is NonNullable<typeof student> =>
      Boolean(student && student.schoolId === schoolId && !student.isArchived),
    );

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

    const studentResults = studentDocs
      .sort((a, b) => a.admissionNumber.localeCompare(b.admissionNumber))
      .map(async (student) => {
        const [studentUser, photoUrl] = await Promise.all([
          ctx.db.get(student.userId),
          student.photoStorageId
            ? getUnboundStorageUrl(ctx, student.photoStorageId)
            : null,
        ]);
        if (!studentUser || studentUser.isArchived) {
          return null;
        }
        const studentName = getReadableUserName(studentUser);
        const effectiveSubjectIds = deriveEffectiveSubjectSelectionIds({
          explicitSubjectIds: selectionMap.get(String(student._id)) ?? [],
          aggregations,
          optOutAggregationIds: optOutMap.get(String(student._id)) ?? new Set(),
        });

        const promo = outgoingPromoMap.get(String(student._id));
        const promotionStatus = promo
          ? {
              isPromoted: true,
              targetClassId: promo.toClassId,
              targetClassName:
                targetClassMap.get(String(promo.toClassId)) ?? "Target Class",
              targetSessionId: promo.toSessionId,
              targetSessionName:
                targetSessionMap.get(String(promo.toSessionId)) ??
                "Target Session",
              promotedAt: promo.createdAt,
            }
          : {
              isPromoted: false,
            };

        const grad = graduationMap.get(String(student._id));
        const graduationStatus = grad
          ? {
              isGraduated: true,
              graduationDate: grad.graduationDate,
              certificateNumber: grad.certificateNumber,
              honorsOrRemarks: grad.honorsOrRemarks,
            }
          : student.enrollmentStatus === "graduated" &&
              String(student.graduatingClassId) === String(args.classId) &&
              String(student.graduatingSessionId) === String(args.sessionId)
            ? {
                isGraduated: true,
                graduationDate: student.graduatedAt,
              }
            : {
                isGraduated: false,
              };

        return {
          _id: student._id,
          studentName: studentName.displayName || "Unnamed Student",
          admissionNumber: student.admissionNumber,
          photoUrl,
          selectedSubjectIds: Array.from(effectiveSubjectIds)
            .filter((id) => visibleSubjectIds.has(id))
            .map((id) => id as any),
          promotionStatus,
          graduationStatus,
        };
      });

    const resolvedStudents = (await Promise.all(studentResults)).filter(
      (s): s is NonNullable<typeof s> => s !== null,
    );

    return {
      subjects: subjects.sort((a, b) => a.name.localeCompare(b.name)),
      students: resolvedStudents,
    };
  },
});

async function loadStudentFamilyProfile(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  studentId: Id<"students">,
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
    familyMembers.map(async (familyMember) => {
      if (familyMember.schoolId !== schoolId) return null;
      const parentUser = await ctx.db.get(familyMember.parentUserId);
      if (
        !parentUser ||
        parentUser.schoolId !== schoolId ||
        parentUser.isArchived ||
        parentUser.role === "student"
      ) {
        return null;
      }

      const parentName = getReadableUserName(parentUser);
      return {
        _id: familyMember._id,
        parentUserId: parentUser._id,
        name: parentName.displayName || "Unnamed Parent",
        firstName: parentName.firstName,
        middleName: parentName.middleName,
        lastName: parentName.lastName,
        email: parentUser.email,
        phone: parentUser.phone ?? null,
        role: parentUser.role,
        relationship: familyMember.relationship ?? null,
        isPrimaryContact: familyMember.isPrimaryContact,
        addressMode: familyMember.addressMode ?? null,
        addressOverride: familyMember.addressOverride ?? null,
        effectiveAddress: familyMember.addressMode === "residential" ? family.residentialAddress ?? null : familyMember.addressOverride ?? null,
        addressSource: familyMember.addressMode ?? ("legacy" as const),
        portalState: await portalAccountState(ctx, parentUser),
      };
    }),
  );

  const parents = parentRows
    .filter((parent): parent is NonNullable<typeof parent> => Boolean(parent))
    .sort((a, b) => a.name.localeCompare(b.name));

  const familyStudents = await ctx.db
    .query("students")
    .withIndex("by_family", (q: any) => q.eq("familyId", family._id))
    .collect();

  const activeStudents = familyStudents.filter(
    (familyStudent) => familyStudent.schoolId === schoolId && !familyStudent.isArchived,
  );
  const classIds = [
    ...new Set(
      activeStudents.map((familyStudent: any) => String(familyStudent.classId)),
    ),
  ];
  const classDocs = await Promise.all(
    classIds.map(async (classId) => ctx.db.get(classId as Id<"classes">)),
  );
  const classNameById = new Map<string, string>();
  for (const classDoc of classDocs) {
    if (!classDoc || classDoc.schoolId !== schoolId) {
      continue;
    }

    classNameById.set(String(classDoc._id), normalizeHumanName(classDoc.name));
  }

  const students = (
    await Promise.all(
      activeStudents
        .sort((a: any, b: any) =>
          a.admissionNumber.localeCompare(b.admissionNumber),
        )
        .map(async (familyStudent) => {
          const familyStudentUser = await ctx.db.get(familyStudent.userId);
          if (!familyStudentUser || familyStudentUser.isArchived) {
            return null;
          }
          const studentName = getReadableUserName(familyStudentUser);
          return {
            _id: familyStudent._id,
            studentName: studentName.displayName || "Unnamed Student",
            admissionNumber: familyStudent.admissionNumber,
            classId: familyStudent.classId,
            className:
              classNameById.get(String(familyStudent.classId)) ??
              "Unassigned Class",
          };
        }),
    )
  ).filter((s): s is NonNullable<typeof s> => s !== null);

  return {
    family: {
      _id: family._id,
      name: family.name,
      residentialAddress: family.residentialAddress ?? null,
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
        residentialAddress: v.union(v.string(), v.null()),
        studentCount: v.number(),
        parentCount: v.number(),
      }),
    ),
    parents: v.array(
      v.object({
        _id: v.id("familyMembers"),
        parentUserId: v.id("users"),
        name: v.string(),
        firstName: v.union(v.string(), v.null()),
        middleName: v.union(v.string(), v.null()),
        lastName: v.union(v.string(), v.null()),
        addressMode: v.union(v.literal("residential"), v.literal("different"), v.null()),
        addressOverride: v.union(v.string(), v.null()),
        effectiveAddress: v.union(v.string(), v.null()),
        addressSource: addressSourceValidator,
        portalState: portalAccountStateValidator,
        email: v.string(),
        phone: v.union(v.string(), v.null()),
        role: v.union(
          v.literal("parent"),
          v.literal("teacher"),
          v.literal("staff"),
          v.literal("admin"),
        ),
        relationship: v.union(v.string(), v.null()),
        isPrimaryContact: v.boolean(),
      }),
    ),
    students: v.array(
      v.object({
        _id: v.id("students"),
        studentName: v.string(),
        admissionNumber: v.string(),
        classId: v.id("classes"),
        className: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "enrollment.intakes.manage",
      });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    return await loadStudentFamilyProfile(ctx, schoolId, args.studentId);
  },
});

export const getParentEmailReview = query({
  args: {
    email: v.string(),
  },
  returns: v.object({
    email: v.string(),
    matches: v.array(
      v.object({
        userId: v.id("users"),
        name: v.string(),
        email: v.string(),
        phone: v.union(v.string(), v.null()),
        role: v.union(
          v.literal("student"),
          v.literal("parent"),
          v.literal("teacher"),
          v.literal("staff"),
          v.literal("admin"),
        ),
        isArchived: v.boolean(),
        families: v.array(
          v.object({
            _id: v.id("families"),
            name: v.string(),
            residentialAddress: v.union(v.string(), v.null()),
            contactAddressMode: v.union(v.literal("residential"), v.literal("different"), v.null()),
            contactAddressOverride: v.union(v.string(), v.null()),
            contactAddress: v.union(v.string(), v.null()),
            contactAddressSource: addressSourceValidator,
            primaryContact: v.union(v.null(), v.object({ userId: v.id("users"), name: v.string(), phone: v.union(v.string(), v.null()), email: v.string() })),
            studentCount: v.number(),
            parentCount: v.number(),
          }),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const trimmed = (args.email ?? "").trim().toLowerCase();
    if (!trimmed || !isEmailAddress(trimmed)) {
      return {
        email: trimmed,
        matches: [],
      };
    }

    const users = await findUsersByEmail(ctx, schoolId, trimmed);
    const matches = await Promise.all(
      users.map(async (user: any) => {
        const families =
          user.role !== "student" && !user.isArchived
            ? await summarizeFamiliesForParentUser(ctx, schoolId, user._id)
            : [];

        return {
          userId: user._id,
          name: getReadableUserName(user).displayName,
          email: user.email,
          phone: user.phone ?? null,
          role: user.role,
          isArchived: user.isArchived ?? false,
          families,
        };
      }),
    );

    return {
      email: trimmed,
      matches,
    };
  },
});

export const searchParentContacts = query({
  args: { search: v.string(), searchField: v.optional(v.union(v.literal("name"), v.literal("email"))), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, { capability: "enrollment.intakes.manage" });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 50 || args.search.length > 100)
      throw new ConvexError("Contact search supports pages of 1 to 50 and at most 100 search characters");
    const search = args.search.trim();
    const searchField = args.searchField ?? (search.includes("@") ? "email" : "name");
    const contacts = !search
      ? ctx.db.query("users").withIndex("by_school", q => q.eq("schoolId", actor.schoolId))
      : searchField === "email"
        ? ctx.db.query("users").withSearchIndex("search_email_and_school", q => q.search("email", search).eq("schoolId", actor.schoolId))
        : ctx.db.query("users").withSearchIndex("search_name_and_school", q => q.search("name", search).eq("schoolId", actor.schoolId));
    const result = await contacts
      .filter(q => q.and(q.neq(q.field("role"), "student"), q.neq(q.field("isArchived"), true)))
      .paginate(args.paginationOpts);
    const page = await Promise.all(result.page.map(async user => ({
      userId: user._id, ...getReadableUserName(user), email: user.email, phone: user.phone ?? null, role: user.role,
      portalState: await portalAccountState(ctx, user),
      households: await summarizeFamiliesForParentUser(ctx, actor.schoolId, user._id),
    })));
    return { ...result, page };
  },
});

export const updateHousehold = mutation({
  args: { familyId: v.id("families"), name: v.optional(v.string()), residentialAddress: v.optional(v.union(v.string(), v.null())), confirmed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, { capability: "enrollment.intakes.manage" });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);
    const family = await ctx.db.get(args.familyId);
    if (!family || family.schoolId !== actor.schoolId) throw new ConvexError("Household not found");
    if (!args.confirmed) throw new ConvexError("Confirm the household change for all inheriting contacts");
    const name = args.name === undefined ? family.name : normalizeOptionalText(args.name);
    if (!name) throw new ConvexError("Household label is required");
    await ctx.db.patch(family._id, { name, ...(args.residentialAddress !== undefined ? { residentialAddress: normalizeOptionalText(args.residentialAddress) } : {}), updatedAt: Date.now(), updatedBy: actor.userId });
    return null;
  },
});

function containsReference(value: unknown, id: string): boolean {
  if (value === id) return true;
  if (Array.isArray(value)) return value.some(entry => containsReference(entry, id));
  return value !== null && typeof value === "object" && Object.values(value).some(entry => containsReference(entry, id));
}

// Reuse the retention inventory. A bounded scan that cannot prove absence blocks
// deletion rather than removing a record with unseen retained references.
async function assertNoRetainedReferences(ctx: QueryCtx | MutationCtx, id: string, target: "users" | "families", ignoredIds = new Set<string>()) {
  const inventory = schemaReferenceInventory(schema);
  for (const table of Object.keys(schema.tables) as TableNames[]) {
    if (table !== "auditEvents" && !inventory[table].references.some(reference => reference.target === target)) continue;
    const rows = await ctx.db.query(table).take(101);
    if (rows.length > 100) throw new ConvexError(`Cannot prove this record is unused within the deletion review limit for ${table}. Retain it for operator review.`);
    if (rows.some(row => !ignoredIds.has(row._id) && containsReference(row, id)))
      throw new ConvexError(`This record has retained references in ${table} and cannot be deleted`);
  }
}

export const deleteUnusedParent = mutation({
  args: { parentUserId: v.id("users"), confirmed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, { capability: "enrollment.intakes.manage" });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);
    if (!args.confirmed) throw new ConvexError("Confirm permanent deletion of the unused school contact");
    const parent = await ctx.db.get(args.parentUserId);
    if (!parent || parent.schoolId !== actor.schoolId || parent.role !== "parent") throw new ConvexError("School parent not found");
    const links = await ctx.db.query("familyMembers").withIndex("by_parent_user", q => q.eq("parentUserId", parent._id)).take(101);
    if (links.length > 100 || links.some(link => link.schoolId !== actor.schoolId)) throw new ConvexError("Contact links require operator review");
    const ignoredIds = new Set<string>([parent._id, ...links.map(link => link._id)]);
    const emptyFamilies: Id<"families">[] = [];
    for (const familyId of new Set(links.map(link => link.familyId))) {
      const family = await ctx.db.get(familyId);
      if (!family || family.schoolId !== actor.schoolId) throw new ConvexError("Household links require operator review");
      const students = await ctx.db.query("students").withIndex("by_family", q => q.eq("familyId", familyId)).first();
      if (students) throw new ConvexError("Contact still has linked students, including retained or archived students");
      const members = await getFamilyMembers(ctx, familyId);
      if (members.every(member => member.parentUserId === parent._id)) {
        await assertNoRetainedReferences(ctx, String(familyId), "families", ignoredIds);
        emptyFamilies.push(familyId);
        ignoredIds.add(familyId);
      }
    }
    await assertNoRetainedReferences(ctx, String(parent._id), "users", ignoredIds);
    for (const link of links) await ctx.db.delete(link._id);
    for (const familyId of emptyFamilies) await ctx.db.delete(familyId);
    await ctx.db.delete(parent._id);
    return null;
  },
});

export const upsertStudentFamilyLink = mutation({
  args: {
    studentId: v.id("students"),
    parentUserId: v.optional(v.id("users")),
    firstName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    addressMode: v.optional(v.union(v.literal("residential"), v.literal("different"))),
    addressOverride: v.optional(v.union(v.string(), v.null())),
    confirmPrimaryChange: v.optional(v.boolean()),
    phone: v.optional(v.union(v.string(), v.null())),
    relationship: v.optional(v.union(v.string(), v.null())),
    familyName: v.optional(v.union(v.string(), v.null())),
    isPrimaryContact: v.optional(v.boolean()),
    confirmDuplicateLink: v.optional(v.boolean()),
  },
  returns: v.object({
    familyId: v.id("families"),
    parentUserId: v.id("users"),
    familyMemberId: v.id("familyMembers"),
    createdHousehold: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
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

    const selectedParent = args.parentUserId ? await ctx.db.get(args.parentUserId) : null;
    if (args.parentUserId && (!selectedParent || selectedParent.schoolId !== schoolId || selectedParent.isArchived || selectedParent.role === "student"))
      throw new ConvexError("Selected contact is not available in this school");
    const normalizedEmail = selectedParent?.email ?? normalizeOptionalEmail(args.email);
    if (!normalizedEmail) throw new ConvexError("Parent email is required");
    const relationship = normalizeOptionalText(args.relationship);
    const now = Date.now();

    const matchingUsers = await findUsersByEmail(
      ctx,
      schoolId,
      normalizedEmail,
    );
    const archivedDuplicate = matchingUsers.find(
      (candidate: any) => candidate.isArchived,
    );
    if (archivedDuplicate) {
      throw new ConvexError(archivedRecordNotice("parent"));
    }

    const activeUsers = matchingUsers.filter(
      (candidate: any) => !candidate.isArchived,
    );
    const activeStudentUsers = activeUsers.filter(
      (candidate: any) => candidate.role === "student",
    );
    const eligibleParentUsers = activeUsers.filter(
      (candidate: any) => candidate.role !== "student",
    );

    if (activeStudentUsers.length > 0) {
      throw new ConvexError("A student account cannot be linked as a parent");
    }

    if (eligibleParentUsers.length > 1) {
      throw new ConvexError(
        "Multiple school accounts share this email. Resolve the duplicate account first.",
      );
    }

    const matchedExistingParentUser = selectedParent ?? eligibleParentUsers[0] ?? null;
    const reusedExistingParent = matchedExistingParentUser !== null;
    let parentUser: Doc<"users"> | null = matchedExistingParentUser;

    if (!parentUser) {
      const normalizedPhone = normalizeOptionalPhone(args.phone);
      const parentName = resolveStoredUserNameFields({ firstName: args.firstName, middleName: args.middleName, lastName: args.lastName, requiredMessage: "Parent first and last name are required" });
      const parentUserId = await ctx.db.insert("users", {
        schoolId,
        authId: `parent:${String(schoolId)}:${normalizedEmail}`,
        name: parentName.name,
        ...(parentName.firstName ? { firstName: parentName.firstName } : {}),
        ...(parentName.middleName ? { middleName: parentName.middleName } : {}),
        ...(parentName.lastName ? { lastName: parentName.lastName } : {}),
        email: normalizedEmail,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
        role: "parent",
        createdAt: now,
        updatedAt: now,
      });
      parentUser = await ctx.db.get(parentUserId);

    }

    if (!parentUser) {
      throw new ConvexError("Parent record could not be created");
    }

    const studentName = getReadableUserName(studentUser);
    let familyId = student.familyId;
    let createdHousehold = false;
    let familyDoc: Doc<"families"> | null = null;

    if (familyId) {
      familyDoc = await ctx.db.get(familyId);
      if (!familyDoc || familyDoc.schoolId !== schoolId) {
        throw new ConvexError("Family not found");
      }
    } else {
      const familyName = buildFamilyName({
        studentName: studentName.displayName || studentUser.name,
        parentName: getReadableUserName(parentUser).displayName,
        familyName: args.familyName,
      });
      const parentFamilies = await findFamiliesForParentUser(
        ctx,
        schoolId,
        parentUser._id,
      );
      if (parentFamilies.length > 0) {
        familyDoc = parentFamilies[0];
        familyId = familyDoc._id;
      } else {
        familyId = await ctx.db.insert("families", {
          schoolId, name: familyName, residentialAddress: student.address,
          createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId,
        });
        familyDoc = await ctx.db.get(familyId);
        createdHousehold = true;
      }
    }

    if (!familyDoc) {
      throw new ConvexError("Family could not be created");
    }

    const familyMembers = await getFamilyMembers(ctx, familyDoc._id);
    const existingLink = familyMembers.find(
      (familyMember: any) =>
        String(familyMember.parentUserId) === String(parentUser._id),
    );

    const householdStudents = await getStudentsForFamily(ctx, familyDoc._id);
    if (reusedExistingParent && ((!args.parentUserId && !existingLink) || householdStudents.some((entry: Doc<"students">) => entry._id !== student._id)) && !args.confirmDuplicateLink) {
      throw new ConvexError(
        "This email already belongs to an existing parent. Review the duplicate-link details and confirm to continue.",
      );
    }

    if (
      !student.familyId ||
      String(student.familyId) !== String(familyDoc._id)
    ) {
      await ctx.db.patch(student._id, {
        familyId: familyDoc._id,
        updatedAt: now,
      });
    }

    const nextIsPrimaryContact =
      args.isPrimaryContact ??
      (familyMembers.length === 0 && !existingLink
        ? true
        : (existingLink?.isPrimaryContact ?? false));

    if (nextIsPrimaryContact && familyMembers.some((member: Doc<"familyMembers">) => member.isPrimaryContact && member.parentUserId !== parentUser._id) && !args.confirmPrimaryChange)
      throw new ConvexError("Confirm changing the primary contact for every student in this household");

    const addressPatch = contactAddressPatch(existingLink ? {} : args, existingLink);
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
      const nextRelationship =
        relationship !== undefined ? relationship : existingLink.relationship;
      await ctx.db.patch(existingLink._id, {
        ...addressPatch,
        relationship: nextRelationship,
        isPrimaryContact: nextIsPrimaryContact,
        updatedAt: now,
        updatedBy: userId,
      });

      return {
        familyId: familyDoc._id,
        parentUserId: parentUser._id,
        familyMemberId: existingLink._id,
        createdHousehold,
      };
    }

    const familyMemberId = await ctx.db.insert("familyMembers", {
      schoolId,
      familyId: familyDoc._id,
      parentUserId: parentUser._id,
      ...addressPatch,
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
      createdHousehold,
    };
  },
});

export const updateStudentFamilyParentContact = mutation({
  args: {
    familyMemberId: v.id("familyMembers"),
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    middleName: v.optional(v.union(v.string(), v.null())),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    addressMode: v.optional(v.union(v.literal("residential"), v.literal("different"))),
    addressOverride: v.optional(v.union(v.string(), v.null())),
    confirmPrimaryChange: v.optional(v.boolean()),
    phone: v.optional(v.union(v.string(), v.null())),
    relationship: v.optional(v.union(v.string(), v.null())),
    isPrimaryContact: v.optional(v.boolean()),
    confirmDuplicateEmail: v.optional(v.boolean()),
  },
  returns: v.object({
    familyId: v.id("families"),
    parentUserId: v.id("users"),
    familyMemberId: v.id("familyMembers"),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const familyMember = await ctx.db.get(args.familyMemberId);
    if (!familyMember || familyMember.schoolId !== schoolId) {
      throw new ConvexError("Family link not found");
    }

    const family = await ctx.db.get(familyMember.familyId);
    if (!family || family.schoolId !== schoolId) {
      throw new ConvexError("Family not found");
    }

    const parentUser = await ctx.db.get(familyMember.parentUserId);
    if (
      !parentUser ||
      parentUser.schoolId !== schoolId ||
      parentUser.isArchived ||
      parentUser.role === "student"
    ) {
      throw new ConvexError("Parent not found");
    }

    const relationship = normalizeOptionalText(args.relationship);
    const now = Date.now();

    // Staff may be family contacts, but their identity belongs to staff management.
    // Family edits may only change their relationship and primary-contact status.
    if (parentUser.role !== "parent") {
      const familyMembers = await getFamilyMembers(ctx, family._id);
      const nextIsPrimaryContact =
        args.isPrimaryContact ?? familyMember.isPrimaryContact;
      if (nextIsPrimaryContact && !familyMember.isPrimaryContact && familyMembers.some((member: Doc<"familyMembers">) => member.isPrimaryContact) && !args.confirmPrimaryChange)
        throw new ConvexError("Confirm changing the household primary contact");

      if (nextIsPrimaryContact) {
        for (const member of familyMembers) {
          if (
            String(member._id) !== String(familyMember._id) &&
            member.isPrimaryContact
          ) {
            await ctx.db.patch(member._id, {
              isPrimaryContact: false,
              updatedAt: now,
              updatedBy: userId,
            });
          }
        }
      }

      await ctx.db.patch(familyMember._id, {
        ...contactAddressPatch(args, familyMember),
        relationship: args.relationship === undefined ? familyMember.relationship : relationship,
        isPrimaryContact: nextIsPrimaryContact,
        updatedAt: now,
        updatedBy: userId,
      });

      return {
        familyId: family._id,
        parentUserId: parentUser._id,
        familyMemberId: familyMember._id,
      };
    }

    const normalizedEmail = args.email === undefined ? parentUser.email : normalizeOptionalEmail(args.email);
    if (!normalizedEmail) {
      throw new ConvexError("Parent email is required");
    }

    const matchingUsers = await findUsersByEmail(
      ctx,
      schoolId,
      normalizedEmail,
    );
    const archivedDuplicate = matchingUsers.find(
      (candidate: any) => candidate.isArchived,
    );
    if (archivedDuplicate) {
      throw new ConvexError(archivedRecordNotice("parent"));
    }

    const activeUsers = matchingUsers.filter(
      (candidate: any) => !candidate.isArchived,
    );
    const activeStudentUsers = activeUsers.filter(
      (candidate: any) => candidate.role === "student",
    );
    const eligibleParentUsers = activeUsers.filter(
      (candidate: any) => candidate.role !== "student",
    );

    if (activeStudentUsers.length > 0) {
      throw new ConvexError("A student account cannot be linked as a parent");
    }

    if (eligibleParentUsers.length > 1) {
      throw new ConvexError(
        "Multiple school accounts share this email. Resolve the duplicate account first.",
      );
    }

    const duplicateParentUser = eligibleParentUsers.find(
      (candidate: any) => String(candidate._id) !== String(parentUser._id),
    );
    if (duplicateParentUser && !args.confirmDuplicateEmail) {
      throw new ConvexError(
        "This email already belongs to an existing parent or staff member. Review the duplicate-link details and confirm to continue.",
      );
    }

    const normalizedPhone = normalizeOptionalPhone(args.phone);
    const parentName = resolveStoredUserNameFields({
      name: args.name,
      firstName: args.firstName,
      middleName: args.middleName,
      lastName: args.lastName,
      fallbackName: parentUser.name,
      fallbackFirstName: parentUser.firstName,
      fallbackMiddleName: parentUser.middleName,
      fallbackLastName: parentUser.lastName,
      requiredMessage: "Parent name is required",
    });
    const familyMembers = await getFamilyMembers(ctx, family._id);
    const nextIsPrimaryContact =
      args.isPrimaryContact ?? familyMember.isPrimaryContact;
    const targetParentUser = duplicateParentUser ?? parentUser;
    const duplicateFamilyMember = duplicateParentUser
      ? familyMembers.find(
          (member: any) =>
            String(member.parentUserId) === String(duplicateParentUser._id) &&
            String(member._id) !== String(familyMember._id),
        )
      : null;
    const targetFamilyMemberId = duplicateFamilyMember?._id ?? familyMember._id;
    if (nextIsPrimaryContact && familyMembers.some((member: Doc<"familyMembers">) => member.isPrimaryContact && member._id !== targetFamilyMemberId) && !args.confirmPrimaryChange)
      throw new ConvexError("Confirm changing the household primary contact");

    if (!duplicateParentUser) {
      await ctx.db.patch(parentUser._id, {
        ...parentName, email: normalizedEmail,
        ...(args.phone !== undefined ? { phone: normalizedPhone } : {}),
        updatedAt: now,
      });
    }

    if (nextIsPrimaryContact) {
      for (const member of familyMembers) {
        if (String(member._id) === String(targetFamilyMemberId)) {
          continue;
        }
        if (member.isPrimaryContact) {
          await ctx.db.patch(member._id, {
            isPrimaryContact: false,
            updatedAt: now,
            updatedBy: userId,
          });
        }
      }
    }

    if (duplicateFamilyMember) {
      await ctx.db.patch(duplicateFamilyMember._id, {
        ...contactAddressPatch(args, duplicateFamilyMember),
        relationship: args.relationship === undefined ? duplicateFamilyMember.relationship : relationship,
        isPrimaryContact: nextIsPrimaryContact,
        updatedAt: now,
        updatedBy: userId,
      });
      await ctx.db.delete(familyMember._id);
    } else {
      await ctx.db.patch(familyMember._id, {
        parentUserId: targetParentUser._id,
        ...contactAddressPatch(args, familyMember),
        relationship: args.relationship === undefined ? familyMember.relationship : relationship,
        isPrimaryContact: nextIsPrimaryContact,
        updatedAt: now,
        updatedBy: userId,
      });
    }

    const updatedFamilyMembers = await getFamilyMembers(ctx, family._id);
    if (updatedFamilyMembers.length > 0) {
      const hasPrimaryContact = updatedFamilyMembers.some(
        (member: any) => member.isPrimaryContact,
      );
      if (!hasPrimaryContact) {
        await ctx.db.patch(updatedFamilyMembers[0]._id, {
          isPrimaryContact: true,
          updatedAt: now,
          updatedBy: userId,
        });
      }
    }

    return {
      familyId: family._id,
      parentUserId: targetParentUser._id,
      familyMemberId: targetFamilyMemberId,
    };
  },
});

export const unlinkStudentFromFamily = mutation({
  args: { studentId: v.id("students") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { schoolId, role, userId } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
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
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(
      ctx,
      { capability: "enrollment.intakes.manage" },
    );
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
    const activeStudents = linkedStudents.filter(
      (student: any) => !student.isArchived,
    );

    if (
      remainingMembersBeforeDelete.length === 1 &&
      activeStudents.length > 0
    ) {
      throw new ConvexError(
        "Cannot remove the last parent from a family that still has linked students. Unlink the student from the family instead.",
      );
    }

    const wasPrimaryContact = familyMember.isPrimaryContact;
    await ctx.db.delete(args.familyMemberId);

    if (wasPrimaryContact) {
      const remainingMembers = await getFamilyMembers(ctx, family._id);
      const nextPrimaryMember = remainingMembers.find(
        (member: any) => member.isPrimaryContact,
      );
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
  operationId: string;
};

async function upsertPortalCredentialsHandler(
  ctx: ActionCtx,
  args: { userId: Id<"users">; temporaryPassword: string; requestKey?: string },
): Promise<PortalCredentialProvisionResult> {
  const operationId = args.requestKey ?? crypto.randomUUID();
  if (!operationId || operationId.length > 100) throw new ConvexError("Invalid portal operation key");
  // Preparation cannot change credentials; do it before claiming a mutating operation.
  await ctx.runQuery(api.functions.academic.studentEnrollment.getPortalAccountState, { userId: args.userId });
  const preparedPassword = await prepareSchoolPortalPassword(ctx, args.temporaryPassword);
  const target: { userId: Id<"users">; schoolId: Id<"schools">; name: string; email: string; authId: string } =
    await ctx.runMutation(internal.functions.academic.studentEnrollment.beginPortalProvisionInternal, { userId: args.userId, operationId });
  try {
    const authId = await provisionSchoolPortalAuthUser(ctx, {
      appUserId: String(target.userId), currentAuthId: target.authId, email: target.email,
      name: target.name, preparedPassword,
      portalOperation: { userId: target.userId, schoolId: target.schoolId, operationId },
    });
    await ctx.runMutation(internal.functions.academic.studentEnrollment.finishPortalProvisionInternal, {
      userId: target.userId, schoolId: target.schoolId, operationId, authId,
    });
  } catch (error) {
    await ctx.runMutation(internal.functions.academic.studentEnrollment.finishPortalProvisionInternal, {
      userId: target.userId, schoolId: target.schoolId, operationId,
    });
    throw error;
  }
  return { userId: target.userId, email: target.email, temporaryPassword: args.temporaryPassword, operationId };
}

export const upsertPortalCredentials = action({
  args: {
    userId: v.id("users"),
    requestKey: v.optional(v.string()),
    temporaryPassword: v.string(),
  },
  returns: v.object({
    userId: v.id("users"),
    email: v.string(),
    temporaryPassword: v.string(),
    operationId: v.string(),
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
    }),
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
  ctx: ActionCtx,
  args: {
    studentId: Id<"students">;
    temporaryPassword: string;
    requestKey?: string;
  },
): Promise<PortalCredentialProvisionResult> => {
  const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {
    capability: "enrollment.intakes.manage",
  });
  if (!viewer) {
    throw new ConvexError("Unauthorized");
  }
  if (viewer.isSchoolAdmin !== true) {
    throw new ConvexError("Admin access required");
  }

  const target = (await ctx.runQuery(
    (internal as any).functions.academic.studentEnrollment
      .getStudentPortalTargetInternal,
    {
      studentId: args.studentId,
      schoolId: viewer.schoolId,
    },
  )) as { userId: Id<"users"> } | null;

  if (!target) {
    throw new ConvexError("Student not found");
  }

  return await upsertPortalCredentialsHandler(ctx, {
    userId: target.userId,
    temporaryPassword: args.temporaryPassword,
    requestKey: args.requestKey,
  });
};

export const upsertStudentPortalCredentialsByStudentId = action({
  args: {
    studentId: v.id("students"),
    requestKey: v.optional(v.string()),
    temporaryPassword: v.string(),
  },
  returns: v.object({
    userId: v.id("users"),
    email: v.string(),
    temporaryPassword: v.string(),
    operationId: v.string(),
  }),
  handler: upsertStudentPortalCredentialsByStudentIdHandler,
});

export const getStudentAttestationData = query({
  args: { studentId: v.id("students") },
  returns: v.object({
    student: v.object({
      _id: v.id("students"),
      fullName: v.string(),
      firstName: v.union(v.string(), v.null()),
      middleName: v.union(v.string(), v.null()),
      lastName: v.union(v.string(), v.null()),
      admissionNumber: v.string(),
      gender: v.union(v.string(), v.null()),
      dateOfBirth: v.union(v.number(), v.null()),
      enrollmentDate: v.number(),
      enrollmentStatus: v.string(),
      photoUrl: v.union(v.string(), v.null()),
      className: v.string(),
      gradeName: v.union(v.string(), v.null()),
    }),
    graduation: v.union(
      v.object({
        graduationDate: v.number(),
        certificateNumber: v.union(v.string(), v.null()),
        honorsOrRemarks: v.union(v.string(), v.null()),
        graduatingClassName: v.string(),
        graduatingSessionName: v.string(),
      }),
      v.null(),
    ),
    school: v.object({
      name: v.string(),
      slug: v.string(),
      motto: v.union(v.string(), v.null()),
      logoUrl: v.union(v.string(), v.null()),
      contactEmail: v.union(v.string(), v.null()),
      contactPhone: v.union(v.string(), v.null()),
      address: v.union(v.string(), v.null()),
      principalName: v.union(v.string(), v.null()),
    }),
    issuedAt: v.number(),
    referenceCode: v.string(),
  }),
  handler: async (ctx, args) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx, {
      capability: "enrollment.intakes.manage",
    });
    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== schoolId || student.isArchived) {
      throw new ConvexError("Student not found");
    }

    const [studentUser, classDoc, schoolDoc, photoUrl, graduationDoc] =
      await Promise.all([
        ctx.db.get(student.userId),
        ctx.db.get(student.classId),
        ctx.db.get(schoolId),
        student.photoStorageId
          ? getUnboundStorageUrl(ctx, student.photoStorageId)
          : null,
        student.graduatingSessionId
          ? ctx.db
              .query("studentGraduations")
              .withIndex("by_student_and_session", (q) =>
                q
                  .eq("studentId", student._id)
                  .eq("sessionId", student.graduatingSessionId!),
              )
              .first()
          : ctx.db
              .query("studentGraduations")
              .withIndex("by_student", (q) => q.eq("studentId", student._id))
              .first(),
      ]);

    if (!studentUser || !schoolDoc || !classDoc) {
      throw new ConvexError("Required academic records not found");
    }

    const studentName = getReadableUserName(studentUser);
    const schoolLogoUrl = schoolDoc.logoStorageId
      ? await getUnboundStorageUrl(ctx, schoolDoc.logoStorageId)
      : null;

    let principalName: string | null = null;
    const adminUser = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .filter((q) =>
        q.and(
          q.eq(q.field("role"), "admin"),
          q.neq(q.field("isArchived"), true),
        ),
      )
      .first();
    if (adminUser) {
      principalName = getReadableUserName(adminUser).displayName || null;
    }

    let graduationDetails = null;
    if (graduationDoc) {
      const [gradClass, gradSession] = await Promise.all([
        ctx.db.get(graduationDoc.classId),
        ctx.db.get(graduationDoc.sessionId),
      ]);
      graduationDetails = {
        graduationDate: graduationDoc.graduationDate,
        certificateNumber: graduationDoc.certificateNumber ?? null,
        honorsOrRemarks: graduationDoc.honorsOrRemarks ?? null,
        graduatingClassName: gradClass
          ? normalizeHumanName(gradClass.name)
          : normalizeHumanName(classDoc.name),
        graduatingSessionName: gradSession
          ? normalizeHumanName(gradSession.name)
          : "Graduating Session",
      };
    }

    const issuedAt = Date.now();
    const cleanSlug = schoolDoc.slug.toUpperCase().slice(0, 4);
    const cleanAdm = student.admissionNumber.replace(/[^A-Za-z0-9]/g, "");
    const referenceCode = `ATT-${cleanSlug}-${cleanAdm}-${new Date(issuedAt).getFullYear()}`;

    return {
      student: {
        _id: student._id,
        fullName: studentName.displayName || "Student",
        firstName: studentName.firstName,
        middleName: studentName.middleName,
        lastName: studentName.lastName,
        admissionNumber: student.admissionNumber,
        gender: student.gender ?? null,
        dateOfBirth: student.dateOfBirth ?? null,
        enrollmentDate: student.createdAt,
        enrollmentStatus: student.enrollmentStatus ?? "active",
        photoUrl,
        className: normalizeHumanName(classDoc.name),
        gradeName: classDoc.gradeName ?? null,
      },
      graduation: graduationDetails,
      school: {
        name: normalizeHumanName(schoolDoc.name),
        slug: schoolDoc.slug,
        motto: schoolDoc.motto ?? null,
        logoUrl: schoolLogoUrl,
        contactEmail: schoolDoc.contactEmail ?? null,
        contactPhone: schoolDoc.contactPhone ?? null,
        address: schoolDoc.address ?? null,
        principalName,
      },
      issuedAt,
      referenceCode,
    };
  },
});
