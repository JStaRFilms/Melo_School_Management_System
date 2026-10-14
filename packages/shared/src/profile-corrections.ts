export const PROFILE_CORRECTION_WARNING = "These changes take effect immediately. You cannot edit again until an admin approves a new request.";
export const PARENT_CORRECTION_FIELDS = ["firstName", "middleName", "lastName", "phone", "address"] as const;
export const CHILD_CORRECTION_FIELDS = ["firstName", "middleName", "lastName", "dateOfBirth", "gender", "address"] as const;
export type ParentCorrectionField = typeof PARENT_CORRECTION_FIELDS[number];
export type ChildCorrectionField = typeof CHILD_CORRECTION_FIELDS[number];
const correctionNameFields = ["firstName", "middleName", "lastName"] as const;
export function requiresCorrectionNamePair(user: { firstName?: string | null; lastName?: string | null }) {
  return !user.firstName?.trim() || !user.lastName?.trim();
}
export function hasUsableCorrectionNameScope(fields: readonly string[], requiresPair: boolean) {
  return !requiresPair || !fields.some(f => correctionNameFields.some(k => k === f)) ||
    (fields.includes("firstName") && fields.includes("lastName"));
}
export function toggleCorrectionField<Field extends ParentCorrectionField | ChildCorrectionField>(
  fields: readonly Field[], field: Field, checked: boolean, requiresPair: boolean, availableFields: readonly Field[],
): Field[] {
  if (requiresPair && correctionNameFields.some(k => k === field)) {
    if (!checked && (field === "firstName" || field === "lastName"))
      return fields.filter(f => !correctionNameFields.some(k => k === f));
    if (checked) return [...new Set([...fields, field, ...availableFields.filter(f => f === "firstName" || f === "lastName")])];
  }
  return checked ? [...fields, field] : fields.filter(f => f !== field);
}
export const CORRECTION_FIELD_LABELS = {
  firstName: "First name", middleName: "Middle name", lastName: "Last name", phone: "Phone",
  address: "Personal address", dateOfBirth: "Date of birth", gender: "Gender",
} as const;
