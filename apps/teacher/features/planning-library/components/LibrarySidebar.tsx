"use client";

import {
  KnowledgeMaterialUploadForm,
  type KnowledgeMaterialUploadInput,
  type KnowledgeMaterialUploadReadiness,
} from "@school/shared";
import { Filter, Plus, Search, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LevelOption, TeacherLibrarySubject } from "../types";

interface LibrarySidebarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  subjectFilter: string;
  onSubjectFilterChange: (value: string) => void;
  levelFilter: string;
  onLevelFilterChange: (value: string) => void;
  subjects: TeacherLibrarySubject[];
  levelOptions: LevelOption[];
  subjectsReady: TeacherLibrarySubject[];
  canUpload: boolean;
  uploadReadiness: KnowledgeMaterialUploadReadiness;
  checkDuplicate: (sha256: string) => Promise<boolean>;
  onUpload: (data: KnowledgeMaterialUploadInput) => Promise<void>;
  isUploading: boolean;
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
  canUpload,
  uploadReadiness,
  checkDuplicate,
  onUpload,
  isUploading,
  isAdmin,
  view = "all",
}: LibrarySidebarProps) {
  const showFilters = view === "all" || view === "filters";
  const showUpload = view === "all" || view === "upload";
  const isEmbedded = view !== "all";

  return (
    <aside
      className={cn(
        "custom-scrollbar flex h-full flex-col overflow-y-auto",
        isEmbedded
          ? "border-none bg-transparent"
          : "border-l border-slate-200/60 bg-slate-50/50",
      )}
    >
      {showFilters ? (
        <div className={cn(isEmbedded ? "" : "p-6")}>
          {!isEmbedded ? (
            <div className="mb-5 flex items-center gap-2.5">
              <div className="rounded-lg bg-slate-950 p-1.5 text-white shadow-sm">
                <Filter className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">
                Library filters
              </h3>
            </div>
          ) : null}

          <div
            className={cn(
              "space-y-4",
              isEmbedded
                ? ""
                : "rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm",
            )}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Filter by title..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 pl-9 pr-4 text-sm font-bold text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Subject</span>
                <select
                  value={subjectFilter}
                  onChange={(event) => onSubjectFilterChange(event.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-2 text-[11px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                >
                  <option value="all">All subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Level</span>
                <select
                  value={levelFilter}
                  onChange={(event) => onLevelFilterChange(event.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-2 text-[11px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                >
                  <option value="all">All levels</option>
                  {levelOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {showUpload ? (
        <div className={cn(isEmbedded ? "" : "p-6", showFilters && !isEmbedded && "pt-0")}>
          {!isEmbedded ? (
            <div className="mb-5 flex items-center gap-2.5">
              <div className="rounded-lg bg-emerald-500 p-1.5 text-white shadow-sm shadow-emerald-500/20">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">
                Add new material
              </h3>
            </div>
          ) : null}

          <div
            className={cn(
              isEmbedded
                ? ""
                : "rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm",
            )}
          >
            <div aria-disabled={!canUpload}>
              <KnowledgeMaterialUploadForm
                subjects={subjectsReady}
                levelOptions={levelOptions}
                isAdmin={isAdmin}
                isUploading={isUploading}
                readiness={uploadReadiness}
                checkDuplicate={checkDuplicate}
                onUpload={onUpload}
              />
            </div>
          </div>

          {!isEmbedded ? (
            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex items-start gap-3 opacity-60">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p className="text-[10px] font-bold uppercase leading-relaxed tracking-widest text-slate-400">
                  Secure storage · School isolation active
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
