"use client";

import { useState, useEffect, useRef } from "react";
import { 
  TeacherLibraryMaterial, 
  MaterialDraft, 
  TeacherKnowledgeTopic,
  LevelOption
} from "../types";
import { TeacherSheet } from "@/lib/components/ui/TeacherSheet";
import { Search, CheckCircle2, Plus, Info, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface MaterialEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  material: TeacherLibraryMaterial | null;
  onSave: (draft: MaterialDraft) => Promise<void>;
  onPublish: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  isSaving: boolean;
  topicCandidates: TeacherKnowledgeTopic[] | undefined;
  levelOptions: LevelOption[];
}

export function MaterialEditSheet({
  isOpen,
  onClose,
  material,
  onSave,
  onPublish,
  onRetry,
  onArchive,
  isSaving,
  topicCandidates,
  levelOptions,
}: MaterialEditSheetProps) {
  const [draft, setDraft] = useState<MaterialDraft | null>(null);
  const [topicSearch, setTopicSearch] = useState("");

  // Keep a stale reference so sheet content persists during close animation
  const staleMaterialRef = useRef<TeacherLibraryMaterial | null>(null);
  if (material) staleMaterialRef.current = material;
  const displayMaterial = material ?? staleMaterialRef.current;

  useEffect(() => {
    if (material && isOpen) {
      setDraft({
        materialId: material._id,
        title: material.title,
        description: material.description ?? "",
        subjectId: material.subjectId,
        level: material.level,
        topicLabel: material.topicLabel,
        topicId: material.topicId ?? "",
      });
      setTopicSearch(material.topicTitle ?? "");
    }
  }, [material, isOpen]);

  // Clear stale data after close animation completes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        staleMaterialRef.current = null;
        setDraft(null);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (draft) onSave(draft);
  };

  // Use displayMaterial for rendering so content stays visible during exit
  const renderMaterial = displayMaterial;
  const renderDraft = draft;

  return (
    <TeacherSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Source Material Details"
      description="Refine metadata and context for this library entry."
    >
      {renderMaterial && renderDraft ? (
        <div className="flex flex-col h-full">
          <div className="flex-1 space-y-6">
            {/* Header Info */}
            <div className="rounded-xl bg-slate-50/50 border border-slate-100 p-4">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processing Status</span>
                 <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{renderMaterial.processingStatus}</span>
               </div>
               <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                 {renderMaterial.ingestionErrorMessage || "Material processed and indexed for planning context."}
               </p>
               {renderMaterial.processingStatus === "failed" && (
                  <button 
                    onClick={() => onRetry(renderMaterial._id)}
                    className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-950 hover:underline"
                  >
                    Retry Extraction
                  </button>
               )}
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Document Title</label>
                <input
                  value={renderDraft.title}
                  onChange={(e) => setDraft({ ...renderDraft, title: e.target.value })}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-slate-950 transition-all focus:ring-2 focus:ring-slate-950/5"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Context (Subject & Level)</label>
                <div className="grid grid-cols-2 gap-3">
                   <div className="h-11 flex items-center px-4 rounded-xl border border-slate-100 bg-slate-50/50 text-sm font-bold text-slate-400">
                     {renderMaterial.subjectName}
                   </div>
                   <select
                     value={renderDraft.level}
                     onChange={(e) => setDraft({ ...renderDraft, level: e.target.value })}
                     className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-slate-950 transition-all focus:ring-2 focus:ring-slate-950/5"
                   >
                     {levelOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                   </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Topic Label</label>
                <input
                  value={renderDraft.topicLabel}
                  onChange={(e) => setDraft({ ...renderDraft, topicLabel: e.target.value })}
                  placeholder="How this appears in topic lists..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-slate-950 transition-all focus:ring-2 focus:ring-slate-950/5"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Description</label>
                <textarea
                  value={renderDraft.description}
                  onChange={(e) => setDraft({ ...renderDraft, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-600 outline-none focus:border-slate-950 resize-none transition-all focus:ring-2 focus:ring-slate-950/5"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
               <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Dangerous Actions</h4>
               <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => { if(window.confirm("Archive this material?")) onArchive(renderMaterial._id); }}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-rose-100 bg-rose-50/30 text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Archive Material</span>
                  </button>
               </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-[-40px] sm:bottom-[-32px] mx-[-24px] mt-8 px-6 py-5 bg-white/90 backdrop-blur-md border-t border-slate-100 flex gap-3 z-20">
            <button 
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 h-11 rounded-xl bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-950/10 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : null}
    </TeacherSheet>
  );
}
