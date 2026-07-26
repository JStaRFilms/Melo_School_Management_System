import { describe, expect, test } from "vitest";
import { applicationPath, applicationStatusCopy, paymentStatusCopy } from "../lib/journey";

describe("guardian journey safety", () => {
  test("keeps opaque application references in a school-scoped route", () => {
    expect(applicationPath("north-star", "app_opaque value")).toBe("/s/north-star/applications/app_opaque%20value");
  });
  test("never treats checkout or acceptance as admission", () => {
    expect(paymentStatusCopy("checkout_pending")).toContain("does not reserve a school place");
    expect(applicationStatusCopy("accepted")).toContain("acceptance decision");
  });
  test("keeps conversion separate from acceptance", () => {
    expect(applicationStatusCopy("accepted", "running")).toContain("preparing its internal records");
    expect(applicationStatusCopy("accepted", "succeeded")).toContain("internal record setup");
  });
});
