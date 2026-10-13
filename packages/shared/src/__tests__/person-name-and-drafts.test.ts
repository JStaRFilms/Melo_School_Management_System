import { expect, test } from "vitest";
import { normalizeStructuredPersonName, PARENT_GUARDIAN_RELATIONSHIPS } from "../name-format";
import { parseDraftPayload } from "../drafts/registry";

test("normalizes name parts under the approved two-word first-name rule", () => {
  expect(normalizeStructuredPersonName({ firstName: "mary  anne", middleName: "", lastName: "van dyke" })).toEqual({ firstName: "Mary", middleName: "Anne", lastName: "Van Dyke" });
  expect(normalizeStructuredPersonName({ firstName: "Mary Anne", middleName: "Grace", lastName: "van dyke" })).toEqual({ firstName: "Mary Anne", middleName: "Grace", lastName: "Van Dyke" });
  expect(normalizeStructuredPersonName({ firstName: "Mary-Anne", lastName: "Van Dyke" }).middleName).toBeUndefined();
  expect(normalizeStructuredPersonName({ firstName: "Mary Anne Grace", lastName: "Van Dyke" }).firstName).toBe("Mary Anne Grace");
});

test("drafts retain middle names, explicit contact/address choices and actual custom relationships", () => {
  const fields = { contactChoice: "existing", selectedContactId: "parent-id", parentMiddleName: "Helen", parentRelationship: "Foster carer", customRelationship: "Foster carer", emergencyContactMode: "primary", addressMode: "residential", parentAddressMode: "different", parentAddressOverride: "Other road", confirmPrimaryChange: true };
  expect(parseDraftPayload("student_onboarding", { firstName: "Mary", middleName: "Anne", ...fields })).toMatchObject({ middleName: "Anne", ...fields });
  expect(parseDraftPayload("family_onboarding", { studentFirstName: "Mary", studentMiddleName: "Anne", ...fields })).toMatchObject({ studentMiddleName: "Anne", ...fields });
  expect(parseDraftPayload("staff_onboarding", { name: "Grace Helen Jones", firstName: "Grace", middleName: "Helen", lastName: "Jones", email: "staff@school.edu.ng" })).toMatchObject({ middleName: "Helen" });
  expect(() => parseDraftPayload("student_onboarding", { temporaryPassword: "never-save" })).toThrow();
  expect(() => parseDraftPayload("family_onboarding", { photoData: "never-save" })).toThrow();
});

test("old draft payloads remain recoverable and common relationship values are consistent", () => {
  expect(parseDraftPayload("student_onboarding", { firstName: "Mary", parentFirstName: "Grace" })).toMatchObject({ firstName: "Mary", parentFirstName: "Grace" });
  expect(parseDraftPayload("family_onboarding", { studentFirstName: "Mary", parentRelationship: "Custom legacy value" }).parentRelationship).toBe("Custom legacy value");
  expect(PARENT_GUARDIAN_RELATIONSHIPS).toEqual(["Father", "Mother", "Guardian", "Aunt", "Uncle", "Grandfather", "Grandmother", "Sibling"]);
});
