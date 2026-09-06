import { ConvexError } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireGroupOwner } from "./groupSettings";
import { resolveActiveMembership } from "./auth";
import { getContextCapabilities } from "./rbac";

const SOURCE_ROW_LIMIT = 500;
const TERM_LIMIT = 100;
const AGGREGATE_BRANCH_LIMIT = 3;

type DimensionKey =
  | "enrollment"
  | "attendance"
  | "finance"
  | "staffing"
  | "academics";
type MetricState =
  | "available"
  | "empty"
  | "unavailable"
  | "denied"
  | "module_disabled";
type MetricDetail = { label: string; value: number; unit: string };
type Metric = {
  key: DimensionKey;
  label: string;
  unit: string;
  value: number | null;
  state: MetricState;
  reason: string;
  basis: string;
  details: MetricDetail[];
};

const dimensions: readonly {
  key: DimensionKey;
  label: string;
  capability: string;
  module: "admissions" | "billing" | "curriculum" | null;
  unit: string;
}[] = [
  {
    key: "enrollment",
    label: "Enrollment",
    capability: "enrollment.intakes.manage",
    module: "admissions",
    unit: "active students",
  },
  {
    key: "attendance",
    label: "Attendance",
    capability: "academic.report_cards.preview",
    module: null,
    unit: "percent of recorded opportunities",
  },
  {
    key: "finance",
    label: "Finance",
    capability: "finance.reports.view",
    module: "billing",
    unit: "minor currency units",
  },
  {
    key: "staffing",
    label: "Staffing",
    capability: "staff.list.view",
    module: null,
    unit: "active staff accounts",
  },
  {
    key: "academics",
    label: "Academics",
    capability: "academic.report_cards.preview",
    module: "curriculum",
    unit: "published report-card average (%)",
  },
];

function metric(
  key: DimensionKey,
  state: MetricState,
  value: number | null,
  reason: string,
  basis: string,
  details: MetricDetail[] = [],
): Metric {
  const definition = dimensions.find((item) => item.key === key)!;
  return {
    key,
    label: definition.label,
    unit: definition.unit,
    value,
    state,
    reason,
    basis,
    details,
  };
}

function overflowMetric(key: DimensionKey, source: string) {
  return metric(
    key,
    "unavailable",
    null,
    `${source} exceeds the ${SOURCE_ROW_LIMIT.toLocaleString()}-row reviewed query bound. No partial value is shown.`,
    "Bounded source adapter; filter to a branch or use a future maintained counter for larger datasets.",
  );
}

async function enrollmentMetric(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
): Promise<Metric> {
  const students = await ctx.db
    .query("students")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .take(SOURCE_ROW_LIMIT + 1);
  if (students.length > SOURCE_ROW_LIMIT)
    return overflowMetric("enrollment", "Student roster");
  const activeUserIds = new Set<string>();
  let excluded = 0;
  for (const student of students) {
    if (
      student.isArchived ||
      (student.enrollmentStatus && student.enrollmentStatus !== "active")
    ) {
      excluded += 1;
      continue;
    }
    const user = await ctx.db.get(student.userId);
    if (
      !user ||
      user.schoolId !== schoolId ||
      user.role !== "student" ||
      user.isArchived ||
      activeUserIds.has(String(user._id))
    ) {
      excluded += 1;
      continue;
    }
    activeUserIds.add(String(user._id));
  }
  const count = activeUserIds.size;
  return metric(
    "enrollment",
    count ? "available" : "empty",
    count,
    count
      ? "Current active, unique student records."
      : "No active student records meet the reviewed roster policy.",
    "Current snapshot, not a historical period count. Excludes archived, graduated, withdrawn, transferred-out, wrong-role, wrong-school and duplicate-user rows.",
    [{ label: "Excluded roster rows", value: excluded, unit: "rows" }],
  );
}

async function staffingMetric(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
): Promise<Metric> {
  const users = await ctx.db
    .query("users")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .take(SOURCE_ROW_LIMIT + 1);
  if (users.length > SOURCE_ROW_LIMIT)
    return overflowMetric("staffing", "User directory");
  const staffKeys = new Set<string>();
  for (const user of users) {
    if (user.isArchived || (user.role !== "admin" && user.role !== "teacher"))
      continue;
    staffKeys.add(
      user.personId
        ? `person:${user.personId}`
        : user.authTokenIdentifier
          ? `token:${user.authTokenIdentifier}`
          : `legacy:${user.authId}`,
    );
  }
  return metric(
    "staffing",
    staffKeys.size ? "available" : "empty",
    staffKeys.size,
    staffKeys.size
      ? "Current nonarchived admin and teacher accounts, deduplicated by canonical person or authentication identity."
      : "No active admin or teacher accounts were recorded.",
    "Current account snapshot. This is not an employment, FTE, payroll or attendance measure.",
  );
}

async function periodTerms(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
  startDate: number,
  endDate: number,
) {
  const terms = await ctx.db
    .query("academicTerms")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .take(TERM_LIMIT + 1);
  if (terms.length > TERM_LIMIT) return null;
  return terms.filter(
    (term) => term.startDate >= startDate && term.endDate <= endDate,
  );
}

async function attendanceMetric(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
  terms: Doc<"academicTerms">[] | null,
): Promise<Metric> {
  if (!terms)
    return metric(
      "attendance",
      "unavailable",
      null,
      `Academic terms exceed the ${TERM_LIMIT}-row reviewed bound.`,
      "Only terms fully contained in the selected UTC period are included.",
    );
  if (!terms.length)
    return metric(
      "attendance",
      "empty",
      null,
      "No complete academic term falls within the selected period.",
      "Only complete terms are used; partial-term attendance is not inferred.",
    );
  const termIds = new Set(terms.map((term) => String(term._id)));
  const [classRows, studentRows] = await Promise.all([
    ctx.db
      .query("reportCardAttendanceClassValues")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .take(SOURCE_ROW_LIMIT + 1),
    ctx.db
      .query("reportCardAttendanceStudentValues")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .take(SOURCE_ROW_LIMIT + 1),
  ]);
  if (
    classRows.length > SOURCE_ROW_LIMIT ||
    studentRows.length > SOURCE_ROW_LIMIT
  )
    return overflowMetric("attendance", "Attendance records");
  const openings = new Map<string, Doc<"reportCardAttendanceClassValues">>();
  for (const row of classRows) {
    if (!termIds.has(String(row.termId))) continue;
    const key = `${row.classId}:${row.sessionId}:${row.termId}`;
    const prior = openings.get(key);
    if (!prior || row.updatedAt > prior.updatedAt) openings.set(key, row);
  }
  const latestStudents = new Map<
    string,
    Doc<"reportCardAttendanceStudentValues">
  >();
  for (const row of studentRows) {
    if (!termIds.has(String(row.termId))) continue;
    const key = `${row.studentId}:${row.sessionId}:${row.termId}`;
    const prior = latestStudents.get(key);
    if (!prior || row.updatedAt > prior.updatedAt) latestStudents.set(key, row);
  }
  let present = 0;
  let opportunities = 0;
  let excluded = 0;
  for (const row of latestStudents.values()) {
    const classValue = openings.get(
      `${row.classId}:${row.sessionId}:${row.termId}`,
    );
    const opened = classValue?.timesSchoolOpened;
    const recorded = row.timesPresent;
    if (
      opened === undefined ||
      recorded === undefined ||
      !Number.isFinite(opened) ||
      !Number.isFinite(recorded) ||
      opened <= 0 ||
      recorded < 0 ||
      recorded > opened
    ) {
      excluded += 1;
      continue;
    }
    present += recorded;
    opportunities += opened;
  }
  if (!opportunities)
    return metric(
      "attendance",
      "empty",
      null,
      "No valid attendance numerator and denominator pairs were recorded for complete terms.",
      "Missing or invalid attendance is excluded, never treated as zero.",
      [{ label: "Excluded records", value: excluded, unit: "records" }],
    );
  return metric(
    "attendance",
    "available",
    Math.round((present / opportunities) * 1000) / 10,
    "Attendance across valid recorded student-term opportunities.",
    "Complete terms fully contained in the selected UTC period; missing or invalid records are excluded.",
    [
      { label: "Times present", value: present, unit: "opportunities" },
      {
        label: "Recorded opportunities",
        value: opportunities,
        unit: "opportunities",
      },
      { label: "Excluded records", value: excluded, unit: "records" },
    ],
  );
}

async function financeMetric(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
  startDate: number,
  endDate: number,
): Promise<Metric> {
  const [invoices, payments] = await Promise.all([
    ctx.db
      .query("studentInvoices")
      .withIndex("by_school_and_issued_at", (q) =>
        q
          .eq("schoolId", schoolId)
          .gte("issuedAt", startDate)
          .lt("issuedAt", endDate),
      )
      .take(SOURCE_ROW_LIMIT + 1),
    ctx.db
      .query("billingPayments")
      .withIndex("by_school_and_received_at", (q) =>
        q
          .eq("schoolId", schoolId)
          .gte("receivedAt", startDate)
          .lt("receivedAt", endDate),
      )
      .take(SOURCE_ROW_LIMIT + 1),
  ]);
  if (invoices.length > SOURCE_ROW_LIMIT || payments.length > SOURCE_ROW_LIMIT)
    return overflowMetric(
      "finance",
      "Finance ledger rows in the selected period",
    );
  const values = new Map<
    string,
    { assessed: number; outstanding: number; collected: number; waived: number }
  >();
  const ensure = (currency: string) => {
    const normalized = currency.trim().toUpperCase() || "UNSPECIFIED";
    const current = values.get(normalized) ?? {
      assessed: 0,
      outstanding: 0,
      collected: 0,
      waived: 0,
    };
    values.set(normalized, current);
    return current;
  };
  const invoiceCurrency = new Map<string, string>();
  for (const invoice of invoices) {
    invoiceCurrency.set(String(invoice._id), invoice.currency);
    if (invoice.status === "draft" || invoice.status === "cancelled") continue;
    const entry = ensure(invoice.currency);
    entry.assessed += invoice.totalAmount;
    entry.outstanding += invoice.balanceDue;
    entry.waived += invoice.waiverAmount;
  }
  for (const payment of payments) {
    if (payment.status !== "successful" && payment.status !== "reconciled")
      continue;
    let currency = invoiceCurrency.get(String(payment.invoiceId));
    if (!currency) {
      const invoice = await ctx.db.get(payment.invoiceId);
      if (!invoice || invoice.schoolId !== schoolId) continue;
      currency = invoice.currency;
    }
    ensure(currency).collected += payment.amountApplied;
  }
  const details = [...values.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([currency, value]) => [
      {
        label: `${currency} assessed`,
        value: value.assessed,
        unit: "minor units",
      },
      {
        label: `${currency} collected`,
        value: value.collected,
        unit: "minor units",
      },
      {
        label: `${currency} outstanding now`,
        value: value.outstanding,
        unit: "minor units",
      },
      { label: `${currency} waived`, value: value.waived, unit: "minor units" },
    ]);
  return metric(
    "finance",
    details.length ? "available" : "empty",
    null,
    details.length
      ? "Issued school-fee invoices and successful/reconciled applied payments, separated by currency."
      : "No issued invoices or successful/reconciled payments were recorded in the selected period.",
    "Invoice assessment uses issuedAt; collections use receivedAt. Outstanding is the current balance of invoices issued in-period. Draft/cancelled invoices and failed/pending/reversed payments are excluded. SaaS and settlement ledgers are excluded.",
    details,
  );
}

async function academicsMetric(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
  startDate: number,
  endDate: number,
): Promise<Metric> {
  const reports = await ctx.db
    .query("issuedReportCards")
    .withIndex("by_school_and_issued_at", (q) =>
      q
        .eq("schoolId", schoolId)
        .gte("issuedAt", startDate)
        .lt("issuedAt", endDate),
    )
    .take(SOURCE_ROW_LIMIT + 1);
  if (reports.length > SOURCE_ROW_LIMIT)
    return overflowMetric(
      "academics",
      "Published report cards in the selected period",
    );
  const scored = reports.filter(
    (report) => report.report.summary.averageScore !== null,
  );
  const students = new Set(reports.map((report) => String(report.studentId)));
  const average = scored.length
    ? scored.reduce(
        (sum, report) => sum + (report.report.summary.averageScore ?? 0),
        0,
      ) / scored.length
    : null;
  return metric(
    "academics",
    reports.length ? "available" : "empty",
    average === null ? null : Math.round(average * 10) / 10,
    reports.length
      ? "Immutable issued report-card snapshots; draft assessment rows are not counted as published outcomes."
      : "No report cards were issued in the selected period.",
    "Publication activity uses issuedAt. The displayed average is the mean of nonmissing issued-report averages within this branch; grading-policy comparability across branches is not asserted.",
    [
      { label: "Issued report cards", value: reports.length, unit: "reports" },
      {
        label: "Students with issued reports",
        value: students.size,
        unit: "students",
      },
      {
        label: "Reports with a recorded average",
        value: scored.length,
        unit: "reports",
      },
      {
        label: "Recorded average total",
        value: scored.reduce(
          (sum, report) => sum + (report.report.summary.averageScore ?? 0),
          0,
        ),
        unit: "percentage points",
      },
    ],
  );
}

function unavailableForLargeGroup(key: DimensionKey) {
  return metric(
    key,
    "unavailable",
    null,
    `All-branch aggregation is limited to ${AGGREGATE_BRANCH_LIMIT} branches per request. Select one branch for a bounded summary.`,
    "No partial group value is shown.",
  );
}

function aggregateMetric(
  key: DimensionKey,
  branches: { access: string; metrics: Metric[] }[],
): Metric {
  const active = branches.filter((branch) => branch.access !== "inactive");
  const selected = active
    .map((branch) => branch.metrics.find((item) => item.key === key))
    .filter((item): item is Metric => Boolean(item));
  if (
    selected.length !== active.length ||
    selected.some(
      (item) =>
        item.state === "denied" ||
        item.state === "module_disabled" ||
        item.state === "unavailable",
    )
  ) {
    return metric(
      key,
      "unavailable",
      null,
      "A complete group total cannot be shown because at least one active branch is denied, disabled, over a source bound or unavailable.",
      "Inactive branches are excluded; partial totals are never presented as group totals.",
    );
  }
  if (!selected.length || selected.every((item) => item.state === "empty"))
    return metric(
      key,
      "empty",
      key === "enrollment" || key === "staffing" ? 0 : null,
      "No included branch recorded a value.",
      "Complete across the selected active branches.",
    );
  const details = new Map<string, MetricDetail>();
  for (const item of selected)
    for (const detail of item.details) {
      const identity = `${detail.label}:${detail.unit}`;
      const prior = details.get(identity);
      details.set(identity, {
        ...detail,
        value: detail.value + (prior?.value ?? 0),
      });
    }
  let value: number | null = null;
  if (key === "enrollment" || key === "staffing")
    value = selected.reduce((sum, item) => sum + (item.value ?? 0), 0);
  if (key === "attendance") {
    const present =
      [...details.values()].find((item) => item.label === "Times present")
        ?.value ?? 0;
    const opportunities =
      [...details.values()].find(
        (item) => item.label === "Recorded opportunities",
      )?.value ?? 0;
    value = opportunities
      ? Math.round((present / opportunities) * 1000) / 10
      : null;
  }
  if (key === "academics") {
    const reportsWithAverage =
      [...details.values()].find(
        (item) => item.label === "Reports with a recorded average",
      )?.value ?? 0;
    const averageTotal =
      [...details.values()].find(
        (item) => item.label === "Recorded average total",
      )?.value ?? 0;
    value = reportsWithAverage
      ? Math.round((averageTotal / reportsWithAverage) * 10) / 10
      : null;
  }
  return metric(
    key,
    "available",
    value,
    "Complete aggregate across all selected active, authorized branches.",
    "Inactive branches are excluded. Finance remains separated by currency; academic averages are weighted by issued reports with recorded averages.",
    [...details.values()].sort((a, b) => a.label.localeCompare(b.label)),
  );
}

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
  ) {
    throw new ConvexError(
      "Choose a valid UTC period of at most 366 days (end exclusive)",
    );
  }
  const links = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
    .take(101);
  if (links.length > 100)
    throw new ConvexError("Group directory exceeds supported size");
  if (args.branchId && !links.some((link) => link.schoolId === args.branchId))
    throw new ConvexError("Forbidden: branch is not in this group");
  const selectedLinks = links.filter(
    (link) => !args.branchId || link.schoolId === args.branchId,
  );
  const aggregateSourcesAllowed =
    selectedLinks.length <= AGGREGATE_BRANCH_LIMIT;
  const branches: {
    schoolId: Id<"schools">;
    name: string;
    status: string;
    access: "inactive" | "denied" | "scoped";
    metrics: Metric[];
    drilldown: { auditPath: string } | null;
  }[] = [];
  for (const link of selectedLinks) {
    const school = await ctx.db.get(link.schoolId);
    const base = {
      schoolId: link.schoolId,
      name: school?.name ?? "Unavailable branch",
      status: school?.status ?? "unavailable",
    };
    if (school?.status !== "active") {
      branches.push({
        ...base,
        access: "inactive",
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
        access: "denied",
        metrics: [],
        drilldown: null,
      });
      continue;
    }
    const capabilities = await getContextCapabilities(ctx, membership);
    const terms = aggregateSourcesAllowed
      ? await periodTerms(ctx, school._id, args.startDate, args.endDate)
      : null;
    const metrics: Metric[] = [];
    for (const definition of dimensions) {
      const enabled =
        !definition.module || school.features?.[definition.module] !== false;
      const allowed = capabilities.includes(definition.capability);
      if (!enabled) {
        metrics.push(
          metric(
            definition.key,
            "module_disabled",
            null,
            "Branch module is disabled.",
            "No source records were read for this dimension.",
          ),
        );
      } else if (!allowed) {
        metrics.push(
          metric(
            definition.key,
            "denied",
            null,
            "The active branch membership lacks the required summary capability.",
            "No source records were read for this dimension.",
          ),
        );
      } else if (!aggregateSourcesAllowed) {
        metrics.push(unavailableForLargeGroup(definition.key));
      } else if (definition.key === "enrollment") {
        metrics.push(await enrollmentMetric(ctx, school._id));
      } else if (definition.key === "attendance") {
        metrics.push(await attendanceMetric(ctx, school._id, terms));
      } else if (definition.key === "finance") {
        metrics.push(
          await financeMetric(ctx, school._id, args.startDate, args.endDate),
        );
      } else if (definition.key === "staffing") {
        metrics.push(await staffingMetric(ctx, school._id));
      } else {
        metrics.push(
          await academicsMetric(ctx, school._id, args.startDate, args.endDate),
        );
      }
    }
    branches.push({
      ...base,
      access: "scoped",
      metrics,
      drilldown: capabilities.includes("audit.branch.view")
        ? { auditPath: "/admin/audit" }
        : null,
    });
  }
  return {
    period: {
      startDate: args.startDate,
      endDate: args.endDate,
      timezone: "UTC",
      endExclusive: true,
    },
    limits: {
      sourceRowsPerTable: SOURCE_ROW_LIMIT,
      termsPerBranch: TERM_LIMIT,
      branchesPerAggregate: AGGREGATE_BRANCH_LIMIT,
    },
    branches,
    totals: dimensions.map((dimension) =>
      aggregateSourcesAllowed
        ? aggregateMetric(dimension.key, branches)
        : unavailableForLargeGroup(dimension.key),
    ),
    note: "Metrics use bounded reviewed sources. Current enrollment/staffing snapshots, complete-term attendance, issued school-fee/payment activity and immutable issued report cards have distinct bases; unavailable or partial data is never presented as zero or a complete group total.",
  };
}
