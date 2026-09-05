import { ConvexError } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { requireGroupOwner } from "./groupSettings";
import { resolveActiveMembership } from "./auth";
import { getContextCapabilities } from "./rbac";

const dimensions = [
  {
    key: "enrollment",
    label: "Enrollment",
    capability: "enrollment.intakes.manage",
    module: "admissions",
    unit: "active students",
    reason:
      "No bounded active-enrollment counter with archived, duplicate and historical-only exclusions.",
  },
  {
    key: "attendance",
    label: "Attendance",
    capability: null,
    module: null,
    unit: "present / recorded attendance opportunities (%)",
    reason:
      "No authorized bounded attendance denominator source; missing attendance is not zero.",
  },
  {
    key: "finance",
    label: "Finance",
    capability: "finance.reports.view",
    module: "billing",
    unit: "minor currency units, separated by currency",
    reason:
      "No bounded period ledger aggregate; invoices, receipts and settlements must not be conflated.",
  },
  {
    key: "staffing",
    label: "Staffing",
    capability: "staff.list.view",
    module: null,
    unit: "active staff people",
    reason:
      "No bounded staff counter; memberships include nonstaff and are not a staff headcount.",
  },
  {
    key: "academics",
    label: "Academics",
    capability: "academic.report_cards.preview",
    module: "curriculum",
    unit: "published assessments with denominator",
    reason:
      "No bounded session/term academic aggregate or comparable cross-branch grading denominator.",
  },
] as const;

export async function getOperationalOverviewHelper(
  ctx: QueryCtx,
  args: {
    groupId: Id<"schoolGroups">;
    branchId?: Id<"schools">;
    startDate: number;
    endDate: number;
  },
) {
  await requireGroupOwner(ctx, args.groupId);
  if (
    !Number.isSafeInteger(args.startDate) ||
    !Number.isSafeInteger(args.endDate) ||
    args.startDate < 0 ||
    args.endDate <= args.startDate ||
    args.endDate - args.startDate > 366 * 86400000
  )
    throw new ConvexError(
      "Choose a valid UTC period of at most 366 days (end exclusive)",
    );
  const links = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
    .take(101);
  if (links.length > 100)
    throw new ConvexError("Group directory exceeds supported size");
  if (args.branchId && !links.some((link) => link.schoolId === args.branchId))
    throw new ConvexError("Forbidden: branch is not in this group");
  const branches = [];
  for (const link of links) {
    if (args.branchId && link.schoolId !== args.branchId) continue;
    // Group authority permits only link/status metadata until explicit membership passes.
    const school = await ctx.db.get(link.schoolId);
    const base = {
      schoolId: link.schoolId,
      name: school?.name ?? "Unavailable branch",
      status: school?.status ?? "unavailable",
    };
    if (school?.status !== "active") {
      branches.push({
        ...base,
        access: "inactive" as const,
        metrics: [],
        drilldown: null,
      });
      continue;
    }
    const membership = await resolveActiveMembership(ctx, link.schoolId).catch(
      (error: unknown) => {
        if (error instanceof ConvexError) return null;
        throw error;
      },
    );
    if (!membership?.membershipId || membership.isPlatformAdmin) {
      branches.push({
        ...base,
        access: "denied" as const,
        metrics: [],
        drilldown: null,
      });
      continue;
    }
    const capabilities = await getContextCapabilities(ctx, membership);
    const metrics = dimensions.map((dimension) => {
      const enabled =
        !dimension.module || school.features?.[dimension.module] !== false;
      const allowed =
        dimension.capability !== null &&
        capabilities.includes(dimension.capability);
      return {
        key: dimension.key,
        label: dimension.label,
        unit: dimension.unit,
        value: null,
        state: !enabled
          ? ("module_disabled" as const)
          : !allowed
            ? ("denied" as const)
            : ("unavailable" as const),
        reason: !enabled
          ? "Branch module is disabled"
          : !allowed
            ? "No approved summary capability for this dimension"
            : dimension.reason,
      };
    });
    branches.push({
      ...base,
      access: "scoped" as const,
      metrics,
      drilldown: null,
    });
  }
  return {
    period: {
      startDate: args.startDate,
      endDate: args.endDate,
      timezone: "UTC",
      endExclusive: true,
    },
    branches,
    totals: dimensions.map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      value: null,
      state: "unavailable" as const,
    })),
    note: "No numeric totals are available. No raw student, attendance, staff, assessment or finance records were queried. Session/term comparisons and guarded selected-branch drilldowns await domain adapters.",
  };
}
