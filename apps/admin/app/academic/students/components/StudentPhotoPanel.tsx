"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { StudentPhotoCropControls } from "./StudentPhotoCropControls";
import { cropStudentPhotoFile, type StudentPhotoCrop } from "./studentPhotoCrop";
import { getStudentPhotoValidationError } from "./studentPhotoValidation";

interface StudentPhotoPanelProps {
  name: string;
  previewUrl: string | null;
  onPhotoChange: (file: File | null) => void;
  onRemovePhoto: () => void;
  helperText?: string;
  resetKey?: string | number | null;
  onProcessingChange?: (isProcessing: boolean) => void;
  onValidationError?: (message: string) => void;
}

const defaultCrop: StudentPhotoCrop = { zoom: 1, x: 50, y: 50 };

export function StudentPhotoPanel({
  name,
  previewUrl,
  onPhotoChange,
  onRemovePhoto,
  helperText = "JPG/PNG up to 1 MB.",
  resetKey,
  onProcessingChange,
  onValidationError,
}: StudentPhotoPanelProps) {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<StudentPhotoCrop>(defaultCrop);
  const [isCropping, setIsCropping] = useState(false);
  const onPhotoChangeRef = useRef(onPhotoChange);
  const onValidationErrorRef = useRef(onValidationError);
  const onProcessingChangeRef = useRef(onProcessingChange);

  useEffect(() => {
    onPhotoChangeRef.current = onPhotoChange;
    onValidationErrorRef.current = onValidationError;
    onProcessingChangeRef.current = onProcessingChange;
  }, [onPhotoChange, onProcessingChange, onValidationError]);

  useEffect(() => {
    setSourceFile(null);
    setCrop(defaultCrop);
    setIsCropping(false);
    onProcessingChangeRef.current?.(false);
  }, [resetKey]);

  const sourcePreviewUrl = useMemo(() => {
    if (!sourceFile) return null;
    return URL.createObjectURL(sourceFile);
  }, [sourceFile]);

  useEffect(() => {
    return () => {
      if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    };
  }, [sourcePreviewUrl]);

  useEffect(() => {
    if (!sourceFile) {
      onProcessingChangeRef.current?.(false);
      return;
    }

    let isCurrent = true;
    setIsCropping(true);
    onProcessingChangeRef.current?.(true);
    const timeoutId = window.setTimeout(() => {
      cropStudentPhotoFile(sourceFile, crop)
        .then((croppedFile) => {
          if (!isCurrent) return;
          const validationError = getStudentPhotoValidationError(croppedFile);
          if (validationError) {
            onPhotoChangeRef.current(null);
            onValidationErrorRef.current?.(validationError);
            return;
          }
          onPhotoChangeRef.current(croppedFile);
        })
        .catch(() => {
          if (!isCurrent) return;
          onPhotoChangeRef.current(null);
          onValidationErrorRef.current?.("Photo crop failed.");
        })
        .finally(() => {
          if (!isCurrent) return;
          setIsCropping(false);
          onProcessingChangeRef.current?.(false);
        });
    }, 180);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
      onProcessingChangeRef.current?.(false);
    };
  }, [crop, sourceFile]);

  const handlePhotoInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSourceFile(null);
      onPhotoChange(null);
      return;
    }

    const validationError = getStudentPhotoValidationError(file);
    if (validationError) {
      event.target.value = "";
      onValidationError?.(validationError);
      return;
    }

    setCrop(defaultCrop);
    setIsCropping(true);
    onProcessingChangeRef.current?.(true);
    onPhotoChange(null);
    setSourceFile(file);
  };

  const handleCropChange = (nextCrop: StudentPhotoCrop) => {
    setIsCropping(true);
    onProcessingChangeRef.current?.(true);
    setCrop(nextCrop);
  };

  const handleRemovePhoto = () => {
    setSourceFile(null);
    setCrop(defaultCrop);
    onProcessingChangeRef.current?.(false);
    onRemovePhoto();
  };

  const visiblePreviewUrl = sourcePreviewUrl ?? previewUrl;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Student Photo
        </p>
        {isCropping ? (
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-indigo-500">
            Cropping...
          </span>
        ) : null}
      </div>
      {visiblePreviewUrl ? (
        <Image
          src={visiblePreviewUrl}
          alt={name}
          width={600}
          height={800}
          unoptimized
          className="h-44 w-full rounded-2xl object-cover"
          style={
            sourcePreviewUrl
              ? {
                  objectPosition: `${crop.x}% ${crop.y}%`,
                  transform: `scale(${crop.zoom})`,
                }
              : undefined
          }
        />
      ) : (
        <div className="flex h-44 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
          No Photo
        </div>
      )}
      {sourceFile ? (
        <StudentPhotoCropControls crop={crop} onCropChange={handleCropChange} />
      ) : null}
      <input
        type="file"
        accept="image/*"
        onChange={handlePhotoInputChange}
        className="block w-full text-xs text-slate-500"
      />
      <p className="text-xs text-slate-500">{helperText}</p>
      <button
        type="button"
        onClick={handleRemovePhoto}
        disabled={!previewUrl && !sourceFile}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Remove Photo
      </button>
    </div>
  );
}
