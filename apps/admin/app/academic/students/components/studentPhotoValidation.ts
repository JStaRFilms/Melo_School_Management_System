"use client";

export const MAX_STUDENT_PHOTO_SIZE_BYTES = 5_242_880; // 5 MB
export const MAX_CROPPED_STUDENT_PHOTO_SIZE_BYTES = 1_048_576; // 1 MB

export function getStudentPhotoValidationError(
  file: File,
  maxFileSizeBytes = MAX_STUDENT_PHOTO_SIZE_BYTES
) {
  if (!file.type.startsWith("image/")) {
    return "Student photo must be an image file.";
  }

  if (file.size > maxFileSizeBytes) {
    return "Student photo must be 5 MB or smaller.";
  }

  return null;
}
