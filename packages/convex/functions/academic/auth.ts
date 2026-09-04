import { ConvexError, v } from "convex/values";
import { query } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { getDerivedUmbrellaSubjectIdsForClass } from "./subjectAggregationHelpers";
import { isTrustedLegacySubjectIssuer, resolveTokenFirstTrustedLegacyRow } from "./identityResolver";

/**
 * Get authenticated user and their school membership
 * 
 * @throws ConvexError "Unauthorized" if not authenticated
 * @throws ConvexError "School membership not found" if user has no school
 */
export async function getAuthenticatedSchoolMembership(
  ctx: any,
  options?: { allowSuspended?: boolean }
): Promise<{
  userId: Id<"users">;
  schoolId: Id<"schools">;
  role: string;
  isSchoolAdmin: boolean;
  isSuspended: boolean;
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized");
  }

  const user = await resolveTokenFirstTrustedLegacyRow<Doc<"users">>(identity, {
    byTokenIdentifier: (tokenIdentifier) =>
      ctx.db
        .query("users")
        .withIndex("by_auth_token_identifier", (q: any) =>
          q.eq("authTokenIdentifier", tokenIdentifier)
        )
        .take(2),
    bySubject: (subject) =>
      ctx.db
        .query("users")
        .withIndex("by_auth", (q: any) => q.eq("authId", subject))
        .take(2),
  });

  if (!user) {
    throw new ConvexError("School membership not found");
  }

  if (user.isArchived) {
    throw new ConvexError("Your account has been archived");
  }

  const school = await ctx.db.get(user.schoolId);
  const isSuspended = school?.status === "suspended";
  if (!options?.allowSuspended && isSuspended) {
    throw new ConvexError("This school workspace is currently suspended by platform administration");
  }

  return {
    userId: user._id,
    schoolId: user.schoolId,
    role: user.role,
    isSchoolAdmin: user.role === "admin" || user.isSchoolAdmin === true,
    isSuspended,
  };
}

/**
 * Assert that a teacher is assigned to a class-subject pair
 * 
 * @throws ConvexError "Not assigned to this class-subject" if no matching assignment
 */
export async function assertTeacherAssignment(
  ctx: any,
  teacherId: Id<"users">,
  classId: Id<"classes">,
  subjectId: Id<"subjects">
): Promise<void> {
  const hasAssignment = await teacherHasClassSubjectAccess(
    ctx,
    teacherId,
    classId,
    subjectId
  );

  if (!hasAssignment) {
    throw new ConvexError("Not assigned to this class-subject");
  }
}

export async function getTeacherAssignableClassIds(
  ctx: any,
  teacherId: Id<"users">,
  schoolId: Id<"schools">
): Promise<Array<Id<"classes">>> {
  const linkedTeacherIds = await getLinkedTeacherIds(ctx, teacherId, schoolId);
  const teacherAssignments = await ctx.db
    .query("teacherAssignments")
    .withIndex("by_teacher", (q: any) => q.eq("teacherId", teacherId))
    .collect();
  const classOfferings = await ctx.db
    .query("classSubjects")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();
  const schoolClasses = await ctx.db
    .query("classes")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();
  const schoolSubjects = await ctx.db
    .query("subjects")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();

  const activeClassIds = new Set(
    schoolClasses
      .filter((classDoc: any) => !classDoc.isArchived)
      .map((classDoc: any) => String(classDoc._id))
  );
  const activeSubjectIds = new Set(
    schoolSubjects
      .filter((subject: any) => !subject.isArchived)
      .map((subject: any) => String(subject._id))
  );

  const classIds = new Set<string>();

  for (const assignment of teacherAssignments) {
    if (
      String(assignment.schoolId) === String(schoolId) &&
      linkedTeacherIds.has(String(assignment.teacherId)) &&
      activeClassIds.has(String(assignment.classId)) &&
      activeSubjectIds.has(String(assignment.subjectId))
    ) {
      classIds.add(String(assignment.classId));
    }
  }

  for (const offering of classOfferings) {
    if (
      activeClassIds.has(String(offering.classId)) &&
      activeSubjectIds.has(String(offering.subjectId)) &&
      offering.teacherId &&
      linkedTeacherIds.has(String(offering.teacherId))
    ) {
      classIds.add(String(offering.classId));
    }
  }

  for (const classDoc of schoolClasses) {
    if (
      !classDoc.isArchived &&
      classDoc.formTeacherId &&
      linkedTeacherIds.has(String(classDoc.formTeacherId))
    ) {
      classIds.add(String(classDoc._id));
    }
  }

  return [...classIds] as Array<Id<"classes">>;
}

export async function getTeacherAssignableSubjectIds(
  ctx: any,
  teacherId: Id<"users">,
  schoolId: Id<"schools">,
  classId: Id<"classes">
): Promise<Array<Id<"subjects">>> {
  const linkedTeacherIds = await getLinkedTeacherIds(ctx, teacherId, schoolId);
  const classDoc = await ctx.db.get(classId);
  if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
    return [];
  }
  const teacherAssignments = await ctx.db
    .query("teacherAssignments")
    .withIndex("by_teacher_and_class", (q: any) =>
      q.eq("teacherId", teacherId).eq("classId", classId)
    )
    .collect();
  const classOfferings = await ctx.db
    .query("classSubjects")
    .withIndex("by_class", (q: any) => q.eq("classId", classId))
    .collect();
  const schoolSubjects = await ctx.db
    .query("subjects")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();

  const activeSubjectIds = new Set(
    schoolSubjects
      .filter((subject: any) => !subject.isArchived)
      .map((subject: any) => String(subject._id))
  );

  const subjectIds = new Set<string>();

  for (const assignment of teacherAssignments) {
    if (
      String(assignment.schoolId) === String(schoolId) &&
      linkedTeacherIds.has(String(assignment.teacherId)) &&
      activeSubjectIds.has(String(assignment.subjectId))
    ) {
      subjectIds.add(String(assignment.subjectId));
    }
  }

  for (const offering of classOfferings) {
    if (
      String(offering.schoolId) === String(schoolId) &&
      activeSubjectIds.has(String(offering.subjectId)) &&
      offering.teacherId &&
      linkedTeacherIds.has(String(offering.teacherId))
    ) {
      subjectIds.add(String(offering.subjectId));
    }
  }

  const isFormTeacher =
    classDoc &&
    String(classDoc.schoolId) === String(schoolId) &&
    classDoc.formTeacherId &&
    linkedTeacherIds.has(String(classDoc.formTeacherId));

  if (isFormTeacher) {
    for (const offering of classOfferings) {
      if (
        String(offering.schoolId) === String(schoolId) &&
        activeSubjectIds.has(String(offering.subjectId))
      ) {
        subjectIds.add(String(offering.subjectId));
      }
    }
  }

  const derivedUmbrellaIds = await getDerivedUmbrellaSubjectIdsForClass(ctx, {
    schoolId,
    classId,
  });

  return [...subjectIds].filter(
    (subjectId) => !derivedUmbrellaIds.has(String(subjectId))
  ) as Array<Id<"subjects">>;
}

export async function teacherHasClassAccess(
  ctx: any,
  teacherId: Id<"users">,
  schoolId: Id<"schools">,
  classId: Id<"classes">
): Promise<boolean> {
  const classIds = await getTeacherAssignableClassIds(ctx, teacherId, schoolId);

  return classIds.some((id) => String(id) === String(classId));
}

async function teacherHasClassSubjectAccess(
  ctx: any,
  teacherId: Id<"users">,
  classId: Id<"classes">,
  subjectId: Id<"subjects">
): Promise<boolean> {
  const classDoc = await ctx.db.get(classId);
  const subjectDoc = await ctx.db.get(subjectId);
  if (
    !classDoc ||
    classDoc.isArchived ||
    !subjectDoc ||
    subjectDoc.isArchived
  ) {
    return false;
  }
  const schoolId = classDoc?.schoolId;
  const linkedTeacherIds = schoolId
    ? await getLinkedTeacherIds(ctx, teacherId, schoolId)
    : new Set<string>([String(teacherId)]);
  const assignment = await ctx.db
    .query("teacherAssignments")
    .withIndex("by_teacher_and_class_and_subject", (q: any) =>
      q
        .eq("teacherId", teacherId)
        .eq("classId", classId)
        .eq("subjectId", subjectId)
    )
    .unique();

  if (assignment) {
    return true;
  }

  if (
    classDoc &&
    !classDoc.isArchived &&
    classDoc.formTeacherId &&
    linkedTeacherIds.has(String(classDoc.formTeacherId))
  ) {
    const offering = await ctx.db
      .query("classSubjects")
      .withIndex("by_class_and_subject", (q: any) =>
        q.eq("classId", classId).eq("subjectId", subjectId)
      )
      .unique();

    if (offering) {
      return true;
    }
  }

  const offering = await ctx.db
    .query("classSubjects")
    .withIndex("by_class_and_subject", (q: any) =>
      q.eq("classId", classId).eq("subjectId", subjectId)
    )
    .unique();

  return Boolean(
    offering &&
      offering.teacherId &&
      linkedTeacherIds.has(String(offering.teacherId))
  );
}

async function getLinkedTeacherIds(
  ctx: any,
  teacherId: Id<"users">,
  schoolId: Id<"schools">
): Promise<Set<string>> {
  const teacherIds = new Set<string>([String(teacherId)]);
  const currentTeacher = await ctx.db.get(teacherId);

  if (!currentTeacher?.email || currentTeacher.isArchived) {
    return teacherIds;
  }

  const schoolUsers = await ctx.db
    .query("users")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();

  for (const user of schoolUsers) {
    if (
      user.role === "teacher" &&
      !user.isArchived &&
      typeof user.email === "string" &&
      user.email.toLowerCase() === currentTeacher.email.toLowerCase()
    ) {
      teacherIds.add(String(user._id));
    }
  }

  return teacherIds;
}

/**
 * Assert that user is an admin for the specified school
 * 
 * @throws ConvexError "Admin access required" if user role is not admin
 * @throws ConvexError "Cross-school access denied" if user.schoolId !== schoolId
 */
export async function assertAdminForSchool(
  ctx: any,
  userId: Id<"users">,
  schoolId: Id<"schools">,
  role: string
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user || user.schoolId !== schoolId) {
    throw new ConvexError("Cross-school access denied");
  }

  if (user.role !== "admin" && user.isSchoolAdmin !== true) {
    throw new ConvexError("Admin access required");
  }
}

/**
 * Assert that user belongs to the specified school
 * 
 * @throws ConvexError "Cross-school access denied" if user.schoolId !== schoolId
 */
export async function assertSchoolBoundary(
  ctx: any,
  userId: Id<"users">,
  schoolId: Id<"schools">
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user || user.schoolId !== schoolId) {
    throw new ConvexError("Cross-school access denied");
  }
}

export interface ActiveMembershipContext {
  personId?: Id<"persons">;
  membershipId?: Id<"branchMemberships">;
  schoolId: Id<"schools">;
  userId?: Id<"users">;
  role: string;
  isPlatformAdmin: boolean;
}

/**
 * Resolves the authenticated user's active membership in the target school branch.
 * Enforces strict branch tenancy isolation with super admin bypass and legacy bridge fallback.
 *
 * @param ctx - Convex QueryCtx or MutationCtx
 * @param schoolId - Target school branch ID
 * @returns ActiveMembershipContext with personId, membershipId, schoolId, userId, role, isPlatformAdmin
 * @throws ConvexError("Not authorized: User does not have an active membership in this branch")
 */
export async function resolveActiveMembership(
  ctx: any,
  schoolId: Id<"schools">
): Promise<ActiveMembershipContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError(
      "Not authorized: User does not have an active membership in this branch"
    );
  }

  const tokenIdentifier: string | undefined = identity.tokenIdentifier;

  // 1. Check platformAdmins for Super Admin bypass. Duplicate canonical tokens
  // are an authorization failure, never an arbitrary first match.
  const platformAdminMatches = tokenIdentifier
    ? await ctx.db
        .query("platformAdmins")
        .withIndex("by_auth_token_identifier", (q: any) =>
          q.eq("authTokenIdentifier", tokenIdentifier)
        )
        .take(2)
    : [];
  if (platformAdminMatches.length > 1) {
    throw new ConvexError("Not authorized: ambiguous platform identity");
  }
  const platformAdmin = platformAdminMatches[0] ?? null;

  if (platformAdmin) {
    if (!platformAdmin.isActive) {
      throw new ConvexError(
        "Not authorized: User does not have an active membership in this branch"
      );
    }
    return {
      schoolId,
      role: "super_admin",
      isPlatformAdmin: true,
    };
  }

  // 2. Resolve the canonical person exclusively through the stable token identifier.
  const personMatches = tokenIdentifier
    ? await ctx.db
        .query("persons")
        .withIndex("by_token_identifier", (q: any) =>
          q.eq("authTokenIdentifier", tokenIdentifier)
        )
        .take(2)
    : [];
  if (personMatches.length > 1) {
    throw new ConvexError("Not authorized: ambiguous canonical identity");
  }
  const person = personMatches[0] ?? null;

  // 3. If person exists, query branchMemberships for requested schoolId
  if (person && person.status === "active") {
    const membership = await ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_school", (q: any) =>
        q.eq("personId", person._id).eq("schoolId", schoolId)
      )
      .first();

    if (membership && membership.status === "active") {
      const linkedLegacyUser = membership.legacyUserId
        ? await ctx.db.get(membership.legacyUserId)
        : null;
      if (
        linkedLegacyUser &&
        linkedLegacyUser.authTokenIdentifier &&
        linkedLegacyUser.authTokenIdentifier !== tokenIdentifier
      ) {
        throw new ConvexError("Not authorized: mismatched legacy identity link");
      }

      if (!linkedLegacyUser) {
        const schoolUsers = await ctx.db
          .query("users")
          .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
          .collect();
        const matchingUsers = schoolUsers.filter(
          (u: any) =>
            !u.isArchived &&
            (u.personId === person._id ||
              (tokenIdentifier && u.authTokenIdentifier === tokenIdentifier))
        );
        if (matchingUsers.length > 1) {
          throw new ConvexError("Not authorized: ambiguous legacy identity link");
        }
        return {
          personId: person._id,
          membershipId: membership._id,
          schoolId,
          userId: matchingUsers[0]?._id,
          role: matchingUsers[0]?.role ?? "member",
          isPlatformAdmin: false,
        };
      }

      return {
        personId: person._id,
        membershipId: membership._id,
        schoolId,
        userId: linkedLegacyUser._id,
        role: linkedLegacyUser.role,
        isPlatformAdmin: false,
      };
    }
  }

  // 4. Compatibility bridge. A canonical prelink must exactly match the token.
  // An otherwise unlinked legacy row may use only its exact historical authId
  // and the provider subject; subject is never promoted to a canonical token.
  const schoolUsers = await ctx.db
    .query("users")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();
  const tokenUsers = schoolUsers.filter(
    (u: any) => !u.isArchived && tokenIdentifier && u.authTokenIdentifier === tokenIdentifier
  );
  if (tokenUsers.length > 1) {
    throw new ConvexError("Not authorized: ambiguous canonical identity link");
  }
  if (tokenUsers.length === 1) {
    const legacyUser = tokenUsers[0];
    if (legacyUser.personId) {
      const linkedPerson = await ctx.db.get(legacyUser.personId);
      if (linkedPerson?.authTokenIdentifier && linkedPerson.authTokenIdentifier !== tokenIdentifier) {
        throw new ConvexError("Not authorized: mismatched canonical identity link");
      }
    }
    return {
      personId: legacyUser.personId,
      membershipId: undefined,
      schoolId,
      userId: legacyUser._id,
      role: legacyUser.role,
      isPlatformAdmin: false,
    };
  }

  const subjectUsers = identity.subject && isTrustedLegacySubjectIssuer(identity.issuer)
    ? schoolUsers.filter(
        (u: any) =>
          !u.isArchived &&
          !u.authTokenIdentifier &&
          u.authId === identity.subject
      )
    : [];
  if (subjectUsers.length !== 1) {
    throw new ConvexError("Not authorized: User does not have an active membership in this branch");
  }
  const legacyUser = subjectUsers[0];
  const linkedPerson = legacyUser.personId
    ? await ctx.db.get(legacyUser.personId)
    : null;
  if (linkedPerson?.authTokenIdentifier) {
    throw new ConvexError("Not authorized: mismatched legacy identity link");
  }
  return {
    personId: legacyUser.personId,
    membershipId: undefined,
    schoolId,
    userId: legacyUser._id,
    role: legacyUser.role,
    isPlatformAdmin: false,
  };
}

export const getActiveMembership = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    return await resolveActiveMembership(ctx, args.schoolId);
  },
});

