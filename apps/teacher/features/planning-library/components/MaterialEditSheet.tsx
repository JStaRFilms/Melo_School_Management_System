"use client";

import { useState, useEffect, useRef } from "react";
import { 
  TeacherLibraryMaterial, 
  MaterialDraft, 
  TeacherKnowledgeTopic,
  LevelOption
} from "../types";
import { TeacherSheet } from "@/lib/components/ui/TeacherSheet";
import { Search, CheckCircle2, Plus, Info, Trash2, ExternalLink, Sparkles, Shield, AlertCircle, X } from "lucide-react";
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
        subjectId: material.subjectId ?? "",
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
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (draft) onSave(draft);
  };

  const renderMaterial = displayMaterial;
  const renderDraft = draft;

  return (
    <TeacherSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Material Workbench"
      description="Refine metadata and document intelligence."
    >
      {renderMaterial && renderDraft ? (
        <div className="flex flex-col h-full space-y-8">
          {/* Diagnostic Banner */}
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Processing Node</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">{renderMaterial.processingStatus}</span>
              </div>
              <p className="text-[12px] font-medium text-slate-500 leading-relaxed">
                {renderMaterial.ingestionErrorMessage || "Document has been successfully parsed and contextually indexed."}
              </p>
              {(renderMaterial.processingStatus === "failed" || renderMaterial.processingStatus === "ocr_needed") && (
                <button 
                  onClick={() => onRetry(renderMaterial._id)}
                  className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-950 hover:bg-white hover:shadow-sm px-3 py-2 rounded-lg border border-slate-200 transition-all"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  Retry Extraction
                </button>
              )}
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Asset Title</label>
              <input
                value={renderDraft.title}
                onChange={(e) => setDraft({ ...renderDraft, title: e.target.value })}
                placeholder="Name of this document..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-slate-950 transition-all focus:ring-4 focus:ring-slate-950/5 shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Subject</label>
                <div className="h-12 flex items-center px-4 rounded-xl border border-slate-100 bg-slate-50/50 text-[13px] font-bold text-slate-400">
                  {renderMaterial.subjectName}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Grade Level</label>
                <select
                  value={renderDraft.level}
                  onChange={(e) => setDraft({ ...renderDraft, level: e.target.value })}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-950 outline-none focus:border-slate-950 transition-all focus:ring-4 focus:ring-slate-950/5 shadow-sm"
                >
                  {levelOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Topic Identifier</label>
              <input
                value={renderDraft.topicLabel}
                onChange={(e) => setDraft({ ...renderDraft, topicLabel: e.target.value })}
                placeholder="Tag this for specific curricula..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-slate-950 transition-all focus:ring-4 focus:ring-slate-950/5 shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Abstract</label>
              <textarea
                value={renderDraft.description}
                onChange={(e) => setDraft({ ...renderDraft, description: e.target.value })}
                rows={4}
                placeholder="Brief summary of the document's contents..."
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-[13px] font-medium leading-relaxed text-slate-600 outline-none focus:border-slate-950 resize-none transition-all focus:ring-4 focus:ring-slate-950/5 shadow-sm"
              />
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100">
             <div className="flex items-center gap-2 mb-4">
                <Shield className="h-3.5 w-3.5 text-rose-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Safety & Compliance</h4>
             </div>
             <button 
                onClick={() => { if(window.confirm(`Archive ${renderMaterial.title}?`)) onArchive(renderMaterial._id); }}
                className="flex items-center justify-between w-full px-5 py-4 rounded-2xl border border-rose-100 bg-rose-50/20 text-rose-600 hover:bg-rose-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="h-4 w-4 opacity-70 group-hover:opacity-100" />
                  <span className="text-[11px] font-black uppercase tracking-widest">Archive this record</span>
                </div>
                <X className="h-3.5 w-3.5 opacity-30" />
              </button>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-[-40px] sm:bottom-[-32px] mx-[-24px] mt-10 px-6 py-6 bg-white/95 backdrop-blur-md border-t border-slate-100 flex gap-4 z-20">
            <button 
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 h-12 rounded-xl bg-slate-950 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-950/10 disabled:opacity-50"
            >
              {isSaving ? "Syncing..." : "Apply Changes"}
            </button>
          </div>
        </div>
      ) : null}
    </TeacherSheet>
  );
}
