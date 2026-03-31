"use client";

import { Save, RotateCcw, Loader2 } from "lucide-react";
import { useState } from "react";

interface SettingsActionBarProps {
  hasUnsavedChanges: boolean;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export function SettingsActionBar({
  hasUnsavedChanges,
  onSave,
  onDiscard,
}: SettingsActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasUnsavedChanges && !isSaving) return null;

  return (
    <div className="sticky bottom-0 left-0 right-0 p-4 border-t border-slate-200/60 bg-white/80 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300 z-20">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 h-10 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl transition-all shadow-lg shadow-slate-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {isSaving ? "Saving..." : "Commit Changes"}
        </button>
        
        <button
          onClick={onDiscard}
          disabled={isSaving}
          className="h-10 px-4 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 text-xs font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          title="Discard Changes"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
