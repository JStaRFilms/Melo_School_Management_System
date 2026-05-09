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
  const inputRef = useRef<HTMLInputElement | null>(null);
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
    if (inputRef.current) inputRef.current.value = "";
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
            if (inputRef.current) inputRef.current.value = "";
            onPhotoChangeRef.current(null);
            onValidationErrorRef.current?.(validationError);
            return;
          }
          onPhotoChangeRef.current(croppedFile);
        })
        .catch(() => {
          if (!isCurrent) return;
          if (inputRef.current) inputRef.current.value = "";
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
    if (inputRef.current) inputRef.current.value = "";
    setSourceFile(null);
    setCrop(defaultCrop);
    setIsCropping(false);
    onProcessingChangeRef.current?.(false);
    onRemovePhoto();
  };

  const visiblePreviewUrl = sourcePreviewUrl ?? previewUrl;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="shrink-0 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Student Photo
        </p>
        <span className="min-h-3 shrink-0 whitespace-nowrap text-right text-[9px] font-black uppercase tracking-[0.12em] text-indigo-500">
          {isCropping ? "Cropping..." : ""}
        </span>
      </div>
      {visiblePreviewUrl ? (
        <div className="relative mx-auto aspect-[3/4] w-full max-w-56 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <Image
            src={visiblePreviewUrl}
            alt={name}
            fill
            sizes="224px"
            unoptimized
            className="object-cover"
            style={
              sourcePreviewUrl
                ? {
                    objectPosition: `${crop.x}% ${crop.y}%`,
                    transform: `scale(${crop.zoom})`,
                    transformOrigin: `${crop.x}% ${crop.y}%`,
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="mx-auto flex aspect-[3/4] w-full max-w-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
          No Photo
        </div>
      )}
      {sourceFile ? (
        <StudentPhotoCropControls crop={crop} onCropChange={handleCropChange} />
      ) : null}
      <input
        ref={inputRef}
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
