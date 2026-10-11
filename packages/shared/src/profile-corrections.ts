export const PROFILE_CORRECTION_WARNING = "These changes take effect immediately. You cannot edit again until an admin approves a new request.";
export const PARENT_CORRECTION_FIELDS = ["firstName", "middleName", "lastName", "phone", "address"] as const;
export const CHILD_CORRECTION_FIELDS = ["firstName", "middleName", "lastName", "dateOfBirth", "gender", "address"] as const;
export type ParentCorrectionField = typeof PARENT_CORRECTION_FIELDS[number];
export type ChildCorrectionField = typeof CHILD_CORRECTION_FIELDS[number];
export const CORRECTION_FIELD_LABELS = {
  firstName: "First name", middleName: "Middle name", lastName: "Last name", phone: "Phone",
  address: "Personal address", dateOfBirth: "Date of birth", gender: "Gender",
} as const;
