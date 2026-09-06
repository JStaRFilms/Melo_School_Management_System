import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";
import { requireGroupOwner } from "./groupSettings";

type Context = QueryCtx | MutationCtx;
type ResetFrequency = "continuous" | "session" | "calendar";
type CounterStatus = "active" | "paused";

export function validateSequence(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 999999999) {
    throw new ConvexError("Sequence must be an integer from 1 to 999999999");
  }
}

export function validatePattern(pattern: string): void {
  const tokens = pattern.match(/\{[^}]+\}/g) ?? [];
  if (
    pattern.length > 120 ||
    tokens.filter((token) => /^\{SEQ:[1-9]\}$/.test(token)).length !== 1 ||
    !/^[A-Za-z0-9/_. -]*$/.test(
      pattern.replace(/\{(SCHOOL|CAMPUS|LEVEL|YEAR|SEQ:[1-9])\}/g, ""),
    )
  ) {
    throw new ConvexError(
      "Use exactly one {SEQ:1}–{SEQ:9} and only SCHOOL, CAMPUS, LEVEL, YEAR tokens or letters, numbers, / _ . - separators",
    );
  }
}

export function formatAdmissionNumber(
  pattern: string,
  tokens: {
    school: string;
    campus: string;
    level: string;
    year: number | string;
    seq: number;
  },
): string {
  validatePattern(pattern);
  validateSequence(tokens.seq);
  return pattern.replace(
    /\{(SCHOOL|CAMPUS|LEVEL|YEAR|SEQ:([1-9]))\}/g,
    (_, token: string, width: string) =>
      token.startsWith("SEQ:")
        ? String(tokens.seq).padStart(Number(width), "0")
        : token === "SCHOOL"
          ? tokens.school
          : token === "CAMPUS"
            ? tokens.campus
            : token === "LEVEL"
              ? tokens.level
              : String(tokens.year),
  );
}

function normalizeSequenceKey(value: string) {
  const key = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(key)) {
    throw new ConvexError(
      "Sequence key requires 1–40 lowercase letters, numbers, underscores or hyphens",
    );
  }
  return key;
}

function normalizeLevel(value: string | undefined) {
  const level = value?.trim().toLowerCase();
  if (level && level.length > 80) throw new ConvexError("Level is too long");
  return level || undefined;
}

function periodFor(
  frequency: ResetFrequency,
  session: Doc<"academicSessions">,
) {
  return frequency === "session"
    ? String(session._id)
    : frequency === "calendar"
      ? String(new Date().getUTCFullYear())
      : "continuous";
}

async function getActiveSession(ctx: Context, schoolId: Id<"schools">) {
  const sessions = await ctx.db
    .query("academicSessions")
    .withIndex("by_school_active", (q) =>
      q.eq("schoolId", schoolId).eq("isActive", true),
    )
    .take(2);
  return sessions.length === 1 && !sessions[0].isArchived ? sessions[0] : null;
}

async function resolveEffectiveFormat(
  ctx: Context,
  policy: Doc<"admissionNumberPolicies">,
) {
  const link = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_school", (q) => q.eq("schoolId", policy.schoolId))
    .unique();
  const group = link ? await ctx.db.get(link.groupId) : null;
  const groupDefault =
    group?.status === "active" ? group.admissionNumberDefault : undefined;
  const choice = link?.admissionNumberFormat;
  const useGroup =
    Boolean(groupDefault) &&
    (choice?.mode === "inherit" ||
      (choice?.mode === "override" && !groupDefault?.allowBranchOverride));
  if (useGroup && groupDefault && link && group) {
    return {
      pattern: groupDefault.pattern,
      source: "group" as const,
      formatVersion: `group:${group._id}:${groupDefault.version}:${choice?.revision ?? 0}`,
      groupId: group._id,
      groupSlug: group.slug,
      groupVersion: groupDefault.version,
      branchRevision: choice?.revision ?? 0,
      allowBranchOverride: groupDefault.allowBranchOverride,
      mode: choice?.mode ?? "inherit",
    };
  }
  return {
    pattern: policy.pattern,
    source: "branch" as const,
    formatVersion: `branch:${policy.version ?? 0}:${choice?.revision ?? 0}`,
    groupId: group?._id ?? null,
    groupSlug: group?.slug ?? null,
    groupVersion: groupDefault?.version ?? 0,
    branchRevision: choice?.revision ?? 0,
    allowBranchOverride: groupDefault?.allowBranchOverride ?? false,
    mode: choice?.mode ?? "local",
  };
}

type SelectedCounter =
  | {
      kind: "legacy";
      key: "default";
      name: "Default branch sequence";
      level?: undefined;
      currentSequence: number;
      resetFrequency: ResetFrequency;
      resetPeriod?: string;
      status: CounterStatus;
      configVersion: number;
      id: Id<"admissionNumberPolicies">;
    }
  | {
      kind: "named";
      key: string;
      name: string;
      level?: string;
      currentSequence: number;
      resetFrequency: ResetFrequency;
      resetPeriod?: string;
      status: "active" | "paused" | "archived";
      configVersion: number;
      id: Id<"admissionNumberSequences">;
    };

async function loadNamedCounter(
  ctx: Context,
  schoolId: Id<"schools">,
  key: string,
) {
  return await ctx.db
    .query("admissionNumberSequences")
    .withIndex("by_school_and_key", (q) =>
      q.eq("schoolId", schoolId).eq("key", key),
    )
    .unique();
}

async function selectCounter(
  ctx: Context,
  policy: Doc<"admissionNumberPolicies">,
  level?: string,
  requestedKey?: string,
): Promise<SelectedCounter> {
  if (requestedKey && requestedKey !== "default") {
    const named = await loadNamedCounter(
      ctx,
      policy.schoolId,
      normalizeSequenceKey(requestedKey),
    );
    if (!named || named.status === "archived") {
      throw new ConvexError("Selected admission sequence is unavailable");
    }
    return { kind: "named", ...named, id: named._id };
  }

  const normalizedLevel = normalizeLevel(level);
  if (normalizedLevel) {
    const levelCounters = await ctx.db
      .query("admissionNumberSequences")
      .withIndex("by_school_and_level", (q) =>
        q.eq("schoolId", policy.schoolId).eq("level", normalizedLevel),
      )
      .take(3);
    const configured = levelCounters.filter(
      (counter) => counter.status !== "archived",
    );
    if (configured.length > 1) {
      throw new ConvexError(
        "Multiple counters target this level; configuration review required",
      );
    }
    if (configured[0]) {
      return {
        kind: "named",
        ...configured[0],
        id: configured[0]._id,
      };
    }
  }

  if (policy.defaultSequenceKey) {
    const named = await loadNamedCounter(
      ctx,
      policy.schoolId,
      policy.defaultSequenceKey,
    );
    if (!named || named.status === "archived" || named.level) {
      throw new ConvexError(
        "Configured default admission sequence is unavailable",
      );
    }
    return { kind: "named", ...named, id: named._id };
  }

  return {
    kind: "legacy",
    key: "default",
    name: "Default branch sequence",
    currentSequence: policy.currentSequence,
    resetFrequency: policy.resetFrequency ?? "continuous",
    resetPeriod: policy.resetPeriod,
    status: policy.counterStatus ?? "active",
    configVersion: policy.counterVersion ?? 0,
    id: policy._id,
  };
}

async function getContext(
  ctx: Context,
  args: {
    schoolId: Id<"schools">;
    level?: string;
    sequenceKey?: string;
  },
) {
  const policy = await ctx.db
    .query("admissionNumberPolicies")
    .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
    .unique();
  const session = await getActiveSession(ctx, args.schoolId);
  if (!policy || !session) return { policy, session };
  const format = await resolveEffectiveFormat(ctx, policy);
  const counter = await selectCounter(
    ctx,
    policy,
    args.level,
    args.sequenceKey,
  );
  const period = periodFor(counter.resetFrequency, session);
  // A legacy row without a reset marker is preserved. It is never guessed back to one.
  const sequence =
    counter.resetPeriod !== undefined && counter.resetPeriod !== period
      ? 1
      : counter.currentSequence;
  return { policy, session, format, counter, period, sequence };
}

function assertExpected(
  context: Awaited<ReturnType<typeof getContext>>,
  expected: {
    expectedVersion?: number;
    expectedFormatVersion?: string;
    expectedCounterKey?: string;
    expectedCounterVersion?: number;
  },
) {
  if (!context.policy || !context.format || !context.counter) {
    throw new ConvexError(
      "Configure numbering and one active academic session before allocation",
    );
  }
  if (
    (expected.expectedVersion !== undefined &&
      expected.expectedVersion !== (context.policy.version ?? 0)) ||
    (expected.expectedFormatVersion !== undefined &&
      expected.expectedFormatVersion !== context.format.formatVersion) ||
    (expected.expectedCounterKey !== undefined &&
      expected.expectedCounterKey !== context.counter.key) ||
    (expected.expectedCounterVersion !== undefined &&
      expected.expectedCounterVersion !== context.counter.configVersion)
  ) {
    throw new ConvexError(
      "Numbering policy or counter configuration changed; review again",
    );
  }
}

function formatProposal(
  context: Exclude<Awaited<ReturnType<typeof getContext>>, { policy: null }>,
  level?: string,
  sequence = context.sequence,
) {
  if (
    !context.policy ||
    !context.session ||
    !context.format ||
    !context.counter ||
    !context.period ||
    sequence === undefined
  ) {
    throw new ConvexError(
      "Configure numbering and one active academic session before allocation",
    );
  }
  if (context.counter.status !== "active") {
    throw new ConvexError(
      `Admission sequence '${context.counter.name}' is paused`,
    );
  }
  if (context.format.pattern.includes("{LEVEL}") && !level) {
    throw new ConvexError("An explicit enrollment level is required");
  }
  return formatAdmissionNumber(context.format.pattern, {
    school: context.policy.schoolCode,
    campus: context.policy.campusCode,
    level: level ?? "",
    year: new Date(context.session.startDate).getUTCFullYear(),
    seq: sequence,
  });
}

export const getAdmissionNumberPolicy = query({
  args: {
    schoolId: v.id("schools"),
    level: v.optional(v.string()),
    sequenceKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "enrollment.intakes.manage");
    const context = await getContext(ctx, args);
    const school = await ctx.db.get(args.schoolId);
    const [activeSequences, pausedSequences] = await Promise.all([
      ctx.db
        .query("admissionNumberSequences")
        .withIndex("by_school_and_status", (q) =>
          q.eq("schoolId", args.schoolId).eq("status", "active"),
        )
        .take(101),
      ctx.db
        .query("admissionNumberSequences")
        .withIndex("by_school_and_status", (q) =>
          q.eq("schoolId", args.schoolId).eq("status", "paused"),
        )
        .take(101),
    ]);
    const sequences = [...activeSequences, ...pausedSequences];
    if (sequences.length > 100) {
      throw new ConvexError("Admission sequence limit exceeded");
    }
    let preview: string | null = null;
    let unavailableReason: string | null = null;
    if (
      context.policy &&
      context.session &&
      context.counter &&
      context.format
    ) {
      try {
        preview = formatProposal(context, args.level);
      } catch (error) {
        unavailableReason =
          error instanceof Error ? error.message : "Numbering unavailable";
      }
    }
    const legacyPeriod =
      context.policy && context.session
        ? periodFor(
            context.policy.resetFrequency ?? "continuous",
            context.session,
          )
        : null;
    const legacyNextSequence = context.policy
      ? context.policy.resetPeriod !== undefined &&
        context.policy.resetPeriod !== legacyPeriod
        ? 1
        : context.policy.currentSequence
      : 1;
    return {
      policy: context.policy,
      branchCounter: context.policy
        ? {
            key: "default" as const,
            name: "Default branch sequence" as const,
            status: context.policy.counterStatus ?? "active",
            configVersion: context.policy.counterVersion ?? 0,
            nextSequence: legacyNextSequence,
            resetFrequency: context.policy.resetFrequency ?? "continuous",
          }
        : null,
      version: context.policy?.version ?? 0,
      effectiveFormat: context.format?.pattern ?? null,
      formatSource: context.format?.source ?? "branch",
      formatVersion: context.format?.formatVersion ?? null,
      governance: context.format
        ? {
            groupId: context.format.groupId,
            groupSlug: context.format.groupSlug,
            branchSlug: school?.slug ?? null,
            groupVersion: context.format.groupVersion,
            branchRevision: context.format.branchRevision,
            allowBranchOverride: context.format.allowBranchOverride,
            mode: context.format.mode,
          }
        : null,
      counter: context.counter
        ? {
            key: context.counter.key,
            name: context.counter.name,
            level: context.counter.level ?? null,
            status: context.counter.status,
            configVersion: context.counter.configVersion,
          }
        : null,
      sequences: sequences.map((sequence) => ({
        key: sequence.key,
        name: sequence.name,
        level: sequence.level ?? null,
        status: sequence.status,
        currentSequence: sequence.currentSequence,
        resetFrequency: sequence.resetFrequency,
        configVersion: sequence.configVersion,
      })),
      nextSequence: context.sequence ?? null,
      sessionYear: context.session
        ? new Date(context.session.startDate).getUTCFullYear()
        : null,
      preview,
      unavailableReason,
    };
  },
});

export const updateAdmissionNumberPolicy = mutation({
  args: {
    schoolId: v.id("schools"),
    pattern: v.string(),
    schoolCode: v.string(),
    campusCode: v.string(),
    resetFrequency: v.optional(
      v.union(
        v.literal("continuous"),
        v.literal("session"),
        v.literal("calendar"),
      ),
    ),
    counterStatus: v.optional(
      v.union(v.literal("active"), v.literal("paused")),
    ),
    currentSequence: v.optional(v.number()),
    expectedVersion: v.number(),
    expectedCounterVersion: v.optional(v.number()),
    confirmedNextSequence: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(
      ctx,
      args.schoolId,
      "enrollment.intakes.manage",
    );
    validatePattern(args.pattern);
    for (const code of [args.schoolCode, args.campusCode]) {
      if (!/^[A-Za-z0-9_-]{1,24}$/.test(code)) {
        throw new ConvexError(
          "School and branch codes require 1–24 letters, digits, underscores or hyphens",
        );
      }
    }
    const existing = await ctx.db
      .query("admissionNumberPolicies")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();
    const session = await getActiveSession(ctx, args.schoolId);
    if ((existing?.version ?? 0) !== args.expectedVersion) {
      throw new ConvexError("Policy changed; reload and review again");
    }
    if (!session) {
      throw new ConvexError("One active academic session is required");
    }
    const currentFrequency = existing?.resetFrequency ?? "continuous";
    const frequency = args.resetFrequency ?? currentFrequency;
    const currentStatus = existing?.counterStatus ?? "active";
    const status = args.counterStatus ?? currentStatus;
    const currentVersion = existing?.counterVersion ?? 0;
    const existingPeriod = periodFor(currentFrequency, session);
    const currentPeriod = periodFor(frequency, session);
    const effectiveCurrent =
      existing?.resetPeriod !== undefined &&
      existing.resetPeriod !== existingPeriod
        ? 1
        : (existing?.currentSequence ?? 1);
    const next = args.currentSequence ?? effectiveCurrent;
    validateSequence(next);
    if (next !== args.confirmedNextSequence) {
      throw new ConvexError("Confirm the exact next sequence");
    }
    if (next < effectiveCurrent) {
      throw new ConvexError("The next sequence cannot be moved backwards");
    }
    const counterChanged =
      next !== effectiveCurrent ||
      frequency !== currentFrequency ||
      status !== currentStatus;
    if (
      existing &&
      counterChanged &&
      args.expectedCounterVersion !== currentVersion
    ) {
      throw new ConvexError("Counter configuration changed; review again");
    }
    const data = {
      pattern: args.pattern,
      schoolCode: args.schoolCode,
      campusCode: args.campusCode,
      resetFrequency: frequency,
      counterStatus: status,
      currentSequence: next,
      counterVersion: currentVersion + (counterChanged ? 1 : 0),
      version: (existing?.version ?? 0) + 1,
      resetPeriod: currentPeriod,
      updatedAt: Date.now(),
    };
    const id = existing
      ? existing._id
      : await ctx.db.insert("admissionNumberPolicies", {
          schoolId: args.schoolId,
          ...data,
          createdAt: Date.now(),
        });
    if (existing) await ctx.db.patch(id, data);
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "user",
      actorPersonId: actor.personId,
      actorMembershipId: actor.membershipId,
      actorEmailSnapshot: actor.role ?? "staff",
      module: "enrollment",
      action: "admission_policy.update",
      targetType: "admissionNumberPolicies",
      targetId: id,
      outcome: "success",
      safeSummary: `Admission format version ${data.version}; default counter ${data.counterStatus}, configuration ${data.counterVersion}, next ${next}. Historical identifiers unchanged.`,
      alertTier: "tier2_warn",
      retentionClass: "permanent_statutory",
    });
    return id;
  },
});

export const configureAdmissionNumberSequence = mutation({
  args: {
    schoolId: v.id("schools"),
    key: v.string(),
    name: v.string(),
    level: v.optional(v.string()),
    currentSequence: v.number(),
    confirmedNextSequence: v.number(),
    resetFrequency: v.union(
      v.literal("continuous"),
      v.literal("session"),
      v.literal("calendar"),
    ),
    status: v.union(v.literal("active"), v.literal("paused")),
    expectedConfigVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(
      ctx,
      args.schoolId,
      "enrollment.intakes.manage",
    );
    const key = normalizeSequenceKey(args.key);
    if (key === "default") {
      throw new ConvexError(
        "The default key is reserved for the branch counter",
      );
    }
    const name = args.name.trim();
    if (!name || name.length > 80) {
      throw new ConvexError("Sequence name requires 1–80 characters");
    }
    const level = normalizeLevel(args.level);
    const session = await getActiveSession(ctx, args.schoolId);
    if (!session) {
      throw new ConvexError("One active academic session is required");
    }
    const existing = await loadNamedCounter(ctx, args.schoolId, key);
    if (!existing) {
      const [active, paused] = await Promise.all([
        ctx.db
          .query("admissionNumberSequences")
          .withIndex("by_school_and_status", (q) =>
            q.eq("schoolId", args.schoolId).eq("status", "active"),
          )
          .take(101),
        ctx.db
          .query("admissionNumberSequences")
          .withIndex("by_school_and_status", (q) =>
            q.eq("schoolId", args.schoolId).eq("status", "paused"),
          )
          .take(101),
      ]);
      if (active.length + paused.length >= 100) {
        throw new ConvexError("Admission sequence limit reached");
      }
    }
    if ((existing?.configVersion ?? 0) !== args.expectedConfigVersion) {
      throw new ConvexError("Counter configuration changed; review again");
    }
    validateSequence(args.currentSequence);
    if (args.currentSequence !== args.confirmedNextSequence) {
      throw new ConvexError("Confirm the exact next sequence");
    }
    if (level) {
      const sameLevel = await ctx.db
        .query("admissionNumberSequences")
        .withIndex("by_school_and_level", (q) =>
          q.eq("schoolId", args.schoolId).eq("level", level),
        )
        .take(3);
      if (
        sameLevel.some(
          (counter) =>
            counter._id !== existing?._id && counter.status !== "archived",
        )
      ) {
        throw new ConvexError("This level already has a configured counter");
      }
    }
    const period = periodFor(args.resetFrequency, session);
    const existingPeriod = existing
      ? periodFor(existing.resetFrequency, session)
      : period;
    const effectiveCurrent =
      existing?.resetPeriod !== undefined &&
      existing.resetPeriod !== existingPeriod
        ? 1
        : (existing?.currentSequence ?? 1);
    if (args.currentSequence < effectiveCurrent) {
      throw new ConvexError("The next sequence cannot be moved backwards");
    }
    const now = Date.now();
    const configVersion = (existing?.configVersion ?? 0) + 1;
    const data = {
      schoolId: args.schoolId,
      key,
      name,
      level,
      currentSequence: args.currentSequence,
      resetFrequency: args.resetFrequency,
      resetPeriod: period,
      status: args.status,
      configVersion,
      updatedAt: now,
    };
    const id = existing
      ? existing._id
      : await ctx.db.insert("admissionNumberSequences", {
          ...data,
          createdAt: now,
        });
    if (existing) await ctx.db.patch(id, data);
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "user",
      actorPersonId: actor.personId,
      actorMembershipId: actor.membershipId,
      actorEmailSnapshot: actor.role ?? "staff",
      module: "enrollment",
      action: "admission_sequence.configure",
      targetType: "admissionNumberSequences",
      targetId: id,
      outcome: "success",
      safeSummary: `Configured branch sequence '${key}'${level ? ` for level '${level}'` : ""}; status ${args.status}; configuration ${configVersion}; next ${args.currentSequence}.`,
      alertTier: "tier2_warn",
      retentionClass: "permanent_statutory",
    });
    return { id, key, configVersion };
  },
});

export const setDefaultAdmissionNumberSequence = mutation({
  args: {
    schoolId: v.id("schools"),
    key: v.union(v.string(), v.null()),
    expectedPolicyVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(
      ctx,
      args.schoolId,
      "enrollment.intakes.manage",
    );
    const policy = await ctx.db
      .query("admissionNumberPolicies")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();
    if (!policy || (policy.version ?? 0) !== args.expectedPolicyVersion) {
      throw new ConvexError("Policy changed; reload and review again");
    }
    const key = args.key === null ? undefined : normalizeSequenceKey(args.key);
    if (key) {
      const selected = await loadNamedCounter(ctx, args.schoolId, key);
      if (!selected || selected.status === "archived" || selected.level) {
        throw new ConvexError(
          "Default must be an available branch sequence without a level",
        );
      }
    }
    await ctx.db.patch(policy._id, {
      defaultSequenceKey: key,
      version: (policy.version ?? 0) + 1,
      updatedAt: Date.now(),
    });
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "user",
      actorPersonId: actor.personId,
      actorMembershipId: actor.membershipId,
      actorEmailSnapshot: actor.role ?? "staff",
      module: "enrollment",
      action: "admission_sequence.set_default",
      targetType: "admissionNumberPolicies",
      targetId: policy._id,
      outcome: "success",
      safeSummary: `Default branch sequence set to '${key ?? "default"}'. Historical identifiers unchanged.`,
      alertTier: "tier2_warn",
      retentionClass: "permanent_statutory",
    });
    return null;
  },
});

export const archiveAdmissionNumberSequence = mutation({
  args: {
    schoolId: v.id("schools"),
    key: v.string(),
    expectedConfigVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireCapability(
      ctx,
      args.schoolId,
      "enrollment.intakes.manage",
    );
    const key = normalizeSequenceKey(args.key);
    const [policy, sequence] = await Promise.all([
      ctx.db
        .query("admissionNumberPolicies")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
        .unique(),
      loadNamedCounter(ctx, args.schoolId, key),
    ]);
    if (
      !sequence ||
      sequence.status === "archived" ||
      sequence.configVersion !== args.expectedConfigVersion
    ) {
      throw new ConvexError("Counter configuration changed; review again");
    }
    if (policy?.defaultSequenceKey === key) {
      throw new ConvexError("Select another default before archiving");
    }
    await ctx.db.patch(sequence._id, {
      status: "archived",
      configVersion: sequence.configVersion + 1,
      updatedAt: Date.now(),
    });
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "user",
      actorPersonId: actor.personId,
      actorMembershipId: actor.membershipId,
      actorEmailSnapshot: actor.role ?? "staff",
      module: "enrollment",
      action: "admission_sequence.archive",
      targetType: "admissionNumberSequences",
      targetId: sequence._id,
      outcome: "success",
      safeSummary: `Archived branch sequence '${key}'. Assigned identifiers remain permanently claimed.`,
      alertTier: "tier2_warn",
      retentionClass: "permanent_statutory",
    });
    return null;
  },
});

export const publishGroupAdmissionNumberFormat = mutation({
  args: {
    schoolId: v.id("schools"),
    groupId: v.id("schoolGroups"),
    expectedGroupVersion: v.number(),
    allowBranchOverride: v.boolean(),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    const { group, person } = await requireGroupOwner(ctx, args.groupId);
    const auth = await requireCapability(
      ctx,
      args.schoolId,
      "enrollment.intakes.manage",
    );
    if (!auth.membershipId || auth.isPlatformAdmin) {
      throw new ConvexError(
        "Forbidden: explicit source-branch membership required",
      );
    }
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_group_and_school", (q) =>
        q.eq("groupId", args.groupId).eq("schoolId", args.schoolId),
      )
      .unique();
    const policy = await ctx.db
      .query("admissionNumberPolicies")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();
    if (!link || !policy) {
      throw new ConvexError("Configured source branch is required");
    }
    if (
      (group.admissionNumberDefault?.version ?? 0) !== args.expectedGroupVersion
    ) {
      throw new ConvexError("Group format changed; reload and review again");
    }
    if (args.confirmation !== group.slug) {
      throw new ConvexError("Confirm the group slug");
    }
    validatePattern(policy.pattern);
    const version = (group.admissionNumberDefault?.version ?? 0) + 1;
    await ctx.db.patch(group._id, {
      admissionNumberDefault: {
        pattern: policy.pattern,
        allowBranchOverride: args.allowBranchOverride,
        version,
      },
      updatedAt: Date.now(),
    });
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      groupId: group._id,
      actorKind: "user",
      actorPersonId: person._id,
      actorMembershipId: auth.membershipId,
      actorEmailSnapshot: auth.role ?? "group proprietor",
      module: "groups",
      action: "group.admission_number_format",
      targetType: "schoolGroups",
      targetId: group._id,
      outcome: "success",
      safeSummary: `Published admission format version ${version}; branch format overrides ${args.allowBranchOverride ? "allowed" : "disabled"}. Counters remain branch-owned.`,
      alertTier: "tier1_critical",
      retentionClass: "permanent_statutory",
    });
    return version;
  },
});

export const setAdmissionNumberFormatInheritance = mutation({
  args: {
    schoolId: v.id("schools"),
    groupId: v.id("schoolGroups"),
    mode: v.union(v.literal("inherit"), v.literal("override")),
    expectedGroupVersion: v.number(),
    expectedRevision: v.number(),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireCapability(
      ctx,
      args.schoolId,
      "enrollment.intakes.manage",
    );
    if (!auth.membershipId || auth.isPlatformAdmin) {
      throw new ConvexError(
        "Forbidden: explicit canonical branch membership required",
      );
    }
    const [link, group, school] = await Promise.all([
      ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_group_and_school", (q) =>
          q.eq("groupId", args.groupId).eq("schoolId", args.schoolId),
        )
        .unique(),
      ctx.db.get(args.groupId),
      ctx.db.get(args.schoolId),
    ]);
    if (!link || group?.status !== "active" || !group.admissionNumberDefault) {
      throw new ConvexError("Active configured group is required");
    }
    if (
      group.admissionNumberDefault.version !== args.expectedGroupVersion ||
      (link.admissionNumberFormat?.revision ?? 0) !== args.expectedRevision
    ) {
      throw new ConvexError(
        "Group or branch format changed; reload and review again",
      );
    }
    if (!school || args.confirmation !== school.slug) {
      throw new ConvexError("Confirm the branch slug");
    }
    if (
      args.mode === "override" &&
      !group.admissionNumberDefault.allowBranchOverride
    ) {
      throw new ConvexError("Branch format overrides are disabled");
    }
    const revision = args.expectedRevision + 1;
    await ctx.db.patch(link._id, {
      admissionNumberFormat: { mode: args.mode, revision },
    });
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      groupId: args.groupId,
      actorKind: "user",
      actorPersonId: auth.personId,
      actorMembershipId: auth.membershipId,
      actorEmailSnapshot: auth.role ?? "branch manager",
      module: "groups",
      action: "group.admission_number_format_choice",
      targetType: "schoolGroupBranches",
      targetId: link._id,
      outcome: "success",
      safeSummary: `Admission format ${args.mode}; branch revision ${revision}; group version ${args.expectedGroupVersion}. Counters remain branch-owned.`,
      alertTier: "tier1_critical",
      retentionClass: "permanent_statutory",
    });
    return revision;
  },
});

/** Nonmutating proposal; callers authorize their enrollment/import/transfer audience first. */
export async function proposeAdmissionNumberHelper(
  ctx: Context,
  args: {
    schoolId: Id<"schools">;
    level?: string;
    sequenceKey?: string;
  },
) {
  const context = await getContext(ctx, args);
  if (
    !context.policy ||
    !context.session ||
    !context.format ||
    !context.counter ||
    !context.period ||
    context.sequence === undefined
  ) {
    throw new ConvexError(
      "Configure numbering and one active academic session before allocation",
    );
  }
  const allocatedNumber = formatProposal(context, args.level);
  return {
    allocatedNumber,
    sequenceNumber: context.sequence,
    policyVersion: context.policy.version ?? 0,
    formatVersion: context.format.formatVersion,
    counterKey: context.counter.key,
    counterVersion: context.counter.configVersion,
    counterStatus: context.counter.status,
    period: context.period,
    policyId: context.policy._id,
  };
}

/** Read-only preview at a specified sequence for reviewed multi-row import plans. */
export async function proposeAdmissionNumberAtSequenceHelper(
  ctx: Context,
  args: {
    schoolId: Id<"schools">;
    level?: string;
    sequenceKey?: string;
    sequence: number;
    expectedVersion: number;
    expectedFormatVersion?: string;
    expectedCounterKey?: string;
    expectedCounterVersion?: number;
  },
) {
  validateSequence(args.sequence);
  const context = await getContext(ctx, args);
  assertExpected(context, args);
  return formatProposal(context, args.level, args.sequence);
}

/** Commit ONLY inside the successful record-creation transaction. No gapless promise. */
export async function allocateNextAdmissionNumberHelper(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    level?: string;
    sequenceKey?: string;
    year?: number;
    campusCodeOverride?: string;
    schoolCodeOverride?: string;
    expectedVersion?: number;
    expectedFormatVersion?: string;
    expectedCounterKey?: string;
    expectedCounterVersion?: number;
  },
) {
  if (
    args.campusCodeOverride ||
    args.schoolCodeOverride ||
    args.year !== undefined
  ) {
    throw new ConvexError(
      "Allocation uses the reviewed policy and academic session, not caller token overrides",
    );
  }
  const context = await getContext(ctx, args);
  assertExpected(context, args);
  const proposal = await proposeAdmissionNumberHelper(ctx, args);
  await claimAdmissionNumberHelper(
    ctx,
    args.schoolId,
    proposal.allocatedNumber,
  );
  if (!context.counter) throw new ConvexError("Counter unavailable");
  await ctx.db.patch(context.counter.id, {
    currentSequence: proposal.sequenceNumber + 1,
    resetPeriod: proposal.period,
    updatedAt: Date.now(),
  });
  return proposal;
}

export async function claimAdmissionNumberHelper(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  number: string,
) {
  const existing = await ctx.db
    .query("students")
    .withIndex("by_school_and_admission_number", (q) =>
      q.eq("schoolId", schoolId).eq("admissionNumber", number),
    )
    .first();
  const claim = await ctx.db
    .query("admissionNumberClaims")
    .withIndex("by_school_number", (q) =>
      q.eq("schoolId", schoolId).eq("number", number),
    )
    .unique();
  if (existing || claim) {
    throw new ConvexError(
      "Admission number already assigned; review the explicit next sequence. Numbers are never reused.",
    );
  }
  await ctx.db.insert("admissionNumberClaims", {
    schoolId,
    number,
    createdAt: Date.now(),
  });
}

export async function commitManualAdmissionNumberHelper(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    number: string;
    level?: string;
    sequenceKey?: string;
    reason?: string;
    confirmed?: boolean;
    advanceTo?: number;
    expectedVersion?: number;
    expectedFormatVersion?: string;
    expectedCounterKey?: string;
    expectedCounterVersion?: number;
  },
) {
  const actor = await requireCapability(
    ctx,
    args.schoolId,
    "enrollment.admissions.override_number",
  );
  if (
    !args.confirmed ||
    !args.reason ||
    args.reason.trim().length < 8 ||
    args.reason.length > 240
  ) {
    throw new ConvexError(
      "Confirm manual override and provide an 8–240 character reason",
    );
  }
  if (!args.number.trim() || args.number.length > 160) {
    throw new ConvexError("Admission number requires 1–160 characters");
  }
  let context: Awaited<ReturnType<typeof getContext>> | null = null;
  if (args.advanceTo !== undefined) {
    validateSequence(args.advanceTo);
    if (
      args.expectedVersion === undefined ||
      args.expectedFormatVersion === undefined ||
      args.expectedCounterKey === undefined ||
      args.expectedCounterVersion === undefined
    ) {
      throw new ConvexError(
        "Explicit counter advancement requires reviewed format and counter versions",
      );
    }
    context = await getContext(ctx, args);
    assertExpected(context, args);
    if (context.sequence === undefined || args.advanceTo <= context.sequence) {
      throw new ConvexError(
        "Explicit advancement must exceed the current next sequence",
      );
    }
  }
  await claimAdmissionNumberHelper(ctx, args.schoolId, args.number);
  if (args.advanceTo !== undefined && context?.counter && context.period) {
    await ctx.db.patch(context.counter.id, {
      currentSequence: args.advanceTo,
      resetPeriod: context.period,
      updatedAt: Date.now(),
    });
  }
  await recordAuditEventHelper(ctx, {
    schoolId: args.schoolId,
    actorKind: "user",
    actorPersonId: actor.personId,
    actorMembershipId: actor.membershipId,
    actorEmailSnapshot: actor.role ?? "staff",
    module: "enrollment",
    action: "admission_number.override",
    targetType: "admissionNumberClaims",
    targetId: args.number,
    outcome: "success",
    safeSummary: `Manual admission override. Reason: ${args.reason.trim()}. Counter '${context?.counter?.key ?? "unchanged"}': ${args.advanceTo === undefined ? "unchanged" : `explicit next ${args.advanceTo}`}`,
    alertTier: "tier2_warn",
    retentionClass: "permanent_statutory",
  });
}

export const allocateNextAdmissionNumber = internalMutation({
  args: {
    schoolId: v.id("schools"),
    level: v.optional(v.string()),
    sequenceKey: v.optional(v.string()),
    year: v.optional(v.number()),
    campusCodeOverride: v.optional(v.string()),
    schoolCodeOverride: v.optional(v.string()),
  },
  handler: async (ctx, args) => allocateNextAdmissionNumberHelper(ctx, args),
});
