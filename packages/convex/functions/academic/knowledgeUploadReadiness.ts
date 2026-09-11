import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import {
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import {
  getAuthenticatedSchoolMembership,
  getTeacherAssignableClassIds,
  getTeacherAssignableSubjectIds,
} from "./auth";
import { TEACHER_PLANNING_CAPABILITIES, type PermissionCapability } from "./rbac";
import { assertKnowledgeMaterialIngestionAccess } from "./lessonKnowledgeIngestionHelpers";
import { recordAuditEventHelper } from "./audit";

type Context = QueryCtx | MutationCtx;
const FINGERPRINT_BACKFILL_COMPLETE = "backfill:complete:v1";

export type ContractBoundStorageReadiness = {
  status: "missing_entitlement" | "exhausted" | "ready";
  allocatedBytes: number;
  consumedBytes: number;
  reservedBytes: number;
  availableBytes: number;
  maxFileSizeBytes: number | null;
};

async function hasCapability(
  ctx: Context,
  schoolId: Id<"schools">,
  capability: PermissionCapability | readonly PermissionCapability[],
): Promise<boolean> {
  try {
    // Match the operation gate exactly: managed memberships enforce capability
    // grants, while reviewed legacy callers retain the existing domain checks.
    await getAuthenticatedSchoolMembership(ctx, { schoolId, capability });
    return true;
  } catch {
    return false;
  }
}

function normalizeSha256(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new ConvexError("A valid SHA-256 file fingerprint is required");
  }
  return normalized;
}

export function storageSha256ToHex(value: string): string {
  if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
  try {
    const normalizedBase64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = normalizedBase64.padEnd(Math.ceil(normalizedBase64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(paddedBase64), (character) => character.charCodeAt(0));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    throw new ConvexError("Stored file fingerprint format is invalid");
  }
}

export async function isKnowledgeMaterialFingerprintProtectionReady(
  ctx: Context,
  schoolId: Id<"schools">,
): Promise<boolean> {
  const completed = await ctx.db
    .query("knowledgeMaterialFileFingerprints")
    .withIndex("by_school_and_sha256", (q) =>
      q.eq("schoolId", schoolId).eq("sha256", FINGERPRINT_BACKFILL_COMPLETE),
    )
    .unique();
  if (completed) return true;
  const legacyMaterials = await ctx.db
    .query("knowledgeMaterials")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .take(201);
  return legacyMaterials.length <= 200;
}

export async function hasDuplicateKnowledgeMaterialFile(
  ctx: Context,
  schoolId: Id<"schools">,
  sha256: string,
): Promise<boolean> {
  const fingerprints = await ctx.db
    .query("knowledgeMaterialFileFingerprints")
    .withIndex("by_school_and_sha256", (q) =>
      q.eq("schoolId", schoolId).eq("sha256", sha256),
    )
    .take(2);
  if (fingerprints.length > 1) {
    throw new ConvexError("Duplicate file fingerprints require reconciliation");
  }
  if (fingerprints[0]) return true;

  // Transitional compatibility for files uploaded before fingerprints existed.
  const completed = await ctx.db
    .query("knowledgeMaterialFileFingerprints")
    .withIndex("by_school_and_sha256", (q) =>
      q.eq("schoolId", schoolId).eq("sha256", FINGERPRINT_BACKFILL_COMPLETE),
    )
    .unique();
  if (completed) return false;
  const legacyMaterials = await ctx.db
    .query("knowledgeMaterials")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .order("desc")
    .take(201);
  if (legacyMaterials.length > 200) {
    throw new ConvexError("Duplicate-file protection is still being set up for this school. Try again in a moment.");
  }
  for (const material of legacyMaterials) {
    if (!material.storageId) continue;
    const metadata = await ctx.db.system.get("_storage", material.storageId);
    if (metadata && storageSha256ToHex(metadata.sha256) === sha256) return true;
  }
  return false;
}

async function hasTeacherUploadAssignment(
  ctx: Context,
  userId: Id<"users">,
  schoolId: Id<"schools">,
): Promise<boolean> {
  const classIds = await getTeacherAssignableClassIds(ctx, userId, schoolId);
  for (const classId of classIds) {
    if ((await getTeacherAssignableSubjectIds(ctx, userId, schoolId, classId)).length > 0) {
      return true;
    }
  }
  return false;
}

export async function getContractBoundStorageReadiness(
  ctx: Context,
  schoolId: Id<"schools">,
  now: number,
): Promise<ContractBoundStorageReadiness> {
  const cycles = await ctx.db
    .query("usageCycles")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .take(101);
  if (cycles.length > 100) {
    throw new ConvexError("Usage cycle history exceeds the upload readiness review bound");
  }
  const activeCycles = cycles.filter(
    (cycle) => cycle.status === "active" && cycle.startAt <= now && now < cycle.endAt,
  );
  if (activeCycles.length > 1) {
    throw new ConvexError("Overlapping usage cycles require reconciliation");
  }
  const cycle = activeCycles[0];
  const storageAllowance = cycle?.entitlement.allowances.find(
    (allowance) => allowance.meterType === "storage_bytes",
  );
  if (!cycle || !storageAllowance) {
    return {
      status: "missing_entitlement",
      allocatedBytes: 0,
      consumedBytes: 0,
      reservedBytes: 0,
      availableBytes: 0,
      maxFileSizeBytes: null,
    };
  }

  const meters = await ctx.db
    .query("usageMeterAllocations")
    .withIndex("by_school_and_meter", (q) =>
      q.eq("schoolId", schoolId).eq("meterType", "storage_bytes"),
    )
    .take(2);
  if (meters.length > 1) {
    throw new ConvexError("Duplicate storage meter requires reconciliation");
  }
  const meter = meters[0];
  if (!meter || meter.cycleId !== cycle._id || meter.allocatedUnits <= 0) {
    return {
      status: "missing_entitlement",
      allocatedBytes: 0,
      consumedBytes: meter?.consumedUnits ?? 0,
      reservedBytes: meter?.reservedUnits ?? 0,
      availableBytes: 0,
      maxFileSizeBytes: cycle.entitlement.maxFileSizeBytes,
    };
  }

  const availableBytes = Math.max(
    0,
    meter.allocatedUnits - meter.consumedUnits - meter.reservedUnits,
  );
  return {
    status: availableBytes > 0 ? "ready" : "exhausted",
    allocatedBytes: meter.allocatedUnits,
    consumedBytes: meter.consumedUnits,
    reservedBytes: meter.reservedUnits,
    availableBytes,
    maxFileSizeBytes: cycle.entitlement.maxFileSizeBytes,
  };
}

export async function requireContractBoundStorageForUpload(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  size: number,
): Promise<void> {
  const storage = await getContractBoundStorageReadiness(ctx, schoolId, Date.now());
  if (storage.status === "missing_entitlement") {
    throw new ConvexError("Storage entitlement is not active for this school");
  }
  if (storage.status === "exhausted") {
    throw new ConvexError("Storage quota is exhausted");
  }
  if (storage.maxFileSizeBytes !== null && size > storage.maxFileSizeBytes) {
    throw new ConvexError(
      `File exceeds the contract upload limit of ${storage.maxFileSizeBytes} bytes`,
    );
  }
}

export const backfillKnowledgeMaterialFileFingerprints = internalMutation({
  args: {
    schoolId: v.id("schools"),
    cursor: v.optional(v.string()),
    batchSize: v.number(),
    actorEmail: v.string(),
    confirmation: v.string(),
  },
  returns: v.object({
    isDone: v.boolean(),
    continueCursor: v.string(),
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    const actorEmail = args.actorEmail.trim().toLowerCase();
    if (!actorEmail || actorEmail.length > 240) {
      throw new ConvexError("A bounded Platform operator email is required");
    }
    if (args.confirmation !== "BACKFILL KNOWLEDGE FILE FINGERPRINTS") {
      throw new ConvexError("Type BACKFILL KNOWLEDGE FILE FINGERPRINTS after reviewing the target school");
    }
    if (!Number.isSafeInteger(args.batchSize) || args.batchSize < 1 || args.batchSize > 100) {
      throw new ConvexError("Fingerprint backfill batch size must be between 1 and 100");
    }
    const school = await ctx.db.get(args.schoolId);
    if (!school) throw new ConvexError("School not found");
    const completed = await ctx.db
      .query("knowledgeMaterialFileFingerprints")
      .withIndex("by_school_and_sha256", (q) =>
        q.eq("schoolId", args.schoolId).eq("sha256", FINGERPRINT_BACKFILL_COMPLETE),
      )
      .unique();
    if (completed) return { isDone: true, continueCursor: "", processed: 0 };

    const page = await ctx.db
      .query("knowledgeMaterials")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .paginate({ cursor: args.cursor ?? null, numItems: args.batchSize });
    let processed = 0;
    for (const material of page.page) {
      if (!material.storageId) continue;
      const metadata = await ctx.db.system.get("_storage", material.storageId);
      if (!metadata) continue;
      const sha256 = storageSha256ToHex(metadata.sha256);
      const existing = await ctx.db
        .query("knowledgeMaterialFileFingerprints")
        .withIndex("by_school_and_sha256", (q) =>
          q.eq("schoolId", args.schoolId).eq("sha256", sha256),
        )
        .take(2);
      if (existing.length > 1) {
        throw new ConvexError("Duplicate file fingerprints require reconciliation");
      }
      if (!existing[0]) {
        const now = Date.now();
        await ctx.db.insert("knowledgeMaterialFileFingerprints", {
          schoolId: args.schoolId,
          sha256,
          materialId: material._id,
          status: "completed",
          createdAt: now,
          updatedAt: now,
        });
      }
      processed += 1;
    }
    if (page.isDone) {
      const now = Date.now();
      const markerId = await ctx.db.insert("knowledgeMaterialFileFingerprints", {
        schoolId: args.schoolId,
        sha256: FINGERPRINT_BACKFILL_COMPLETE,
        status: "backfill_complete",
        createdAt: now,
        updatedAt: now,
      });
      await recordAuditEventHelper(ctx, {
        schoolId: args.schoolId,
        actorKind: "platform_admin",
        actorEmailSnapshot: actorEmail,
        module: "academic",
        action: "knowledge_material_fingerprints.backfilled",
        targetType: "knowledge_material_fingerprint_backfill",
        targetId: markerId,
        outcome: "success",
        safeSummary: `Completed the bounded legacy knowledge-material fingerprint backfill after processing ${processed} files in the final batch`,
        retentionClass: "permanent_statutory",
        alertTier: "tier2_warn",
      });
    }
    return {
      isDone: page.isDone,
      continueCursor: page.isDone ? "" : page.continueCursor,
      processed,
    };
  },
});

export const getTrackedKnowledgeMaterialProcessingStatuses = query({
  args: {
    schoolId: v.id("schools"),
    materialIds: v.array(v.id("knowledgeMaterials")),
  },
  returns: v.array(v.object({
    materialId: v.id("knowledgeMaterials"),
    title: v.string(),
    processingStatus: v.union(
      v.literal("awaiting_upload"),
      v.literal("queued"),
      v.literal("extracting"),
      v.literal("ready"),
      v.literal("ocr_needed"),
      v.literal("failed"),
    ),
  })),
  handler: async (ctx, args) => {
    if (args.materialIds.length > 20 || new Set(args.materialIds.map(String)).size !== args.materialIds.length) {
      throw new ConvexError("Track at most 20 unique knowledge materials");
    }
    const actor = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId });
    if (actor.role !== "admin" && !actor.isSchoolAdmin) {
      throw new ConvexError("Admin access required");
    }
    const statuses = [];
    for (const materialId of args.materialIds) {
      const material = await ctx.db.get(materialId);
      if (!material || material.schoolId !== actor.schoolId) continue;
      statuses.push({
        materialId: material._id,
        title: material.title,
        processingStatus: material.processingStatus,
      });
    }
    return statuses;
  },
});

export const checkKnowledgeMaterialFileDuplicate = query({
  args: { schoolId: v.id("schools"), sha256: v.string() },
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId,
      capability: TEACHER_PLANNING_CAPABILITIES,
    });
    await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId,
      capability: "assets.upload",
    });
    assertKnowledgeMaterialIngestionAccess({
      userId: actor.userId,
      schoolId: actor.schoolId,
      role: actor.role as "teacher" | "admin" | "student",
      isSchoolAdmin: actor.isSchoolAdmin,
    });
    return {
      duplicate: await hasDuplicateKnowledgeMaterialFile(
        ctx,
        actor.schoolId,
        normalizeSha256(args.sha256),
      ),
    };
  },
});

// This is a refreshed UI preflight only. Upload mutations independently enforce
// the active contract with server time before reserving storage.
export const getKnowledgeMaterialUploadReadiness = query({
  args: { schoolId: v.id("schools"), now: v.number() },
  returns: v.object({
    fingerprintVersion: v.union(v.literal(0), v.literal(1)),
    hasPlanningPermission: v.boolean(),
    hasUploadPermission: v.boolean(),
    hasAssignedContext: v.boolean(),
    storage: v.object({
      status: v.union(
        v.literal("missing_entitlement"),
        v.literal("exhausted"),
        v.literal("ready"),
      ),
      allocatedBytes: v.number(),
      consumedBytes: v.number(),
      reservedBytes: v.number(),
      availableBytes: v.number(),
      maxFileSizeBytes: v.union(v.number(), v.null()),
    }),
  }),
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.now) || args.now < 0) {
      throw new ConvexError("A valid readiness observation time is required");
    }
    const actor = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId });
    const [hasPlanningPermission, hasUploadPermission, storage, fingerprintReady] = await Promise.all([
      hasCapability(ctx, actor.schoolId, TEACHER_PLANNING_CAPABILITIES),
      hasCapability(ctx, actor.schoolId, "assets.upload"),
      getContractBoundStorageReadiness(ctx, actor.schoolId, args.now),
      isKnowledgeMaterialFingerprintProtectionReady(ctx, actor.schoolId),
    ]);
    const hasAssignedContext = actor.isSchoolAdmin || actor.role === "admin"
      ? true
      : await hasTeacherUploadAssignment(ctx, actor.userId, actor.schoolId);
    return {
      fingerprintVersion: fingerprintReady ? 1 as const : 0 as const,
      hasPlanningPermission,
      hasUploadPermission,
      hasAssignedContext,
      storage,
    };
  },
});
