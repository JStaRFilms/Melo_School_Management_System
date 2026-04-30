"use client";

import { Search, Upload, X, Filter, Info, FileUp, Sparkles, CheckCircle2, Shield, Plus } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { 
  TeacherLibrarySubject, 
  LevelOption, 
  UploadIntent, 
  UploadNotice 
} from "../types";
import { 
  uploadIntentLabel, 
  MAX_UPLOAD_BYTES, 
  inferUploadContentType, 
  isSupportedUploadContentType,
  normalizeFileTitle
} from "../constants";
import { cn } from "@/lib/utils";

interface LibrarySidebarProps {
  // Search & Filter Props
  searchQuery: string;
  onSearchChange: (val: string) => void;
  subjectFilter: string;
  onSubjectFilterChange: (val: string) => void;
  levelFilter: string;
  onLevelFilterChange: (val: string) => void;
  subjects: TeacherLibrarySubject[];
  levelOptions: LevelOption[];
  
  // Upload Props
  subjectsReady: TeacherLibrarySubject[];
  onUpload: (data: {
    file: File;
    title: string;
    description: string;
    subjectId: string;
    level: string;
    topicLabel: string;
    isCurriculumReference: boolean;
    uploadIntent: UploadIntent;
  }) => Promise<void>;
  isUploading: boolean;
  notice: UploadNotice | null;
  onClearNotice: () => void;
  
  // Layout Props
  isAdmin: boolean;
  view?: "all" | "filters" | "upload";
}

export function LibrarySidebar({
  searchQuery,
  onSearchChange,
  subjectFilter,
  onSubjectFilterChange,
  levelFilter,
  onLevelFilterChange,
  subjects,
  levelOptions,
  subjectsReady,
  onUpload,
  isUploading,
  notice,
  onClearNotice,
  isAdmin,
  view = "all",
}: LibrarySidebarProps) {
  // Upload State
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadSubjectId, setUploadSubjectId] = useState("");
  const [uploadLevel, setUploadLevel] = useState("");
  const [uploadTopicLabel, setUploadTopicLabel] = useState("");
  const [isCurriculumReference, setIsCurriculumReference] = useState(false);
  const [uploadIntent, setUploadIntent] = useState<UploadIntent>("private_draft");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setUploadFile(file);
    if (file && !uploadTitle) {
      setUploadTitle(normalizeFileTitle(file.name));
    }
    onClearNotice();
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    
    await onUpload({
      file: uploadFile,
      title: uploadTitle,
      description: uploadDescription,
      subjectId: uploadSubjectId,
      level: uploadLevel,
      topicLabel: uploadTopicLabel,
      isCurriculumReference,
      uploadIntent,
    });
  };

  const showFilters = view === "all" || view === "filters";
  const showUpload = view === "all" || view === "upload";

  const isEmbedded = view !== "all";

  return (
    <aside className={cn(
      "flex flex-col h-full overflow-y-auto custom-scrollbar",
      isEmbedded ? "bg-transparent border-none" : "bg-slate-50/50 border-l border-slate-200/60"
    )}>
      {/* Search & Filters Section */}
      {showFilters && (
        <div className={cn(isEmbedded ? "" : "p-6")}>
          {!isEmbedded && (
            <div className="flex items-center gap-2.5 mb-5">
              <div className="rounded-lg bg-slate-950 p-1.5 text-white shadow-sm">
                <Filter className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Library Filters</h3>
            </div>
          )}
          
          <div className={cn(
            "space-y-4",
            isEmbedded ? "" : "rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
          )}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Filter by title..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-9 pr-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Subject</label>
                <select
                  value={subjectFilter}
                  onChange={(e) => onSubjectFilterChange(e.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-2 text-[11px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Level</label>
                <select
                  value={levelFilter}
                  onChange={(e) => onLevelFilterChange(e.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-2 text-[11px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                >
                  <option value="all">All Levels</option>
                  {levelOptions.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      {showUpload && (
        <div className={cn(isEmbedded ? "" : "p-6", showFilters && !isEmbedded && "pt-0")}>
          {!isEmbedded && (
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-emerald-500 p-1.5 text-white shadow-sm shadow-emerald-500/20">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Add New Material</h3>
              </div>
            </div>
          )}

          <div className={cn(
            isEmbedded ? "" : "rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
          )}>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Dropzone / Button */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all cursor-pointer",
                  uploadFile ? "border-emerald-200 bg-emerald-50/30" : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.txt,.md"
                />
                {uploadFile ? (
                  <>
                    <div className="mb-2 rounded-full bg-emerald-500 p-2 text-white shadow-sm ring-4 ring-emerald-50">
                       <FileUp className="h-4 w-4" />
                    </div>
                    <p className="text-[11px] font-bold text-emerald-600 truncate max-w-full px-4">{uploadFile.name}</p>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                      className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500"
                    >
                      Change File
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-2 rounded-full bg-white p-2 text-slate-300 shadow-sm ring-1 ring-slate-950/5 group-hover:text-slate-400">
                      <Upload className="h-4 w-4" />
                    </div>
                    <p className="text-[11px] font-bold text-slate-400">Choose PDF or Text file</p>
                    <p className="mt-1 text-[9px] font-medium text-slate-300">Max 12MB</p>
                  </>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Title</label>
                  <input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Newton's Laws"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Subject</label>
                    <select
                      value={uploadSubjectId}
                      onChange={(e) => setUploadSubjectId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-2 text-[11px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                    >
                      <option value="">Select...</option>
                      {subjectsReady.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Level</label>
                    <select
                      value={uploadLevel}
                      onChange={(e) => setUploadLevel(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-2 text-[11px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                    >
                      <option value="">Select...</option>
                      {levelOptions.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Upload As</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUploadIntent("private_draft")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all",
                        uploadIntent === "private_draft" ? "border-slate-950 bg-slate-950 text-white shadow-md shadow-slate-950/10" : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Private</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadIntent("request_review")}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all",
                        uploadIntent === "request_review" ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/10" : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Review</span>
                    </button>
                  </div>
                </div>
              </div>

              {notice && (
                <div className={cn(
                  "rounded-xl border p-3 text-[11px] font-bold leading-tight",
                  notice.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"
                )}>
                  {notice.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading || !uploadFile}
                className={cn(
                  "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all",
                  isUploading || !uploadFile ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-950 text-white hover:bg-slate-800 shadow-lg shadow-slate-950/10"
                )}
              >
                {isUploading ? "Uploading..." : "Publish Material"}
              </button>
            </form>
          </div>

          {!isEmbedded && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-start gap-3 opacity-60">
                 <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                 <p className="text-[10px] font-medium leading-relaxed text-slate-400">
                   Materials are private by default. Request review to share with other teachers.
                 </p>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
