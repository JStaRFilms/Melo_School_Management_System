import { ConvexError, v } from "convex/values";
import { query, type QueryCtx, type MutationCtx } from "../../_generated/server";
import { Doc, Id } from "../../_generated/dataModel";
import { getDerivedUmbrellaSubjectIdsForClass } from "./subjectAggregationHelpers";
import { isTrustedLegacySubjectIssuer, resolveTokenFirstTrustedLegacyRow } from "./identityResolver";
import { getContextCapabilities, isPermissionManaged, normalizeCapability, type PermissionCapability } from "./rbac";

/**
 * Get authenticated user and their school membership
 * 
 * @throws ConvexError "Unauthorized" if not authenticated
 * @throws ConvexError "School membership not found" if user has no school
 */
export async function getAuthenticatedSchoolMembership(
  ctx: QueryCtx | MutationCtx,
  options?: { allowSuspended?: boolean; schoolId?: Id<"schools">; capability?: PermissionCapability | readonly PermissionCapability[]; membershipOnly?: boolean }
): Promise<{
  userId: Id<"users">;
  schoolId: Id<"schools">;
  role: string;
  isSchoolAdmin: boolean;
  isSuspended: boolean;
}> {
  if (!(await ctx.auth.getUserIdentity())) throw new ConvexError("Unauthorized");
  const defaultUser = options?.schoolId ? null : await resolveLegacyViewer(ctx);
  const schoolId = options?.schoolId ?? defaultUser?.schoolId;
  if (!schoolId) throw new ConvexError("School membership not found");
  // allowSuspended is a legacy default-read exception, never a selected-branch bypass.
  const school = await ctx.db.get(schoolId);
  const isSuspended = school?.status === "suspended";
  const context = await resolveActiveMembership(ctx, schoolId, {
    allowSuspended: options?.allowSuspended === true && !options.schoolId,
  });
  if (context.isPlatformAdmin) throw new ConvexError("Forbidden: Platform governance does not authorize tenant operations");
  const managed = await isPermissionManaged(ctx, context);
  if (options?.capability) {
    // Only untouched accounts keep role/assignment-scoped legacy API compatibility.
    // New RBAC-only APIs never infer sensitive capabilities from that legacy role.
    if (managed) {
      const required = typeof options.capability === "string" ? [options.capability] : options.capability;
      const effective = await getContextCapabilities(ctx, context);
      if (!required.some(cap => effective.some(value => normalizeCapability(value) === normalizeCapability(cap))))
        throw new ConvexError("Forbidden: Required operation capability is missing");
    }
  } else if (managed && !options?.membershipOnly) {
    throw new ConvexError("Forbidden: This legacy API has no reviewed capability contract");
  }
  const user = context.userId ? await ctx.db.get(context.userId) : null;
  if (!user) throw new ConvexError({ code: "RECONCILIATION_REQUIRED", message: "Reviewed legacy user mapping required" });
  if (user.isArchived) throw new ConvexError("Your account has been archived");

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
    subjectDoc.isArchived ||
    subjectDoc.schoolId !== classDoc.schoolId
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

  if (assignment && assignment.schoolId === schoolId && linkedTeacherIds.has(String(assignment.teacherId))) {
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

    if (offering && offering.schoolId === schoolId) {
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
      offering.schoolId === schoolId &&
      offering.teacherId &&
      linkedTeacherIds.has(String(offering.teacherId))
  );
}

async function getLinkedTeacherIds(
  ctx: any,
  teacherId: Id<"users">,
  schoolId: Id<"schools">
): Promise<Set<string>> {
  const teacher = await ctx.db.get(teacherId);
  // Branch projections must be explicitly selected by membership, not joined by email.
  return teacher && !teacher.isArchived && teacher.schoolId === schoolId
    ? new Set<string>([String(teacherId)])
    : new Set<string>();
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

/** Exact token / trusted historical subject only. Never match contact data. */
export async function resolveLegacyViewer(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return resolveTokenFirstTrustedLegacyRow(identity, {
    byTokenIdentifier: (token) => ctx.db.query("users")
      .withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", token)).take(2),
    bySubject: (subject) => ctx.db.query("users")
      .withIndex("by_auth", (q) => q.eq("authId", subject)).take(2),
  });
}

export async function resolveActiveMembership(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  options?: { allowSuspended?: boolean }
): Promise<ActiveMembershipContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in required" });
  const deny = (message: string): never => {
    throw new ConvexError({ code: "FORBIDDEN", message });
  };
  const reconcile = (message: string): never => {
    throw new ConvexError({ code: "RECONCILIATION_REQUIRED", message });
  };
  const school = await ctx.db.get(schoolId);
  if (!school) return deny("School workspace not found");
  let platformMatches = await ctx.db.query("platformAdmins")
    .withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).take(2);
  if (platformMatches.length === 0 && isTrustedLegacySubjectIssuer(identity.issuer)) {
    const legacyPlatform = await ctx.db.query("platformAdmins")
      .withIndex("by_auth", q => q.eq("authId", identity.subject)).take(2);
    if (legacyPlatform.length > 1) return reconcile("Not authorized: ambiguous platform identity");
    platformMatches = legacyPlatform.filter(row => !row.authTokenIdentifier);
  }
  if (platformMatches.length > 1) return reconcile("Not authorized: ambiguous platform identity");
  if (platformMatches[0]) {
    if (!platformMatches[0].isActive) return deny("Platform account is inactive");
    // Identity context only. Tenant capability and legacy operation helpers reject Platform.
    return { schoolId, role: "super_admin", isPlatformAdmin: true };
  }
  if (school.status === "suspended" && !options?.allowSuspended) {
    throw new ConvexError({ code: "WORKSPACE_SUSPENDED", message: "This school workspace is currently suspended by platform administration" });
  }
  const persons = await ctx.db.query("persons")
    .withIndex("by_token_identifier", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier)).take(2);
  if (persons.length > 1) return reconcile("Not authorized: ambiguous canonical identity");
  const person = persons[0];
  if (person) {
    if (person.status !== "active") return deny("Canonical account is inactive");
    if (person.identityReconciliationState === "reconciliation_required") return reconcile("Identity reconciliation required");
    const memberships = await ctx.db.query("branchMemberships")
      .withIndex("by_person_and_school", (q) => q.eq("personId", person._id).eq("schoolId", schoolId)).take(2);
    if (memberships.length > 1) return reconcile("Not authorized: ambiguous branch membership");
    const membership = memberships[0];
    // Canonical presence is terminal: revocation or missing mapping cannot bridge back.
    if (!membership) return reconcile("Not authorized: User does not have an active membership in this branch; reviewed mapping required");
    if (membership.status !== "active") return deny("Not authorized: User does not have an active membership in this branch");
    const user = membership.legacyUserId ? await ctx.db.get(membership.legacyUserId) : null;
    if (membership.legacyUserId && (!user || user.schoolId !== schoolId ||
        (user.personId && user.personId !== person._id) ||
        (user.authTokenIdentifier && user.authTokenIdentifier !== identity.tokenIdentifier))) {
      return reconcile("Not authorized: mismatched legacy identity link");
    }
    if (user?.isArchived) return deny("Your account has been archived");
    return { personId: person._id, membershipId: membership._id, schoolId,
      userId: user?._id, role: user?.role ?? "member", isPlatformAdmin: false };
  }
  let user: Doc<"users"> | null;
  try {
    user = await resolveLegacyViewer(ctx);
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    return reconcile(`Not authorized: ${String(error.data)}`);
  }
  if (!user || user.schoolId !== schoolId || user.isArchived) {
    return deny("Not authorized: User does not have an active membership in this branch");
  }
  // A prelinked person without a matching canonical token needs reviewed repair.
  if (user.personId) return reconcile("Not authorized: mismatched canonical identity link");
  return { schoolId, userId: user._id, role: user.role, isPlatformAdmin: false };
}

export const getActiveMembership = query({
  args: { schoolId: v.id("schools") },
  handler: (ctx, args) => resolveActiveMembership(ctx, args.schoolId),
});
