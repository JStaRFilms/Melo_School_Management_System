"use client";

import { getStudentPhotoValidationError } from "./studentPhotoValidation";

export type SaveStudentPhotoArgs = {
  studentId: any;
  bytes: ArrayBuffer;
  photoFileName: string;
  photoContentType: string;
};

export type SaveStudentPhotoAction =
  | ((args: SaveStudentPhotoArgs) => Promise<unknown>)
  | ((args: never) => Promise<unknown>);

export async function uploadStudentPhoto(
  file: File,
  studentId: any,
  saveStudentPhoto: SaveStudentPhotoAction,
): Promise<void> {
  const validationError = getStudentPhotoValidationError(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const bytes = await file.arrayBuffer();
  await (saveStudentPhoto as (args: unknown) => Promise<unknown>)({
    studentId,
    bytes,
    photoFileName: file.name,
    photoContentType: file.type,
  });
}
