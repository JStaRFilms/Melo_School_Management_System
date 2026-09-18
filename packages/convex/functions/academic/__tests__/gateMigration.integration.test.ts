import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
import { api } from "../../../_generated/api";
import { seedReviewedTenantOperatorWithCapabilities } from "./securityFixtures";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));

function identity(token: string) {
  return { tokenIdentifier: token, subject: token, issuer: "test", authenticatedAt: Date.now() };
}

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "Gate School", slug: "gate-school", status: "active", createdAt: now, updatedAt: now });
    await ctx.db.insert("users", { authId: "p5-legacy-admin", authTokenIdentifier: "test|p5-legacy-admin", schoolId, name: "Legacy Admin", email: "legacy-admin@gate.test", role: "admin", createdAt: now, updatedAt: now });
    await ctx.db.insert("users", { authId: "p5-legacy-teacher", authTokenIdentifier: "test|p5-legacy-teacher", schoolId, name: "Legacy Teacher", email: "legacy-teacher@gate.test", role: "teacher", createdAt: now, updatedAt: now });
    await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|p5-managed-events", ["academic.classes.manage"], { role: "teacher" });
    await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|p5-managed-none", [], { role: "teacher" });
    await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|p5-managed-general", ["settings.general.edit"], { role: "teacher" });
    await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], "test|p5-managed-branding", ["settings.branding.manage"], { role: "teacher" });
    return { schoolId };
  });
  return {
    t,
    schoolId: ids.schoolId,
    legacyAdmin: t.withIdentity(identity("test|p5-legacy-admin")),
    legacyTeacher: t.withIdentity(identity("test|p5-legacy-teacher")),
    managedEvents: t.withIdentity(identity("test|p5-managed-events")),
    managedNone: t.withIdentity(identity("test|p5-managed-none")),
    managedGeneral: t.withIdentity(identity("test|p5-managed-general")),
    managedBranding: t.withIdentity(identity("test|p5-managed-branding")),
  };
}

const eventArgs = { title: "Assembly", startDate: 10, endDate: 20, isAllDay: true };

describe("naive gate removal: events/settings/branding matrix (consolidation P5)", () => {
  it("lets legacy admins through on capability endpoints", async () => {
    const f = await fixture();
    await expect(f.legacyAdmin.mutation(api.functions.academic.events.createEvent, eventArgs)).resolves.toBeDefined();
    await expect(f.legacyAdmin.query(api.functions.academic.events.listEvents, {})).toBeDefined();
  });

  it("denies legacy teachers without capabilities", async () => {
    const f = await fixture();
    await expect(f.legacyTeacher.mutation(api.functions.academic.events.createEvent, eventArgs)).rejects.toThrow(/capability|Forbidden/);
  });

  it("lets managed capability-holders through without the legacy admin flag", async () => {
    const f = await fixture();
    // Role teacher + no isSchoolAdmin: the naive boolean rejected this caller.
    await expect(f.managedEvents.mutation(api.functions.academic.events.createEvent, eventArgs)).resolves.toBeDefined();
  });

  it("denies managed callers without the capability", async () => {
    const f = await fixture();
    await expect(f.managedNone.mutation(api.functions.academic.events.createEvent, eventArgs)).rejects.toThrow(/capability|Forbidden/);
  });

  it("applies ANY semantics to multi-capability endpoints", async () => {
    const f = await fixture();
    // settings.general.edit alone satisfies [general.edit, branding.manage]
    await expect(
      f.managedGeneral.mutation(api.functions.academic.schoolBranding.updateSchoolProfile, { name: "Gate School Renamed" }),
    ).resolves.toBeNull();
    // ...but not the single-capability grading endpoint
    await expect(
      f.managedGeneral.mutation(api.functions.academic.settings.saveSchoolAssessmentSettings, { examInputMode: "raw40" }),
    ).rejects.toThrow(/capability|Forbidden/);
  });

  it("denies suspended workspaces before capability checks", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.schoolId as Id<"schools">, { status: "suspended" }));
    await expect(f.legacyAdmin.mutation(api.functions.academic.events.createEvent, eventArgs)).rejects.toThrow(/suspended/i);
  });

  it("completes logo upload end-to-end for delegated branding managers", async () => {
    const f = await fixture();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    await expect(
      f.managedBranding.action(api.functions.academic.schoolBranding.saveSchoolLogo, {
        bytes: png,
        logoFileName: "crest.png",
        logoContentType: "image/png",
      }),
    ).resolves.toBeNull();
    const school = await f.t.run((ctx) => ctx.db.get(f.schoolId as Id<"schools">));
    expect(school?.logoStorageId).toBeDefined();
  });
});
