import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import {
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

type Context = QueryCtx | MutationCtx;

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

export const getKnowledgeMaterialUploadReadiness = query({
  args: { schoolId: v.id("schools"), now: v.number() },
  returns: v.object({
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
    const actor = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId });
    const [hasPlanningPermission, hasUploadPermission, storage] = await Promise.all([
      hasCapability(ctx, actor.schoolId, TEACHER_PLANNING_CAPABILITIES),
      hasCapability(ctx, actor.schoolId, "assets.upload"),
      getContractBoundStorageReadiness(ctx, actor.schoolId, args.now),
    ]);
    const hasAssignedContext = actor.isSchoolAdmin || actor.role === "admin"
      ? true
      : await hasTeacherUploadAssignment(ctx, actor.userId, actor.schoolId);
    return {
      hasPlanningPermission,
      hasUploadPermission,
      hasAssignedContext,
      storage,
    };
  },
});
