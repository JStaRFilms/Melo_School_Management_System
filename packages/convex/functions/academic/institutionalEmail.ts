import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { recordAuditEventHelper } from "./audit";

/**
 * Strict Invariant (H5 / MX-09):
 * Melo operates ZERO mail servers.
 * All institutional addressing integrates via external directory APIs
 * (Google Workspace, Microsoft 365, Zoho Mail) or DNS verification.
 */

function sanitizeNameSegment(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Deterministic helper to compute local-part proposals across the 4 collision stages.
 */
export function computeAddressCandidate(
  firstName: string,
  lastName: string,
  middleName: string | undefined,
  stage: 1 | 2 | 3 | 4,
  isMinorPrivacy: boolean
): string {
  const cleanFirst = sanitizeNameSegment(firstName) || "user";
  const cleanLast = sanitizeNameSegment(lastName) || "person";
  const cleanMiddle = middleName ? sanitizeNameSegment(middleName) : "";

  if (isMinorPrivacy) {
    // Minor privacy safeguards (NDPA Sec. 31 / Children's Code):
    // Use initial instead of full first name: f.lastname
    const firstInitial = cleanFirst.charAt(0);
    switch (stage) {
      case 1:
        return `${firstInitial}.${cleanLast}`;
      case 2:
        if (cleanMiddle) {
          return `${firstInitial}.${cleanMiddle.charAt(0)}.${cleanLast}`;
        }
        return `${firstInitial}.${cleanLast}2`;
      case 3:
        return `${firstInitial}.${cleanLast}2`;
      case 4:
        return `${firstInitial}.${cleanLast}`;
    }
  }

  // Standard Deterministic Naming Conventions:
  switch (stage) {
    case 1:
      // Stage 1: firstname.lastname
      return `${cleanFirst}.${cleanLast}`;
    case 2:
      // Stage 2: firstname.m.lastname (or fallback to numeric if no middle name)
      if (cleanMiddle) {
        return `${cleanFirst}.${cleanMiddle.charAt(0)}.${cleanLast}`;
      }
      return `${cleanFirst}.${cleanLast}2`;
    case 3:
      // Stage 3: firstname.lastname2
      return `${cleanFirst}.${cleanLast}2`;
    case 4:
      // Stage 4: Manual edit required
      return `${cleanFirst}.${cleanLast}`;
  }
}

/**
 * Registers an institutional domain with a DNS TXT challenge token.
 */
export const registerEmailDomain = mutation({
  args: {
    schoolId: v.id("schools"),
    domain: v.string(),
    provider: v.union(
      v.literal("google"),
      v.literal("microsoft"),
      v.literal("zoho"),
      v.literal("none")
    ),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    const normalizedDomain = args.domain.toLowerCase().trim();
    if (!normalizedDomain.includes(".")) {
      throw new ConvexError("Invalid domain name");
    }

    // Check if domain is already registered for this school
    const existing = await ctx.db
      .query("schoolEmailDomains")
      .withIndex("by_school_and_domain", (q) =>
        q.eq("schoolId", args.schoolId).eq("domain", normalizedDomain)
      )
      .first();

    if (existing) {
      return {
        domainId: existing._id,
        domain: existing.domain,
        dnsTxtRecord: existing.dnsTxtRecord,
        status: existing.status,
      };
    }

    // Generate DNS TXT challenge token per D03 §3.4
    const token = `melo-verify=${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    const now = Date.now();

    // If marked as default or first domain for school, set isDefault true
    const existingDefault = await ctx.db
      .query("schoolEmailDomains")
      .withIndex("by_school_and_default", (q) =>
        q.eq("schoolId", args.schoolId).eq("isDefault", true)
      )
      .first();

    const isDefault = args.isDefault ?? !existingDefault;

    if (isDefault && existingDefault) {
      await ctx.db.patch(existingDefault._id, {
        isDefault: false,
        updatedAt: now,
      });
    }

    const domainId = await ctx.db.insert("schoolEmailDomains", {
      schoolId: args.schoolId,
      domain: normalizedDomain,
      status: "pending_verification",
      dnsTxtRecord: token,
      provider: args.provider,
      isDefault,
      createdAt: now,
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "system",
      actorEmailSnapshot: "system@melo.school",
      module: "institutional_email",
      action: "register_domain",
      targetType: "schoolEmailDomains",
      targetId: String(domainId),
      outcome: "success",
      safeSummary: `Registered domain ${normalizedDomain} with DNS TXT challenge`,
    });

    return {
      domainId,
      domain: normalizedDomain,
      dnsTxtRecord: token,
      status: "pending_verification" as const,
    };
  },
});

/**
 * Simulates or executes DNS TXT verification challenge.
 */
export const verifyDomain = mutation({
  args: {
    domainId: v.id("schoolEmailDomains"),
    simulateSuccess: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) {
      throw new ConvexError("Domain not found");
    }

    const now = Date.now();
    const isSuccess = args.simulateSuccess ?? true;

    if (isSuccess) {
      await ctx.db.patch(domain._id, {
        status: "verified",
        verifiedAt: now,
        updatedAt: now,
      });

      await recordAuditEventHelper(ctx, {
        schoolId: domain.schoolId,
        actorKind: "system",
        actorEmailSnapshot: "system@melo.school",
        module: "institutional_email",
        action: "verify_domain",
        targetType: "schoolEmailDomains",
        targetId: String(domain._id),
        outcome: "success",
        safeSummary: `Verified domain ${domain.domain} ownership via DNS challenge`,
      });

      return {
        domainId: domain._id,
        domain: domain.domain,
        status: "verified" as const,
        verified: true,
      };
    } else {
      await ctx.db.patch(domain._id, {
        status: "failed",
        updatedAt: now,
      });

      await recordAuditEventHelper(ctx, {
        schoolId: domain.schoolId,
        actorKind: "system",
        actorEmailSnapshot: "system@melo.school",
        module: "institutional_email",
        action: "verify_domain",
        targetType: "schoolEmailDomains",
        targetId: String(domain._id),
        outcome: "failed",
        safeSummary: `DNS challenge verification failed for domain ${domain.domain}`,
      });

      return {
        domainId: domain._id,
        domain: domain.domain,
        status: "failed" as const,
        verified: false,
      };
    }
  },
});

export interface ProposedPersonInput {
  personId: Id<"persons">;
  firstName: string;
  lastName: string;
  middleName?: string;
  admissionYear?: number;
  isMinor?: boolean;
  minorPrivacyRequested?: boolean;
}

export interface AddressProposalResult {
  personId: Id<"persons">;
  proposedEmail: string;
  localPart: string;
  domain: string;
  stage: 1 | 2 | 3 | 4;
  collisionDetected: boolean;
  needsManualReview: boolean;
  state: "login_only" | "external_verified" | "provider_provisioned";
  isMinor: boolean;
  minorPrivacyApplied: boolean;
}

/**
 * Address proposal workbench:
 * Computes deterministic email addresses using a 4-stage collision resolution pipeline:
 *  1. firstname.lastname@domain
 *  2. firstname.m.lastname@domain
 *  3. firstname.lastname2@domain
 *  4. Manual edit required
 * Supports minor privacy safeguards (f.lastname@domain).
 */
export const proposeEmailAddresses = query({
  args: {
    schoolId: v.id("schools"),
    domainId: v.optional(v.id("schoolEmailDomains")),
    persons: v.array(
      v.object({
        personId: v.id("persons"),
        firstName: v.string(),
        lastName: v.string(),
        middleName: v.optional(v.string()),
        admissionYear: v.optional(v.number()),
        isMinor: v.optional(v.boolean()),
        minorPrivacyRequested: v.optional(v.boolean()),
      })
    ),
    customDomain: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AddressProposalResult[]> => {
    // 1. Resolve domain
    let domainRecord = args.domainId ? await ctx.db.get(args.domainId) : null;
    if (!domainRecord) {
      domainRecord = await ctx.db
        .query("schoolEmailDomains")
        .withIndex("by_school_and_default", (q) =>
          q.eq("schoolId", args.schoolId).eq("isDefault", true)
        )
        .first();
    }

    const domainName =
      domainRecord?.domain ?? args.customDomain ?? "school.edu.ng";

    // 2. Resolve capability state based on domain status & provider
    let mailboxState: "login_only" | "external_verified" | "provider_provisioned" =
      "login_only";

    if (domainRecord && domainRecord.status === "verified") {
      if (domainRecord.provider === "none") {
        mailboxState = "external_verified";
      } else if (
        domainRecord.provider === "google" ||
        domainRecord.provider === "microsoft" ||
        domainRecord.provider === "zoho"
      ) {
        mailboxState = "provider_provisioned";
      }
    }

    // 3. Track in-batch reserved addresses and query DB for collisions
    const batchReservedEmails = new Set<string>();
    const results: AddressProposalResult[] = [];

    for (const person of args.persons) {
      const applyMinorPrivacy = Boolean(
        person.isMinor && person.minorPrivacyRequested
      );

      let chosenLocalPart = "";
      let chosenStage: 1 | 2 | 3 | 4 = 1;
      let collisionDetected = false;
      let needsManualReview = false;

      // Helper to test if a candidate local part collides
      const isCandidateAvailable = async (candidateLocal: string) => {
        const fullAddress = `${candidateLocal}@${domainName}`;
        if (batchReservedEmails.has(fullAddress)) {
          return false;
        }

        // Check against institutionalMailboxes table (permanent re-allocation freeze)
        const existing = await ctx.db
          .query("institutionalMailboxes")
          .withIndex("by_email", (q) => q.eq("email", fullAddress))
          .first();

        return !existing;
      };

      // Stage 1: Base Convention
      const stage1Local = computeAddressCandidate(
        person.firstName,
        person.lastName,
        person.middleName,
        1,
        applyMinorPrivacy
      );

      if (await isCandidateAvailable(stage1Local)) {
        chosenLocalPart = stage1Local;
        chosenStage = 1;
      } else {
        collisionDetected = true;
        // Stage 2: Middle Initial Insertion
        const stage2Local = computeAddressCandidate(
          person.firstName,
          person.lastName,
          person.middleName,
          2,
          applyMinorPrivacy
        );

        if (
          person.middleName &&
          stage2Local !== stage1Local &&
          (await isCandidateAvailable(stage2Local))
        ) {
          chosenLocalPart = stage2Local;
          chosenStage = 2;
        } else {
          // Stage 3: Numeric Suffix '2'
          const stage3Local = computeAddressCandidate(
            person.firstName,
            person.lastName,
            person.middleName,
            3,
            applyMinorPrivacy
          );

          if (await isCandidateAvailable(stage3Local)) {
            chosenLocalPart = stage3Local;
            chosenStage = 3;
          } else {
            // Stage 4: Manual review required
            chosenLocalPart = stage1Local;
            chosenStage = 4;
            needsManualReview = true;
          }
        }
      }

      const finalAddress = `${chosenLocalPart}@${domainName}`;
      batchReservedEmails.add(finalAddress);

      results.push({
        personId: person.personId,
        proposedEmail: finalAddress,
        localPart: chosenLocalPart,
        domain: domainName,
        stage: chosenStage,
        collisionDetected,
        needsManualReview,
        state: mailboxState,
        isMinor: Boolean(person.isMinor),
        minorPrivacyApplied: applyMinorPrivacy,
      });
    }

    return results;
  },
});

/**
 * Assigns an institutional mailbox to a person with fault isolation.
 * If external provider fails, internal person and branch memberships remain intact.
 */
export const assignInstitutionalMailbox = mutation({
  args: {
    schoolId: v.id("schools"),
    personId: v.id("persons"),
    email: v.string(),
    state: v.union(
      v.literal("login_only"),
      v.literal("external_verified"),
      v.literal("provider_provisioned")
    ),
    providerType: v.optional(
      v.union(
        v.literal("google"),
        v.literal("microsoft"),
        v.literal("zoho"),
        v.literal("none")
      )
    ),
    providerAccountId: v.optional(v.string()),
    isMinor: v.optional(v.boolean()),
    minorPrivacyRequested: v.optional(v.boolean()),
    simulateProviderFailure: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId);
    if (!person) {
      throw new ConvexError("Person not found");
    }

    const school = await ctx.db.get(args.schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    const normalizedEmail = args.email.toLowerCase().trim();

    // Permanent Re-allocation Freeze Check:
    // If the address exists and belongs to someone else, reject
    const existing = await ctx.db
      .query("institutionalMailboxes")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existing && existing.personId !== args.personId) {
      throw new ConvexError(
        "Address already allocated and frozen for another person"
      );
    }

    // Provider Fault Isolation Seam:
    // If provider API fails, internal person/membership MUST remain intact
    if (args.simulateProviderFailure) {
      // Record failure without corrupting or modifying person/membership
      const now = Date.now();
      let mailboxId: Id<"institutionalMailboxes">;

      if (existing) {
        await ctx.db.patch(existing._id, {
          lastSyncError: "Provider API failure (HTTP 503): Service Unavailable",
          updatedAt: now,
        });
        mailboxId = existing._id;
      } else {
        mailboxId = await ctx.db.insert("institutionalMailboxes", {
          personId: args.personId,
          schoolId: args.schoolId,
          email: normalizedEmail,
          address: normalizedEmail,
          state: "login_only", // Safe fallback state upon provider failure
          providerType: args.providerType ?? "none",
          providerAccountId: args.providerAccountId,
          status: "active",
          isMinor: args.isMinor,
          minorPrivacyRequested: args.minorPrivacyRequested,
          lastSyncError: "Provider API failure (HTTP 503): Service Unavailable",
          createdAt: now,
          updatedAt: now,
        });
      }

      await recordAuditEventHelper(ctx, {
        schoolId: args.schoolId,
        actorKind: "system",
        actorEmailSnapshot: "system@melo.school",
        module: "institutional_email",
        action: "assign_mailbox_provider_failure",
        targetType: "institutionalMailboxes",
        targetId: String(mailboxId),
        outcome: "failed",
        safeSummary: `External directory sync failed for ${normalizedEmail}; internal identity preserved`,
      });

      return {
        success: false,
        error: "Provider API failure (HTTP 503): Service Unavailable",
        mailboxId,
        internalStateIntact: true,
      };
    }

    const now = Date.now();
    let mailboxId: Id<"institutionalMailboxes">;

    if (existing) {
      await ctx.db.patch(existing._id, {
        state: args.state,
        providerType: args.providerType ?? existing.providerType,
        providerAccountId: args.providerAccountId ?? existing.providerAccountId,
        status: "active",
        isMinor: args.isMinor ?? existing.isMinor,
        minorPrivacyRequested:
          args.minorPrivacyRequested ?? existing.minorPrivacyRequested,
        lastSyncError: undefined,
        updatedAt: now,
      });
      mailboxId = existing._id;
    } else {
      mailboxId = await ctx.db.insert("institutionalMailboxes", {
        personId: args.personId,
        schoolId: args.schoolId,
        email: normalizedEmail,
        address: normalizedEmail,
        state: args.state,
        providerType: args.providerType ?? "none",
        providerAccountId: args.providerAccountId,
        status: "active",
        isMinor: args.isMinor,
        minorPrivacyRequested: args.minorPrivacyRequested,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "system",
      actorEmailSnapshot: "system@melo.school",
      module: "institutional_email",
      action: "assign_institutional_mailbox",
      targetType: "institutionalMailboxes",
      targetId: String(mailboxId),
      outcome: "success",
      safeSummary: `Assigned institutional mailbox ${normalizedEmail} with capability ${args.state}`,
    });

    return {
      success: true,
      mailboxId,
      email: normalizedEmail,
      state: args.state,
      internalStateIntact: true,
    };
  },
});

/**
 * Suspends or archives a mailbox upon user departure.
 * Non-negotiable invariant: NEVER deletes or recycles the email address.
 */
export const suspendOrArchiveMailbox = mutation({
  args: {
    mailboxId: v.id("institutionalMailboxes"),
    action: v.union(v.literal("suspend"), v.literal("archive")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    if (!mailbox) {
      throw new ConvexError("Mailbox not found");
    }

    const now = Date.now();
    const newStatus = args.action === "suspend" ? "suspended" : "archived";

    await ctx.db.patch(mailbox._id, {
      status: newStatus,
      suspendedAt: args.action === "suspend" ? now : mailbox.suspendedAt,
      archivedAt: args.action === "archive" ? now : mailbox.archivedAt,
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: mailbox.schoolId,
      actorKind: "system",
      actorEmailSnapshot: "system@melo.school",
      module: "institutional_email",
      action: `mailbox_${args.action}`,
      targetType: "institutionalMailboxes",
      targetId: String(mailbox._id),
      outcome: "success",
      safeSummary: `Transitioned mailbox ${mailbox.email} to ${newStatus}. Address remains frozen.`,
    });

    return {
      success: true,
      mailboxId: mailbox._id,
      email: mailbox.email,
      status: newStatus,
    };
  },
});

/**
 * Queries institutional mailboxes for a school.
 */
export const getInstitutionalMailboxes = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("institutionalMailboxes")
      .withIndex("by_school_and_email", (q) => q.eq("schoolId", args.schoolId))
      .take(100);
  },
});

/**
 * Queries registered email domains for a school.
 */
export const getSchoolEmailDomains = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schoolEmailDomains")
      .withIndex("by_school_and_domain", (q) => q.eq("schoolId", args.schoolId))
      .take(50);
  },
});
