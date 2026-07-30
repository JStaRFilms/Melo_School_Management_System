import { describe, expect, test } from "vitest";
import { applicationPath, applicationStatusCopy, fieldIsVisible, formatMinorCurrency, paymentStatusCopy, serializedValue } from "../lib/journey";
import { guardianRegistrationErrorMessage, validateGuardianRegistration } from "../lib/registration";

describe("guardian journey safety", () => {
  test("keeps opaque application references in a school-scoped route", () => {
    expect(applicationPath("north-star", "app_opaque value")).toBe("/s/north-star/applications/app_opaque%20value");
  });
  test("formats server minor units without float-like fee copy", () => {
    expect(formatMinorCurrency(5050, "ngn")).toContain("50.50");
    expect(formatMinorCurrency(0, "USD")).toContain("0.00");
  });
  test("never treats checkout or acceptance as admission", () => {
    expect(paymentStatusCopy("checkout_pending")).toContain("does not reserve a school place");
    expect(applicationStatusCopy("accepted")).toContain("acceptance decision");
  });
  test("shows reversal as a held slot rather than pending or successful payment", () => {
    expect(paymentStatusCopy("refunded")).toContain("no longer available");
    expect(paymentStatusCopy("reversed")).toContain("no longer available");
  });
  test("keeps conversion separate from acceptance", () => {
    expect(applicationStatusCopy("accepted", "running")).toContain("preparing its internal records");
    expect(applicationStatusCopy("accepted", "succeeded")).toContain("internal record setup");
  });
  test("shows a conditional field only when its published bounded rule is met", () => {
    const field = { key: "support-detail", kind: "textarea", requiredMode: "conditional", conditionalRule: '{"fieldKey":"support-needed","equals":"yes"}' };
    expect(fieldIsVisible(field, { "support-needed": "yes" })).toBe(true);
    expect(fieldIsVisible(field, { "support-needed": "no" })).toBe(false);
    expect(fieldIsVisible({ ...field, conditionalRule: "not-json" }, { "support-needed": "yes" })).toBe(false);
  });
  test("serializes typed form values for the server validator", () => {
    expect(serializedValue("checkbox", true)).toEqual({ valueType: "boolean", serializedValue: "true" });
    expect(serializedValue("multi_select", ["a", "b"])).toEqual({ valueType: "multi_select", serializedValue: '["a","b"]' });
    expect(serializedValue("number", "4")).toEqual({ valueType: "number", serializedValue: "4" });
  });
  test("validates a complete guardian registration before calling auth", () => {
    expect(validateGuardianRegistration({ name: "", email: "bad", password: "short", passwordConfirmation: "different" })).toEqual([
      "Enter your full name.",
      "Enter a valid email address.",
      "Use a password with at least 8 characters.",
      "The passwords do not match.",
    ]);
    expect(validateGuardianRegistration({ name: "Demo Guardian", email: "guardian@example.test", password: "StrongPass123!", passwordConfirmation: "StrongPass123!" })).toEqual([]);
  });
  test("turns duplicate-account auth errors into a useful next step", () => {
    expect(guardianRegistrationErrorMessage({ code: "USER_ALREADY_EXISTS", message: "User already exists" })).toContain("Sign in instead");
  });
});
