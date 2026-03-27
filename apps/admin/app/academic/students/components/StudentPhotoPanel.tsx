"use client";

interface StudentPhotoPanelProps {
  name: string;
  previewUrl: string | null;
  onPhotoChange: (file: File | null) => void;
  onRemovePhoto: () => void;
}

export function StudentPhotoPanel({
  name,
  previewUrl,
  onPhotoChange,
  onRemovePhoto,
}: StudentPhotoPanelProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        Student Photo
      </p>
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={name}
          className="h-44 w-full rounded-2xl object-cover"
        />
      ) : (
        <div className="flex h-44 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
          No Photo
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={(event) => onPhotoChange(event.target.files?.[0] ?? null)}
        className="block w-full text-xs text-slate-500"
      />
      <button
        type="button"
        onClick={onRemovePhoto}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
      >
        Remove Photo
      </button>
    </div>
  );
}
