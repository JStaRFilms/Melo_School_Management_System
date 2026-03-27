"use client";

export const MAX_STUDENT_PHOTO_SIZE_BYTES = 1_048_576;

export function getStudentPhotoValidationError(
  file: File,
  maxFileSizeBytes = MAX_STUDENT_PHOTO_SIZE_BYTES
) {
  if (!file.type.startsWith("image/")) {
    return "Student photo must be an image file.";
  }

  if (file.size > maxFileSizeBytes) {
    return "Student photo must be 1 MB or smaller.";
  }

  return null;
}
