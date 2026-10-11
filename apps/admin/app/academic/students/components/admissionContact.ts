import type { FunctionArgs } from "convex/server";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { normalizeStructuredPersonName } from "@school/shared/name-format";
import type { DraftPayload } from "@school/shared/drafts";

export type AdmissionContact = {
  contactChoice: "none" | "existing" | "new";
  selectedContactId: string;
  parentFirstName: string;
  parentMiddleName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  parentRelationship: string;
  isParentPrimaryContact: boolean;
  confirmPrimaryChange: boolean;
  parentAddressMode: "residential" | "different";
  parentAddressOverride: string;
};

export const emptyAdmissionContact: AdmissionContact = {
  contactChoice: "none", selectedContactId: "", parentFirstName: "", parentMiddleName: "",
  parentLastName: "", parentEmail: "", parentPhone: "", parentRelationship: "",
  isParentPrimaryContact: true, confirmPrimaryChange: false,
  parentAddressMode: "residential", parentAddressOverride: "",
};

export function restoreAdmissionContact(payload: DraftPayload<"family_onboarding"> | DraftPayload<"student_onboarding">): AdmissionContact {
  return {
    ...emptyAdmissionContact,
    contactChoice: payload.contactChoice ?? (payload.parentEmail || payload.parentFirstName ? "new" : "none"),
    selectedContactId: payload.selectedContactId ?? "",
    parentFirstName: payload.parentFirstName, parentMiddleName: payload.parentMiddleName ?? "",
    parentLastName: payload.parentLastName, parentEmail: payload.parentEmail,
    parentPhone: payload.parentPhone, parentRelationship: payload.customRelationship || payload.parentRelationship,
    isParentPrimaryContact: payload.isParentPrimaryContact,
    confirmPrimaryChange: payload.confirmPrimaryChange ?? false,
    parentAddressMode: payload.parentAddressMode === "different" ? "different" : "residential",
    parentAddressOverride: payload.parentAddressOverride ?? "",
  };
}

export function admissionParentGuardian(contact: AdmissionContact): NonNullable<FunctionArgs<typeof api.functions.academic.studentEnrollment.createStudent>["parentGuardian"]> {
  const shared = {
    relationship: contact.parentRelationship.trim() || undefined,
    isPrimaryContact: contact.isParentPrimaryContact,
    confirmPrimaryChange: contact.confirmPrimaryChange,
  };
  if (contact.contactChoice === "none") return { kind: "none" };
  if (contact.contactChoice === "existing") {
    if (!contact.selectedContactId) throw new Error("Choose an existing contact before admission.");
    return { kind: "existing", parentUserId: contact.selectedContactId as Id<"users">, ...shared };
  }
  const name = normalizeStructuredPersonName({ firstName: contact.parentFirstName, middleName: contact.parentMiddleName, lastName: contact.parentLastName });
  if (!name.firstName || !name.lastName || !contact.parentEmail.trim()) throw new Error("New contact first name, last name and email are required.");
  if (contact.parentAddressMode === "different" && !contact.parentAddressOverride.trim()) throw new Error("Enter the contact's different address.");
  return {
    kind: "new", firstName: name.firstName, middleName: name.middleName || undefined,
    lastName: name.lastName, email: contact.parentEmail.trim().toLowerCase(),
    phone: contact.parentPhone.trim() || null, ...shared,
    addressMode: contact.parentAddressMode,
    addressOverride: contact.parentAddressMode === "different" ? contact.parentAddressOverride.trim() : null,
  };
}
