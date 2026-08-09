import { describe, expect, test } from "vitest";
import { applicationPath, documentViewPath, applicationStatusCopy, correctionStepHasEditableItems, fieldIsVisible, formatMinorCurrency, paymentReturnReference, paymentStatusCopy, serializedValue } from "../lib/journey";
import { guardianRegistrationErrorMessage, validateGuardianRegistration } from "../lib/registration";

describe("guardian journey safety", () => {
  test("keeps opaque application references in a school-scoped route", () => {
    expect(applicationPath("north-star", "app_opaque value")).toBe("/s/north-star/applications/app_opaque%20value");
  });
  test("keeps private document navigation on an encoded application-owned route", () => {
    expect(documentViewPath("north star", "app/ref", "doc value")).toBe("/s/north%20star/applications/app%2Fref/documents/doc%20value/view");
  });
  test("normalizes Paystack callback references even when the provider appends duplicates", () => {
    expect(paymentReturnReference({ reference: ["adm_first", "adm_duplicate"], trxref: "adm_first" })).toBe("adm_first");
    expect(paymentReturnReference({ trxref: "adm_fallback" })).toBe("adm_fallback");
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
  test("uses truthful guardian-facing copy for read-only application states", () => {
    expect(applicationStatusCopy("submitted")).toContain("We received your application");
    expect(applicationStatusCopy("submitted")).toContain("do not confirm admission");
    expect(applicationStatusCopy("under_review")).toContain("reviewing your application");
    expect(applicationStatusCopy("waitlisted")).toContain("waitlist decision");
    expect(applicationStatusCopy("rejected")).toBe("The school recorded a decision.");
    expect(applicationStatusCopy("withdrawn")).toContain("cannot be submitted again");
  });
  test("shows a conditional field only when its published bounded rule is met", () => {
    const field = { key: "support-detail", kind: "textarea", requiredMode: "conditional", conditionalRule: '{"fieldKey":"support-needed","equals":"yes"}' };
    expect(fieldIsVisible(field, { "support-needed": "yes" })).toBe(true);
    expect(fieldIsVisible(field, { "support-needed": "no" })).toBe(false);
    expect(fieldIsVisible({ ...field, conditionalRule: "not-json" }, { "support-needed": "yes" })).toBe(false);
  });
  test("marks only requested correction steps as editable while keeping review available", () => {
    const base = { state: "changes_requested", coreKeys: ["firstName"], fieldKeys: ["support-needed"], requirementKeys: [], fields: [{ key: "support-needed", sectionKey: "support" }] };
    expect(correctionStepHasEditableItems({ ...base, section: "child" })).toBe(true);
    expect(correctionStepHasEditableItems({ ...base, section: "contacts" })).toBe(false);
    expect(correctionStepHasEditableItems({ ...base, section: "documents" })).toBe(false);
    expect(correctionStepHasEditableItems({ ...base, section: "support" })).toBe(true);
    expect(correctionStepHasEditableItems({ ...base, section: "review" })).toBe(true);
    expect(correctionStepHasEditableItems({ ...base, state: "draft", section: "contacts" })).toBe(true);
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
