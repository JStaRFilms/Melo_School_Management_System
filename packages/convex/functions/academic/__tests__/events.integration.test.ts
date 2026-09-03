import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../../../**/*.ts")).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);

const adminIdentity = {
  subject: "events-regression-admin",
  tokenIdentifier: "https://auth.school.test|events-regression-admin",
};

describe("school events registered functions", () => {
  it("returns ongoing and future events from the inclusive timestamp while preserving the full calendar", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", {
        name: "Events School",
        slug: "events-timestamp-filter",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const adminId = await ctx.db.insert("users", {
        schoolId,
        authId: adminIdentity.subject,
        authTokenIdentifier: adminIdentity.tokenIdentifier,
        name: "Events Admin",
        email: "admin@events.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      const insertEvent = async (title: string, startDate: number, endDate: number, isArchived = false) =>
        await ctx.db.insert("schoolEvents", {
          schoolId,
          title,
          startDate,
          endDate,
          isAllDay: true,
          isArchived,
          createdAt: now,
          updatedAt: now,
          updatedBy: adminId,
        });

      await insertEvent("Past event", 10, 99);
      await insertEvent("Boundary event", 20, 100);
      await insertEvent("Ongoing event", 90, 101);
      await insertEvent("Future event", 110, 120);
      await insertEvent("Archived future event", 130, 140, true);

      const otherSchoolId = await ctx.db.insert("schools", {
        name: "Other Events School",
        slug: "other-events-timestamp-filter",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const otherIdentity = {
        subject: "events-regression-other-admin",
        tokenIdentifier: "https://auth.school.test|events-regression-other-admin",
      };
      const otherAdminId = await ctx.db.insert("users", {
        schoolId: otherSchoolId,
        authId: otherIdentity.subject,
        authTokenIdentifier: otherIdentity.tokenIdentifier,
        name: "Other Events Admin",
        email: "admin@other-events.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("schoolEvents", {
        schoolId: otherSchoolId,
        title: "Other school event",
        startDate: 1,
        endDate: 200,
        isAllDay: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        updatedBy: otherAdminId,
      });

      return { otherIdentity };
    });

    const fullCalendar = await t.withIdentity(adminIdentity).query(api.functions.academic.events.listEvents, {});
    expect(fullCalendar.map((event) => event.title)).toEqual([
      "Past event",
      "Boundary event",
      "Ongoing event",
      "Future event",
    ]);

    const upcoming = await t.withIdentity(adminIdentity).query(api.functions.academic.events.listEvents, {
      fromTimestamp: 100,
    });
    expect(upcoming.map((event) => event.title)).toEqual([
      "Boundary event",
      "Ongoing event",
      "Future event",
    ]);

    const otherCalendar = await t.withIdentity(ids.otherIdentity).query(api.functions.academic.events.listEvents, {});
    expect(otherCalendar.map((event) => event.title)).toEqual(["Other school event"]);
  });
});
