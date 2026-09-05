import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { recordAuditEventHelper } from "./audit";
import { requireCapability, getContextCapabilities } from "./rbac";
import { resolveActiveMembership } from "./auth";

// H5 / D01 / D03: Melo operates no mail server. Public writes are metadata only.
type Context = QueryCtx | MutationCtx;
const templateValidator = v.union(v.literal("firstname.lastname"), v.literal("f.lastname"));
const providerValidator = v.union(v.literal("google"), v.literal("microsoft"), v.literal("zoho"), v.literal("none"));
const reservedNames = new Set(["admin", "administrator", "postmaster", "abuse", "support", "security", "root", "noreply", "no-reply", "webmaster", "mailer-daemon", "hostmaster"]);
export function validLocalPart(value: string): boolean {
  return value.length <= 64 && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value) && !reservedNames.has(value);
}
function validDomain(value: string): boolean {
  return value.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
}
async function emailAccess(ctx: Context, schoolId: Id<"schools">) {
  const auth = await resolveActiveMembership(ctx, schoolId);
  const caps = await getContextCapabilities(ctx, auth);
  const permissions = {
    policy: caps.includes("settings.domains.manage"),
    staff: caps.includes("staff.onboard"),
    student: caps.includes("enrollment.intakes.manage"),
    lifecycle: caps.includes("staff.account.suspend"),
  };
  if (!permissions.policy && !permissions.staff && !permissions.student)
    throw new ConvexError("Forbidden: institutional email review authority required");
  return { auth, permissions };
}
async function targetKind(ctx: Context, personId: Id<"persons">, schoolId: Id<"schools">) {
  const membership = await ctx.db.query("branchMemberships")
    .withIndex("by_person_and_school", q => q.eq("personId", personId).eq("schoolId", schoolId)).unique();
  const user = membership?.legacyUserId ? await ctx.db.get(membership.legacyUserId) : null;
  // Display titles and client-selected recipient types are not authority evidence.
  if (!user || user.schoolId !== schoolId || (user.personId && user.personId !== personId)) return "unclassified" as const;
  return user.role === "student" ? "student" as const : user.role === "admin" || user.role === "teacher" ? "staff" as const : "unclassified" as const;
}
async function requireTargetAuthority(ctx: Context, schoolId: Id<"schools">, personId: Id<"persons">) {
  const access = await emailAccess(ctx, schoolId);
  const kind = await targetKind(ctx, personId, schoolId);
  if ((kind !== "staff" && !access.permissions.student) || (kind !== "student" && !access.permissions.staff))
    throw new ConvexError("Forbidden: scoped student/staff approval authority required; reconcile unclassified membership");
  return { ...access, kind };
}
async function assertActiveTarget(ctx: Context, schoolId: Id<"schools">, personId: Id<"persons">) {
  const membership = await ctx.db.query("branchMemberships")
    .withIndex("by_person_and_school", q => q.eq("personId", personId).eq("schoolId", schoolId)).unique();
  const person = await ctx.db.get(personId);
  if (!membership || membership.status !== "active" || !person || person.status !== "active" || person.identityReconciliationState === "reconciliation_required")
    throw new ConvexError("Person does not have an active membership in this school");
}
async function resolveDomain(ctx: Context, schoolId: Id<"schools">, domainId: Id<"schoolEmailDomains">) {
  const domain = await ctx.db.get(domainId);
  if (!domain) throw new ConvexError("Domain not found");
  if (domain.schoolId !== schoolId) {
    const source = await ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", domain.schoolId)).unique();
    const destination = await ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", schoolId)).unique();
    const group = source ? await ctx.db.get(source.groupId) : null;
    if (!source || !destination || domain.sharedGroupId !== source.groupId || source.groupId !== destination.groupId || group?.status !== "active")
      throw new ConvexError("Email domain does not belong to this school or active group");
  }
  return domain;
}
async function policyFor(ctx: Context, schoolId: Id<"schools">) {
  return await ctx.db.query("emailAddressPolicies").withIndex("by_school", q => q.eq("schoolId", schoolId)).unique();
}
async function selectedDomain(ctx: Context, schoolId: Id<"schools">, domainId?: Id<"schoolEmailDomains">) {
  const policy = await policyFor(ctx, schoolId);
  if (domainId && policy?.domainId && domainId !== policy.domainId)
    throw new ConvexError("Selected domain differs from the configured address policy");
  const id = domainId ?? policy?.domainId;
  const domain = id ? await resolveDomain(ctx, schoolId, id) : await ctx.db.query("schoolEmailDomains")
    .withIndex("by_school_and_default", q => q.eq("schoolId", schoolId).eq("isDefault", true)).first();
  if (!domain) throw new ConvexError("Register or inherit a domain before proposing addresses");
  return { domain, policy };
}
async function auditUser(ctx: MutationCtx, schoolId: Id<"schools">, action: string, targetType: string, targetId: string,
  safeSummary = "Reviewed institutional addressing metadata; no identity or external provider changes.") {
  const auth = await resolveActiveMembership(ctx, schoolId);
  const person = auth.personId ? await ctx.db.get(auth.personId) : null;
  const user = auth.userId ? await ctx.db.get(auth.userId) : null;
  const identity = await ctx.auth.getUserIdentity();
  const platform = auth.isPlatformAdmin && identity ? await ctx.db.query("platformAdmins")
    .withIndex("by_auth_token_identifier", q => q.eq("authTokenIdentifier", identity.tokenIdentifier)).first() : null;
  await recordAuditEventHelper(ctx, {
    schoolId, actorKind: auth.isPlatformAdmin ? "platform_admin" : "user",
    actorPersonId: auth.personId, actorMembershipId: auth.membershipId,
    actorEmailSnapshot: person?.email ?? user?.email ?? platform?.email ?? identity?.email ?? "authenticated platform recovery operator", module: "institutional_email",
    action, targetType, targetId, outcome: "success",
    safeSummary,
  });
}

export const registerEmailDomain = mutation({
  args: { schoolId: v.id("schools"), domain: v.string(), provider: providerValidator, isDefault: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "settings.domains.manage");
    const domain = args.domain.toLowerCase().trim();
    if (!validDomain(domain)) throw new ConvexError("Invalid domain name");
    const existing = await ctx.db.query("schoolEmailDomains")
      .withIndex("by_school_and_domain", q => q.eq("schoolId", args.schoolId).eq("domain", domain)).unique();
    if (existing) return { domainId: existing._id, domain, dnsTxtRecord: existing.dnsTxtRecord, status: existing.status };
    const namespaceOwner = await ctx.db.query("schoolEmailDomains").withIndex("by_domain", q => q.eq("domain", domain)).first();
    if (namespaceOwner) throw new ConvexError("Domain already registered; inherit an explicitly shared group domain or request ownership reconciliation");
    const previous = await ctx.db.query("schoolEmailDomains")
      .withIndex("by_school_and_default", q => q.eq("schoolId", args.schoolId).eq("isDefault", true)).first();
    const isDefault = args.isDefault ?? !previous;
    const now = Date.now();
    if (isDefault && previous) await ctx.db.patch(previous._id, { isDefault: false, updatedAt: now });
    const dnsTxtRecord = `melo-verify=${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    const domainId = await ctx.db.insert("schoolEmailDomains", {
      schoolId: args.schoolId, domain, provider: args.provider, isDefault, dnsTxtRecord,
      status: "pending_verification", createdAt: now, updatedAt: now,
    });
    await auditUser(ctx, args.schoolId, "register_domain", "schoolEmailDomains", String(domainId));
    return { domainId, domain, dnsTxtRecord, status: "pending_verification" as const };
  },
});

export const setEmailDomainSharing = mutation({
  args: { domainId: v.id("schoolEmailDomains"), sharedWithGroup: v.boolean(), confirmed: v.boolean() },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) throw new ConvexError("Domain not found");
    await requireCapability(ctx, domain.schoolId, "settings.domains.manage");
    if (!args.confirmed) throw new ConvexError("Confirm group domain sharing policy");
    const link = await ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", domain.schoolId)).unique();
    const group = link ? await ctx.db.get(link.groupId) : null;
    if (args.sharedWithGroup && group?.status !== "active") throw new ConvexError("Active group required for sharing");
    await ctx.db.patch(domain._id, { sharedGroupId: args.sharedWithGroup ? link?.groupId : undefined, updatedAt: Date.now() });
    await auditUser(ctx, domain.schoolId, args.sharedWithGroup ? "share_domain_with_group" : "stop_domain_sharing", "schoolEmailDomains", String(domain._id));
  },
});

export const saveEmailPolicy = mutation({
  args: { schoolId: v.id("schools"), domainId: v.id("schoolEmailDomains"), staffTemplate: templateValidator,
    studentTemplate: templateValidator, expectedVersion: v.number(), confirmed: v.boolean() },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "settings.domains.manage");
    if (!args.confirmed) throw new ConvexError("Confirm privacy and future-address policy review");
    await resolveDomain(ctx, args.schoolId, args.domainId);
    const current = await policyFor(ctx, args.schoolId);
    if ((current?.version ?? 0) !== args.expectedVersion) throw new ConvexError("Policy changed; reload and review");
    const value = { schoolId: args.schoolId, domainId: args.domainId, staffTemplate: args.staffTemplate,
      studentTemplate: args.studentTemplate, version: args.expectedVersion + 1, updatedAt: Date.now() };
    const id = current ? current._id : await ctx.db.insert("emailAddressPolicies", value);
    if (current) await ctx.db.patch(current._id, value);
    await auditUser(ctx, args.schoolId, "save_address_policy", "emailAddressPolicies", String(id),
      `Policy version ${value.version}; domain reference ${args.domainId}; staff ${args.staffTemplate}; student ${args.studentTemplate}. Prospective addressing only.`);
    return value.version;
  },
});

export function computeAddressCandidate(firstName: string, lastName: string, middleName: string | undefined,
  stage: 1 | 2 | 3 | 4, isMinorPrivacy: boolean): string {
  const clean = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const first = clean(firstName) || "user";
  const last = clean(lastName) || "person";
  const middle = clean(middleName ?? "");
  const base = `${isMinorPrivacy ? first[0] : first}.${last}`;
  if (stage === 2 && middle) return `${isMinorPrivacy ? first[0] : first}.${middle[0]}.${last}`;
  return stage === 2 || stage === 3 ? `${base}2` : base;
}
export interface ProposedPersonInput {
  personId: Id<"persons">; firstName: string; lastName: string; middleName?: string;
  admissionYear?: number; isMinor?: boolean; minorPrivacyRequested?: boolean;
}
export interface AddressProposalResult {
  personId: Id<"persons">; proposedEmail: string; localPart: string; domain: string;
  stage: 1 | 2 | 3 | 4; collisionDetected: boolean; needsManualReview: boolean;
  state: "login_only"; isMinor: boolean; minorPrivacyApplied: boolean;
  alternatives: string[]; reason: string; policyVersion: number; retainedExistingAddress: boolean;
}
export const proposeEmailAddresses = query({
  args: { schoolId: v.id("schools"), domainId: v.optional(v.id("schoolEmailDomains")),
    customDomain: v.optional(v.string()), persons: v.array(v.object({ personId: v.id("persons"),
      firstName: v.string(), lastName: v.string(), middleName: v.optional(v.string()), admissionYear: v.optional(v.number()),
      isMinor: v.optional(v.boolean()), minorPrivacyRequested: v.optional(v.boolean()) })) },
  handler: async (ctx, args): Promise<AddressProposalResult[]> => {
    await emailAccess(ctx, args.schoolId);
    if (args.persons.length > 100) throw new ConvexError("Review at most 100 people at a time");
    const { domain, policy } = await selectedDomain(ctx, args.schoolId, args.domainId);
    if (args.customDomain && args.customDomain.trim().toLowerCase() !== domain.domain)
      throw new ConvexError("Custom domain must match the registered address policy");
    const reserved = new Set<string>();
    const results: AddressProposalResult[] = [];
    for (const person of args.persons) {
      const { kind } = await requireTargetAuthority(ctx, args.schoolId, person.personId);
      await assertActiveTarget(ctx, args.schoolId, person.personId);
      const template = kind === "student" ? policy?.studentTemplate : policy?.staffTemplate;
      const privacy = Boolean(person.isMinor && person.minorPrivacyRequested) || template === "f.lastname";
      const alternatives = [...new Set(([1, 2, 3] as const).map(stage => computeAddressCandidate(person.firstName, person.lastName, person.middleName, stage, privacy)))];
      let stage: 1 | 2 | 3 | 4 = 4;
      let localPart = alternatives[0];
      let retainedExistingAddress = false;
      for (const candidateStage of [1, 2, 3] as const) {
        if (candidateStage === 2 && !person.middleName) continue;
        const candidate = computeAddressCandidate(person.firstName, person.lastName, person.middleName, candidateStage, privacy);
        const email = `${candidate}@${domain.domain}`;
        if (!validLocalPart(candidate) || email.length > 254 || reserved.has(email)) continue;
        const existing = await ctx.db.query("institutionalMailboxes").withIndex("by_email", q => q.eq("email", email)).first();
        if (existing && existing.personId !== person.personId) continue;
        retainedExistingAddress = Boolean(existing);
        localPart = candidate; stage = candidateStage; break;
      }
      const proposedEmail = `${localPart}@${domain.domain}`;
      reserved.add(proposedEmail);
      results.push({ personId: person.personId, proposedEmail, localPart, domain: domain.domain, stage,
        collisionDetected: stage !== 1, needsManualReview: stage === 4, state: "login_only", isMinor: Boolean(person.isMinor),
        minorPrivacyApplied: privacy, alternatives: alternatives.map(local => `${local}@${domain.domain}`),
        reason: retainedExistingAddress ? "Existing person address retained; no new approval or lifecycle change. Source ownership remains unchanged." : stage === 4 ? "Candidates unavailable or invalid; manually review local part" : stage === 1 ? "Base policy candidate available" : "Collision: deterministic alternative proposed",
        retainedExistingAddress, policyVersion: policy?.version ?? 0 });
    }
    return results;
  },
});

export const reviewEmailAddress = query({
  args: { schoolId: v.id("schools"), personId: v.id("persons"), localPart: v.string(), expectedPolicyVersion: v.number() },
  handler: async (ctx, args) => {
    await requireTargetAuthority(ctx, args.schoolId, args.personId);
    await assertActiveTarget(ctx, args.schoolId, args.personId);
    const { domain, policy } = await selectedDomain(ctx, args.schoolId);
    const localPart = args.localPart.toLowerCase().trim();
    const email = `${localPart}@${domain.domain}`;
    if ((policy?.version ?? 0) !== args.expectedPolicyVersion) return { valid: false, email, reason: "Policy changed; repeat dry run" };
    if (!validLocalPart(localPart) || email.length > 254) return { valid: false, email, reason: "Invalid syntax or reserved local part" };
    const existing = await ctx.db.query("institutionalMailboxes").withIndex("by_email", q => q.eq("email", email)).first();
    return { valid: !existing, email, reason: existing ? "Address already allocated and permanently reserved (including archived addresses)" : "Available in shared namespace; approval rechecks transactionally. Provider-specific validation remains gated." };
  },
});

export const assignInstitutionalMailbox = mutation({
  args: { schoolId: v.id("schools"), personId: v.id("persons"), email: v.string(),
    isMinor: v.optional(v.boolean()), minorPrivacyRequested: v.optional(v.boolean()), expectedPolicyVersion: v.optional(v.number()),
    aliasOfMailboxId: v.optional(v.id("institutionalMailboxes")) },
  handler: async (ctx, args) => {
    await requireTargetAuthority(ctx, args.schoolId, args.personId);
    await assertActiveTarget(ctx, args.schoolId, args.personId);
    const email = args.email.toLowerCase().trim();
    const [local, domainName, extra] = email.split("@");
    if (!local || !domainName || extra !== undefined || !validLocalPart(local) || !validDomain(domainName) || email.length > 254)
      throw new ConvexError("Invalid address syntax or reserved local part");
    const policy = await policyFor(ctx, args.schoolId);
    if ((policy || args.expectedPolicyVersion !== undefined) && args.expectedPolicyVersion !== (policy?.version ?? 0))
      throw new ConvexError("Policy changed; repeat dry run and review");
    const domain = policy?.domainId ? await resolveDomain(ctx, args.schoolId, policy.domainId) : await ctx.db.query("schoolEmailDomains")
      .withIndex("by_school_and_domain", q => q.eq("schoolId", args.schoolId).eq("domain", domainName)).first();
    if (!domain || domain.domain !== domainName) throw new ConvexError("Address must use the configured school domain");
    if (args.aliasOfMailboxId) {
      const source = await ctx.db.get(args.aliasOfMailboxId);
      if (!source || source.personId !== args.personId || source.schoolId !== args.schoolId || source.email === email)
        throw new ConvexError("Additional address must reference this person's distinct branch-owned allocation");
    }
    // Global namespace includes suspended/archived allocations in every branch.
    const existing = await ctx.db.query("institutionalMailboxes").withIndex("by_email", q => q.eq("email", email)).first();
    if (existing && existing.personId !== args.personId) throw new ConvexError("Address already allocated and frozen for another person");
    if (existing && args.aliasOfMailboxId && existing.aliasOfMailboxId !== args.aliasOfMailboxId)
      throw new ConvexError("Existing address relation cannot be silently changed");
    // Idempotent retry never reactivates or changes source ownership/provider evidence.
    if (existing) return { success: true, mailboxId: existing._id, email, state: existing.state };
    const now = Date.now();
    const mailboxId = await ctx.db.insert("institutionalMailboxes", {
      personId: args.personId, schoolId: args.schoolId, email, address: email, state: "login_only", aliasOfMailboxId: args.aliasOfMailboxId, approvedPolicyVersion: policy?.version ?? 0,
      providerType: "none", status: "active", isMinor: args.isMinor, minorPrivacyRequested: args.minorPrivacyRequested,
      createdAt: now, updatedAt: now,
    });
    await auditUser(ctx, args.schoolId, args.aliasOfMailboxId ? "approve_additional_address" : "approve_address", "institutionalMailboxes", String(mailboxId));
    return { success: true, mailboxId, email, state: "login_only" as const };
  },
});

// Evidence transitions are internal only. No public verifier or provider action is installed.
export const verifyDomain = internalMutation({
  args: { domainId: v.id("schoolEmailDomains"), observedDnsTxtRecord: v.string(), providerOperationId: v.string() },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) throw new ConvexError("Domain not found");
    const verified = args.observedDnsTxtRecord === domain.dnsTxtRecord;
    const status = verified ? "verified" as const : "failed" as const;
    await ctx.db.patch(domain._id, { status, verifiedAt: verified ? Date.now() : undefined, updatedAt: Date.now() });
    await recordAuditEventHelper(ctx, { schoolId: domain.schoolId, actorKind: "system", actorEmailSnapshot: "trusted verifier",
      module: "institutional_email", action: "verify_domain", targetType: "schoolEmailDomains", targetId: String(domain._id),
      outcome: verified ? "success" : "failed", safeSummary: `Domain control evidence ${status}; provider activation remains gated.` });
    return { domainId: domain._id, domain: domain.domain, status, verified };
  },
});
export const applyProviderMailboxResult = internalMutation({
  args: { mailboxId: v.id("institutionalMailboxes"), providerType: providerValidator,
    providerAccountId: v.optional(v.string()), providerOperationId: v.string() },
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    if (!mailbox) throw new ConvexError("Mailbox not found");
    if (mailbox.status !== "active") throw new ConvexError("Inactive mailbox requires lifecycle reconciliation");
    const policy = await policyFor(ctx, mailbox.schoolId);
    const domain = policy?.domainId ? await resolveDomain(ctx, mailbox.schoolId, policy.domainId) : await ctx.db.query("schoolEmailDomains")
      .withIndex("by_school_and_domain", q => q.eq("schoolId", mailbox.schoolId).eq("domain", mailbox.email.split("@")[1])).first();
    if (!domain || domain.domain !== mailbox.email.split("@")[1] || domain.status !== "verified" || domain.provider !== args.providerType)
      throw new ConvexError("Provider operation does not match a verified school domain");
    if (args.providerType !== "none" && !args.providerAccountId) throw new ConvexError("Provider account identifier is required for provisioning");
    if (mailbox.providerAccountId && mailbox.providerAccountId !== args.providerAccountId)
      throw new ConvexError("Provider identifier conflict; reconciliation required");
    const state = args.providerType === "none" ? "external_verified" as const : "provider_provisioned" as const;
    if (mailbox.lastProviderOperationId === args.providerOperationId) {
      if (mailbox.state !== state || mailbox.providerType !== args.providerType) throw new ConvexError("Conflicting replay; reconciliation required");
      return { mailboxId: mailbox._id, state, providerOperationId: args.providerOperationId };
    }
    await ctx.db.patch(mailbox._id, { state, providerType: args.providerType, providerAccountId: args.providerAccountId,
      lastProviderOperationId: args.providerOperationId, lastSyncError: undefined, updatedAt: Date.now() });
    await recordAuditEventHelper(ctx, { schoolId: mailbox.schoolId, actorKind: "system", actorEmailSnapshot: "trusted provider integration",
      module: "institutional_email", action: "apply_provider_mailbox_result", targetType: "institutionalMailboxes", targetId: String(mailbox._id),
      outcome: "success", safeSummary: "Recorded trusted mailbox evidence; identity and membership unchanged." });
    return { mailboxId: mailbox._id, state, providerOperationId: args.providerOperationId };
  },
});
export const recordProviderFailure = internalMutation({
  args: { mailboxId: v.id("institutionalMailboxes"), failure: v.union(v.literal("transient"), v.literal("permanent"), v.literal("unknown")) },
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    if (!mailbox) throw new ConvexError("Mailbox not found");
    await ctx.db.patch(mailbox._id, { lastSyncError: args.failure, updatedAt: Date.now() });
    await recordAuditEventHelper(ctx, { schoolId: mailbox.schoolId, actorKind: "system", actorEmailSnapshot: "trusted provider integration",
      module: "institutional_email", action: "provider_reconciliation_required", targetType: "institutionalMailboxes", targetId: String(mailbox._id),
      outcome: "failed", safeSummary: `Provider outcome ${args.failure}; reconcile before any retry. Identity preserved.` });
  },
});
export const suspendOrArchiveMailbox = mutation({
  args: { mailboxId: v.id("institutionalMailboxes"), action: v.union(v.literal("suspend"), v.literal("archive")), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    if (!mailbox) throw new ConvexError("Mailbox not found");
    const access = await requireTargetAuthority(ctx, mailbox.schoolId, mailbox.personId);
    if (access.kind !== "student" && !access.permissions.lifecycle) throw new ConvexError("Forbidden: lifecycle authority required");
    if (mailbox.status === "archived" && args.action === "suspend") throw new ConvexError("Archived address cannot be reactivated");
    const status = args.action === "suspend" ? "suspended" as const : "archived" as const;
    if (mailbox.status === status) return { success: true, mailboxId: mailbox._id, email: mailbox.email, status };
    const now = Date.now();
    await ctx.db.patch(mailbox._id, { status, suspendedAt: args.action === "suspend" ? now : mailbox.suspendedAt,
      archivedAt: args.action === "archive" ? now : mailbox.archivedAt, updatedAt: now });
    await auditUser(ctx, mailbox.schoolId, `mailbox_${args.action}`, "institutionalMailboxes", String(mailbox._id));
    return { success: true, mailboxId: mailbox._id, email: mailbox.email, status };
  },
});
async function visibleMailboxes(ctx: Context, schoolId: Id<"schools">) {
  const { permissions } = await emailAccess(ctx, schoolId);
  const mailboxes = await ctx.db.query("institutionalMailboxes").withIndex("by_school_and_email", q => q.eq("schoolId", schoolId)).take(100);
  const visible = [];
  for (const mailbox of mailboxes) {
    const kind = await targetKind(ctx, mailbox.personId, schoolId);
    if ((kind === "staff" && permissions.staff) || (kind === "student" && permissions.student) || (permissions.staff && permissions.student)) {
      const { providerAccountId: _providerAccountId, lastProviderOperationId: _operationId, lastSyncError, ...safe } = mailbox;
      visible.push({ ...safe, kind, reconciliationRequired: Boolean(lastSyncError),
        failureClass: !lastSyncError ? null : lastSyncError === "transient" ? "transient" as const : lastSyncError === "permanent" ? "permanent" as const : "unknown" as const });
    }
  }
  return visible;
}
export const getInstitutionalMailboxes = query({
  args: { schoolId: v.id("schools") }, handler: (ctx, args) => visibleMailboxes(ctx, args.schoolId),
});
export const getSchoolEmailDomains = query({
  args: { schoolId: v.id("schools") }, handler: async (ctx, args) => {
    const { permissions } = await emailAccess(ctx, args.schoolId);
    const domains = await ctx.db.query("schoolEmailDomains")
      .withIndex("by_school_and_domain", q => q.eq("schoolId", args.schoolId))
      .take(50);
    if (permissions.policy) return domains;
    return domains.map(({ _id, schoolId, domain, provider, status, isDefault, sharedGroupId, verifiedAt }) => ({
      _id,
      schoolId,
      domain,
      provider,
      status,
      isDefault,
      sharedWithGroup: Boolean(sharedGroupId),
      verifiedAt,
    }));
  },
});
export const getEmailWorkbench = query({
  args: { schoolId: v.id("schools") }, handler: async (ctx, args) => {
    const { permissions } = await emailAccess(ctx, args.schoolId);
    const policy = await policyFor(ctx, args.schoolId);
    const domains = await ctx.db.query("schoolEmailDomains").withIndex("by_school_and_domain", q => q.eq("schoolId", args.schoolId)).take(50);
    const link = await ctx.db.query("schoolGroupBranches").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).unique();
    const group = link ? await ctx.db.get(link.groupId) : null;
    if (link && group?.status === "active") {
      const branches = await ctx.db.query("schoolGroupBranches").withIndex("by_group", q => q.eq("groupId", link.groupId)).take(50);
      for (const branch of branches) if (branch.schoolId !== args.schoolId) {
        const branchDomains = await ctx.db.query("schoolEmailDomains")
          .withIndex("by_school_and_domain", q => q.eq("schoolId", branch.schoolId)).take(50);
        domains.push(...branchDomains.filter(domain => domain.sharedGroupId === group._id));
      }
    }
    const members = await ctx.db.query("branchMemberships").withIndex("by_school_and_status", q => q.eq("schoolId", args.schoolId).eq("status", "active")).take(100);
    const people = [];
    for (const member of members) {
      const kind = await targetKind(ctx, member.personId, args.schoolId);
      if (!((kind === "staff" && permissions.staff) || (kind === "student" && permissions.student) || (permissions.staff && permissions.student))) continue;
      const person = await ctx.db.get(member.personId);
      if (person?.status === "active") people.push({ personId: person._id, name: person.name, kind });
    }
    return { permissions, policy, people, domains: domains.map(({ _id, domain, schoolId, provider, status, isDefault, sharedGroupId }) => ({ _id, domain, schoolId, provider, status, isDefault, sharedWithGroup: Boolean(group && sharedGroupId === group._id) })),
      mailboxes: await visibleMailboxes(ctx, args.schoolId), groupName: group?.status === "active" ? group.name : null,
      policyDomainUnavailable: Boolean(policy?.domainId && !domains.some(domain => domain._id === policy.domainId)),
      providerActivation: "unavailable" as const, limit: 100 };
  },
});
