import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../../_generated/server";
import { resolvePortalMemberships, getPortalRole } from "./portalIdentity";
import { resolveStoredUserNameFields } from "./studentNameCompat";
import { contactAddressPatch } from "./familyContactAddress";
import { normalizeOptionalPhone } from "./familyContactPhone";
import { requiresCorrectionNamePair, hasUsableCorrectionNameScope } from "@school/shared/profile-corrections";
import type { CorrectionScope, CorrectionPayload, CorrectionChange } from "./profileCorrectionContract";

type Context = QueryCtx | MutationCtx;
export function correctionError(message: string): never { throw new ConvexError(message); }
export function validateScope(scope: CorrectionScope) {
  if (!scope.parentFields.length && !scope.childFields.length) correctionError("Select at least one field");
  if (new Set(scope.parentFields).size !== scope.parentFields.length || new Set(scope.childFields).size !== scope.childFields.length)
    correctionError("Duplicate fields are not allowed");
  if (scope.parentFields.includes("address") !== Boolean(scope.parentMemberId) || Boolean(scope.childFields.length) !== Boolean(scope.childId))
    correctionError("Select the exact address member and child targets");
  return { ...scope, parentFields: [...scope.parentFields].sort(), childFields: [...scope.childFields].sort() };
}
export async function parentInSchool(ctx: Context, schoolId: Id<"schools">) {
  const auth = await resolvePortalMemberships(ctx);
  const matches = auth.memberships.filter(m => m.user.schoolId === schoolId && m.role === "parent");
  if (matches.length !== 1) correctionError("FORBIDDEN: An active parent membership in this school is required");
  await parentProjection(ctx, matches[0].user);
  return matches[0];
}
export async function parentProjection(ctx: Context, user: Doc<"users">) {
  const school = await ctx.db.get(user.schoolId);
  if (user.isArchived || !school || school.status !== "active" || await getPortalRole(ctx, user) !== "parent")
    correctionError("FORBIDDEN: Current parent membership is required");
  const people = user.authTokenIdentifier ? await ctx.db.query("persons").withIndex("by_token_identifier", q => q.eq("authTokenIdentifier", user.authTokenIdentifier)).take(2) : [];
  if (people.length > 1 || (people[0] && people[0]._id !== user.personId)) correctionError("FORBIDDEN: Parent identity requires reconciliation");
  if (!user.personId) {
    const rows = user.authTokenIdentifier ? (await Promise.all([undefined, false].map(isArchived => ctx.db.query("users")
      .withIndex("by_auth_token_identifier_and_archived", q => q.eq("authTokenIdentifier", user.authTokenIdentifier).eq("isArchived", isArchived)).take(2)))).flat() : [];
    if (user.authTokenIdentifier && (rows.length !== 1 || rows[0]._id !== user._id)) correctionError("FORBIDDEN: Parent legacy identity is ambiguous");
    return { personId: undefined, membershipId: undefined };
  }
  const personId = user.personId;
  const person = await ctx.db.get(personId);
  const memberships = await ctx.db.query("branchMemberships").withIndex("by_person_and_school", q =>
    q.eq("personId", personId).eq("schoolId", user.schoolId)).take(2);
  if (!person || person.status !== "active" || person.identityReconciliationState === "reconciliation_required" ||
      !user.authTokenIdentifier || person.authTokenIdentifier !== user.authTokenIdentifier || memberships.length !== 1 ||
      memberships[0].status !== "active" || memberships[0].legacyUserId !== user._id)
    correctionError("FORBIDDEN: Parent identity requires reconciliation");
  return { personId: person._id, membershipId: memberships[0]._id };
}
export async function correctionTargets(ctx: Context, parent: Doc<"users">, scope: CorrectionScope) {
  validateScope(scope);
  const identity = await parentProjection(ctx, parent);
  const member = scope.parentMemberId ? await ctx.db.get(scope.parentMemberId) : null;
  const parentFamily = member ? await ctx.db.get(member.familyId) : null;
  if (scope.parentMemberId && (!member || member.parentUserId !== parent._id || member.schoolId !== parent.schoolId || parentFamily?.schoolId !== parent.schoolId))
    correctionError("FORBIDDEN: Personal address link changed");
  const child = scope.childId ? await ctx.db.get(scope.childId) : null;
  const childUser = child ? await ctx.db.get(child.userId) : null;
  const childFamily = child?.familyId ? await ctx.db.get(child.familyId) : null;
  const links = childFamily ? await ctx.db.query("familyMembers").withIndex("by_family_and_parent", q =>
    q.eq("familyId", childFamily._id).eq("parentUserId", parent._id)).take(2) : [];
  if (scope.childId && (!child || child.schoolId !== parent.schoolId || child.isArchived ||
      (child.enrollmentStatus !== undefined && child.enrollmentStatus !== "active") || !childUser || childUser.isArchived ||
      childUser.role !== "student" || childUser.schoolId !== parent.schoolId || childFamily?.schoolId !== parent.schoolId ||
      links.length !== 1 || links[0].schoolId !== parent.schoolId)) correctionError("FORBIDDEN: Current linked child is required");
  if (childUser?.personId) {
    const person = await ctx.db.get(childUser.personId);
    if (!person || person.status !== "active" || person.identityReconciliationState === "reconciliation_required" ||
        (person.authTokenIdentifier && person.authTokenIdentifier !== childUser.authTokenIdentifier))
      correctionError("FORBIDDEN: Child identity requires reconciliation");
  }
  return { parent, identity, member, parentFamily, child, childUser, childFamily, childLink: links[0] ?? null };
}
export type CorrectionTargets = Awaited<ReturnType<typeof correctionTargets>>;
export function validateCorrectionNameScope(t: CorrectionTargets, scope: CorrectionScope) {
  if (!hasUsableCorrectionNameScope(scope.parentFields, requiresCorrectionNamePair(t.parent)) ||
      (t.childUser && !hasUsableCorrectionNameScope(scope.childFields, requiresCorrectionNamePair(t.childUser))))
    correctionError("Incomplete names require permission for both first and last names");
}
const nameKeys = ["firstName", "middleName", "lastName"] as const;
function nameSnapshot(user: Doc<"users">) {
  return { name: user.name, firstName: user.firstName ?? null, middleName: user.middleName ?? null, lastName: user.lastName ?? null };
}
export function targetBaseline(t: CorrectionTargets, scope: CorrectionScope) {
  // Values and source IDs, not wall-clock timestamps, decide stale safety.
  return JSON.stringify({ parentId: t.parent._id, personId: t.parent.personId ?? null,
    token: t.parent.authTokenIdentifier ?? null, authId: t.parent.authId, membershipId: t.identity.membershipId ?? null,
    parentNames: scope.parentFields.some(f => nameKeys.some(k => k === f)) ? nameSnapshot(t.parent) : null,
    phone: scope.parentFields.includes("phone") ? t.parent.phone ?? null : null,
    member: t.member ? { id: t.member._id, familyId: t.member.familyId, mode: t.member.addressMode ?? null,
      value: t.member.addressOverride ?? null, residential: t.parentFamily?.residentialAddress ?? null } : null,
    child: t.child && t.childUser ? { id: t.child._id, userId: t.child.userId, personId: t.childUser.personId ?? null,
      authId: t.childUser.authId, token: t.childUser.authTokenIdentifier ?? null, familyId: t.child.familyId,
      linkId: t.childLink?._id, names: scope.childFields.some(f => nameKeys.some(k => k === f)) ? nameSnapshot(t.childUser) : null,
      dateOfBirth: scope.childFields.includes("dateOfBirth") ? t.child.dateOfBirth ?? null : null,
      gender: scope.childFields.includes("gender") ? t.child.gender ?? null : null,
      address: scope.childFields.includes("address") ? { mode: t.child.addressMode ?? null, value: t.child.address ?? null,
        residential: t.childFamily?.residentialAddress ?? null } : null } : null });
}
function text(value: string | null, max: number) {
  if (value !== null && value.length > max) correctionError("A draft value is too long");
  return value?.trim() || undefined;
}
// Mutations supply the current time for admission's future-DOB policy. Review queries do not read the wall clock.
export function normalizedCorrection(t: CorrectionTargets, scope: CorrectionScope, payload: CorrectionPayload, now?: number) {
  const changes: CorrectionChange[] = [];
  const parentPatch: Partial<Pick<Doc<"users">, "name" | "firstName" | "middleName" | "lastName" | "phone">> = {};
  const childUserPatch: Partial<Pick<Doc<"users">, "name" | "firstName" | "middleName" | "lastName">> = {};
  const childPatch: Partial<Pick<Doc<"students">, "dateOfBirth" | "gender" | "addressMode" | "address">> = {};
  const memberPatch: Partial<Pick<Doc<"familyMembers">, "addressMode" | "addressOverride">> = {};
  function change(target: CorrectionChange["target"], targetId: string, field: CorrectionChange["field"], before: CorrectionChange["before"] | undefined, after: CorrectionChange["after"] | undefined) {
    if ((before ?? null) !== (after ?? null)) changes.push({ target, targetId, field, before: before ?? null, after: after ?? null });
  }
  function names(user: Doc<"users">, input: NonNullable<CorrectionPayload["parent"]>, fields: readonly string[], patch: Partial<Pick<Doc<"users">, "name" | "firstName" | "middleName" | "lastName">>, target: "parent" | "child") {
    for (const key of nameKeys) if (input[key] !== undefined) {
      if (!fields.includes(key)) correctionError(`Field not granted: ${key}`);
      text(input[key] ?? null, 100);
    }
    if (!nameKeys.some(k => input[k] !== undefined)) return;
    const next = resolveStoredUserNameFields({ ...input, fallbackName: user.name, fallbackFirstName: user.firstName,
      fallbackMiddleName: user.middleName, fallbackLastName: user.lastName });
    for (const key of nameKeys) if ((next[key] ?? null) !== (user[key] ?? null)) {
      if (!fields.includes(key)) correctionError(`Normalized change requires permission for ${key}`);
      patch[key] = next[key]; change(target, user._id, key, user[key], next[key]);
    }
    if (next.name !== user.name) { patch.name = next.name; change(target, user._id, "name", user.name, next.name); }
  }
  if (payload.parent) {
    names(t.parent, payload.parent, scope.parentFields, parentPatch, "parent");
    if (payload.parent.phone !== undefined) {
      if (!scope.parentFields.includes("phone")) correctionError("Field not granted: phone");
      text(payload.parent.phone, 40);
      const next = normalizeOptionalPhone(payload.parent.phone);
      if ((next ?? null) !== (t.parent.phone ?? null)) parentPatch.phone = next;
      change("parent", t.parent._id, "phone", t.parent.phone, next);
    }
  }
  function address(input: NonNullable<CorrectionPayload["parentAddress"]>, residential: string | undefined) {
    if (input.mode === "residential") {
      if (input.value !== undefined) correctionError("Residential inheritance cannot change the household address");
    }
    if (input.value !== undefined) text(input.value, 500);
    const patch = contactAddressPatch({ addressMode: input.mode, addressOverride: input.value });
    return { mode: input.mode, value: patch.addressOverride, effective: input.mode === "residential" ? residential : patch.addressOverride };
  }
  if (payload.parentAddress) {
    if (!scope.parentFields.includes("address") || !t.member) correctionError("Personal address not granted");
    const next = address(payload.parentAddress, t.parentFamily?.residentialAddress);
    if (t.member.addressMode !== next.mode || t.member.addressOverride !== next.value) {
      memberPatch.addressMode = next.mode; memberPatch.addressOverride = next.value;
      // Include inheritance choice even when both effective addresses happen to match.
      change("parentAddress", t.member._id, "address", JSON.stringify({ mode: t.member.addressMode ?? "legacy", value: t.member.addressOverride ?? null, effective: t.member.addressMode === "residential" ? t.parentFamily?.residentialAddress ?? null : t.member.addressOverride ?? null }), JSON.stringify({ mode: next.mode, value: next.value ?? null, effective: next.effective ?? null }));
    }
  }
  if (payload.child) {
    if (!t.child || !t.childUser) correctionError("Child target not granted");
    names(t.childUser, payload.child, scope.childFields, childUserPatch, "child");
    for (const field of ["dateOfBirth", "gender"] as const) if (payload.child[field] !== undefined) {
      if (!scope.childFields.includes(field)) correctionError(`Field not granted: ${field}`);
      const next = payload.child[field] ?? undefined;
      if (field === "dateOfBirth") {
        const date = payload.child.dateOfBirth;
        if (date !== null && date !== undefined && (!Number.isInteger(date) || date < -2208988800000 || date > Date.UTC(2100, 0, 1) || (now !== undefined && date >= now))) correctionError("Invalid date of birth");
        if (t.child.dateOfBirth !== next) childPatch.dateOfBirth = date ?? undefined;
      } else if (t.child.gender !== next) childPatch.gender = payload.child.gender ?? undefined;
      change("child", t.child._id, field, t.child[field], next);
    }
    if (payload.child.address) {
      if (!scope.childFields.includes("address")) correctionError("Child address not granted");
      const next = address(payload.child.address, t.childFamily?.residentialAddress);
      if (t.child.addressMode !== next.mode || t.child.address !== next.value) {
        childPatch.addressMode = next.mode; childPatch.address = next.value;
        change("child", t.child._id, "address", JSON.stringify({ mode: t.child.addressMode ?? "legacy", value: t.child.address ?? null, effective: t.child.addressMode === "residential" ? t.childFamily?.residentialAddress ?? null : t.child.address ?? null }), JSON.stringify({ mode: next.mode, value: next.value ?? null, effective: next.effective ?? null }));
      }
    }
  }
  return { changes, parentPatch, childUserPatch, childPatch, memberPatch };
}
export async function applyCorrection(ctx: MutationCtx, t: CorrectionTargets, prepared: ReturnType<typeof normalizedCorrection>) {
  const now = Date.now();
  if (Object.keys(prepared.parentPatch).length) await ctx.db.patch(t.parent._id, { ...prepared.parentPatch, updatedAt: now });
  if (t.childUser && Object.keys(prepared.childUserPatch).length) await ctx.db.patch(t.childUser._id, { ...prepared.childUserPatch, updatedAt: now });
  if (t.child && Object.keys(prepared.childPatch).length) await ctx.db.patch(t.child._id, { ...prepared.childPatch, updatedAt: now });
  if (t.member && Object.keys(prepared.memberPatch).length) await ctx.db.patch(t.member._id, { ...prepared.memberPatch, updatedAt: now, updatedBy: t.parent._id });
}
