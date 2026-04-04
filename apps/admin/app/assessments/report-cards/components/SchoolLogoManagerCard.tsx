"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useMutation } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";
import { Upload, Trash2, Save } from "lucide-react";

export function SchoolLogoManagerCard({
  schoolName,
  schoolLogoUrl,
}: {
  schoolName: string;
  schoolLogoUrl: string | null | undefined;
}) {
  const generateSchoolLogoUploadUrl = useMutation(
    "functions/academic/schoolBranding:generateSchoolLogoUploadUrl" as never
  );
  const saveSchoolLogo = useMutation(
    "functions/academic/schoolBranding:saveSchoolLogo" as never
  );
  const removeSchoolLogo = useMutation(
    "functions/academic/schoolBranding:removeSchoolLogo" as never
  );

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [clearLogo, setClearLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    setLogoFile(null);
    setClearLogo(false);
  }, [schoolLogoUrl]);

  const previewUrl = useMemo(() => {
    if (logoFile) {
      return URL.createObjectURL(logoFile);
    }
    if (clearLogo) {
      return null;
    }
    return schoolLogoUrl ?? null;
  }, [clearLogo, logoFile, schoolLogoUrl]);

  useEffect(() => {
    return () => {
      if (logoFile && previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [logoFile, previewUrl]);

  const handleSave = async () => {
    setIsSaving(true);
    setNotice(null);

    try {
      if (clearLogo) {
        await removeSchoolLogo({} as never);
        setNotice({
          tone: "success",
          message: "Logo removed.",
        });
        return;
      }

      if (!logoFile) {
        throw new Error("Choose a logo file.");
      }

      const uploadUrl =
        (await generateSchoolLogoUploadUrl({} as never)) as string;
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": logoFile.type },
        body: logoFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed.");
      }

      const uploadPayload = (await uploadResponse.json()) as {
        storageId: string;
      };

      await saveSchoolLogo({
        logoStorageId: uploadPayload.storageId,
        logoFileName: logoFile.name,
        logoContentType: logoFile.type,
      } as never);

      setNotice({
        tone: "success",
        message: "Logo saved.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Save failed."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-[3/1] bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden group">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={schoolName}
            fill
            unoptimized
            className="object-contain p-4"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-300">
            No Logo Defined
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <label className="h-10 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer active:scale-[0.98]">
           <Upload className="h-3.5 w-3.5" />
           <span>Upload</span>
           <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setLogoFile(file);
              setClearLogo(false);
              setNotice(null);
            }}
          />
        </label>
        
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || (!logoFile && !clearLogo)}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-950 text-white shadow-md hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          <Save className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setLogoFile(null);
            setClearLogo(true);
            setNotice(null);
          }}
          disabled={isSaving || (!schoolLogoUrl && !logoFile)}
          className="w-10 h-10 flex items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {notice && (
        <p className={`text-[10px] font-bold text-center px-1 animate-in fade-in slide-in-from-top-1 ${notice.tone === "success" ? "text-emerald-500" : "text-rose-500"}`}>
          {notice.message}
        </p>
      )}
    </div>
  );
}
