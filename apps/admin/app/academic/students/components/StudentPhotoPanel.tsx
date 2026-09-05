"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Camera, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import { cn } from "@/utils";

import { StudentPhotoCropControls } from "./StudentPhotoCropControls";
import { cropStudentPhotoFile, type StudentPhotoCrop } from "./studentPhotoCrop";
import { getStudentPhotoValidationError, MAX_CROPPED_STUDENT_PHOTO_SIZE_BYTES } from "./studentPhotoValidation";

interface StudentPhotoPanelProps {
  name: string;
  previewUrl: string | null;
  onPhotoChange: (file: File | null) => void;
  onRemovePhoto: () => void;
  helperText?: string;
  resetKey?: string | number | null;
  onProcessingChange?: (isProcessing: boolean) => void;
  onValidationError?: (message: string) => void;
  uploadAvailable?: boolean;
}

const defaultCrop: StudentPhotoCrop = { zoom: 1, x: 50, y: 50 };

export function StudentPhotoPanel({
  name,
  previewUrl,
  onPhotoChange,
  onRemovePhoto,
  helperText = "JPG/PNG up to 5 MB.",
  resetKey,
  onProcessingChange,
  onValidationError,
  uploadAvailable = false,
}: StudentPhotoPanelProps) {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<StudentPhotoCrop>(defaultCrop);
  const [isCropping, setIsCropping] = useState(false);
  const [showCropAdjuster, setShowCropAdjuster] = useState(false);
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
    setShowCropAdjuster(false);
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
          const validationError = getStudentPhotoValidationError(croppedFile, MAX_CROPPED_STUDENT_PHOTO_SIZE_BYTES);
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
    setShowCropAdjuster(false);
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
    setShowCropAdjuster(false);
    onProcessingChangeRef.current?.(false);
    onRemovePhoto();
  };

  const visiblePreviewUrl = sourcePreviewUrl ?? previewUrl;

  return (
    <div className="w-full space-y-2.5">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={!uploadAvailable}
        onChange={handlePhotoInputChange}
        className="hidden"
      />

      {visiblePreviewUrl ? (
        <div className="space-y-2">
          {/* Active Photo Frame */}
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[180px] overflow-hidden rounded-xl border border-slate-200/90 bg-slate-900 shadow-sm ring-1 ring-slate-100">
            <Image
              src={visiblePreviewUrl}
              alt={name}
              fill
              sizes="180px"
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
            {isCropping && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px]">
                <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-900 shadow">
                  Optimizing...
                </span>
              </div>
            )}
          </div>

          {/* Action Button Row */}
          <div className="mx-auto flex max-w-[180px] items-center gap-1.5">
            {sourceFile && (
              <button
                type="button"
                onClick={() => setShowCropAdjuster(!showCropAdjuster)}
                className={cn(
                  "flex flex-1 h-7 items-center justify-center gap-1 rounded-lg border text-[10px] font-bold transition-colors shadow-sm",
                  showCropAdjuster
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                <SlidersHorizontal className="h-3 w-3" />
                <span>{showCropAdjuster ? "Close" : "Crop"}</span>
              </button>
            )}
            {uploadAvailable && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex flex-1 h-7 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Upload className="h-3 w-3 text-slate-400" />
                <span>Change</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleRemovePhoto}
              title="Remove Photo"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0 shadow-sm"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          {/* Collapsible Crop Adjuster */}
          {showCropAdjuster && sourceFile && (
            <div className="mx-auto max-w-[200px]">
              <StudentPhotoCropControls
                crop={crop}
                onCropChange={handleCropChange}
                onReset={() => setCrop(defaultCrop)}
              />
            </div>
          )}
        </div>
      ) : uploadAvailable ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group mx-auto flex aspect-[3/4] w-full max-w-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200/90 bg-slate-50/40 p-4 text-center transition-all hover:border-brand-primary/50 hover:bg-brand-primary/[0.02]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/60 transition-transform group-hover:scale-110">
            <Camera className="h-4 w-4 text-slate-400 group-hover:text-brand-primary transition-colors" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-700 group-hover:text-brand-primary transition-colors font-display">Upload Photo</p>
            <p className="text-[9px] font-medium text-slate-400">{helperText}</p>
          </div>
        </button>
      ) : (
        <div role="note" className="mx-auto w-full max-w-[180px] rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Photo upload unavailable until secure tenant ownership, quota reservation, and abandoned-upload cleanup are supported.
        </div>
      )}
    </div>
  );
}
