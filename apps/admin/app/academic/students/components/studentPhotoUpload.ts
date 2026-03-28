"use client";

import { getStudentPhotoValidationError } from "./studentPhotoValidation";

export type UploadedStudentPhoto = {
  storageId: string;
  fileName: string;
  contentType: string;
};

export async function uploadStudentPhoto(
  file: File,
  generateUploadUrl: () => Promise<string>
): Promise<UploadedStudentPhoto> {
  const validationError = getStudentPhotoValidationError(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const uploadUrl = await generateUploadUrl();
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Photo upload failed");
  }

  const uploadPayload = (await uploadResponse.json()) as { storageId?: string };
  if (!uploadPayload.storageId) {
    throw new Error("Photo upload failed");
  }

  return {
    storageId: uploadPayload.storageId,
    fileName: file.name,
    contentType: file.type,
  };
}
