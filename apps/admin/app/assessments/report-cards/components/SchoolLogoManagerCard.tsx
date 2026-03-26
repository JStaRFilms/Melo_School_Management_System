"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";

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
          message: "School logo removed from report cards.",
        });
        return;
      }

      if (!logoFile) {
        throw new Error("Choose a logo image before saving.");
      }

      if (!logoFile.type.startsWith("image/")) {
        throw new Error("School logo must be an image file.");
      }

      const uploadUrl =
        (await generateSchoolLogoUploadUrl({} as never)) as string;
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": logoFile.type },
        body: logoFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("School logo upload failed.");
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
        message: "School logo saved for report-card exports.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: getUserFacingErrorMessage(
          error,
          "We couldn't save the school logo right now."
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-700">
          School Logo
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Upload the logo once here and every report card export will pick it
          up automatically.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={schoolName}
            className="h-36 w-full rounded-2xl object-contain"
          />
        ) : (
          <div className="flex h-36 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            No school logo
          </div>
        )}
      </div>

      <input
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setLogoFile(file);
          setClearLogo(false);
          setNotice(null);
        }}
        className="mt-4 block w-full text-xs text-slate-500"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || (!logoFile && !clearLogo)}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save logo"}
        </button>
        <button
          type="button"
          onClick={() => {
            setLogoFile(null);
            setClearLogo(true);
            setNotice(null);
          }}
          disabled={isSaving || (!schoolLogoUrl && !logoFile)}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Remove logo
        </button>
      </div>

      {notice ? (
        <div
          className={`mt-3 rounded-2xl px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}
    </section>
  );
}
