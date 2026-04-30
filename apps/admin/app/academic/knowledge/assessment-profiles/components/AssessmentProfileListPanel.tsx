"use client";

import { Plus, Search, ChevronRight, CheckCircle2, BookOpenText } from "lucide-react";
import { cn } from "@/utils";
import type { Profile } from "../types";

interface AssessmentProfileListPanelProps {
  profiles: Profile[];
  selectedProfileId: string | "new" | null;
  onSelectProfile: (id: string | "new") => void;
  onCreateProfile: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}

export function AssessmentProfileListPanel({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onCreateProfile,
  searchQuery,
  onSearchQueryChange,
}: AssessmentProfileListPanelProps) {
  const filteredProfiles = profiles.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-white/40 backdrop-blur-md">
      <div className="sticky top-0 z-10 space-y-3 px-4 py-5 lg:px-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              Catalog
            </h2>
            <p className="text-lg font-black tracking-tight text-slate-900 leading-none">
              {profiles.length} Profiles
            </p>
          </div>
          <button
            onClick={onCreateProfile}
            className="group flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-xl shadow-slate-950/20 transition-all hover:bg-slate-800 active:scale-95"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search profiles..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-white/50 pl-9 pr-3 text-sm font-medium outline-none transition-all focus:bg-white focus:ring-4 focus:ring-slate-950/5"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-6 lg:px-6 custom-scrollbar">
        {filteredProfiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center">
            <BookOpenText className="h-6 w-6 text-slate-200" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
              No Profiles
            </p>
          </div>
        ) : (
          filteredProfiles.map((profile) => (
            <ProfileListItemCard
              key={profile._id}
              profile={profile}
              isSelected={selectedProfileId === profile._id}
              onSelect={() => onSelectProfile(profile._id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ProfileListItemCard({
  profile,
  isSelected,
  onSelect,
}: {
  profile: Profile;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300",
        isSelected
          ? "border-slate-950 bg-slate-950 text-white shadow-2xl shadow-slate-950/20"
          : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/40"
      )}
    >
      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <h3 className={cn(
              "truncate text-sm font-black uppercase tracking-tight",
              isSelected ? "text-white" : "text-slate-900"
            )}>
              {profile.name}
            </h3>
            <p className={cn(
              "truncate text-[9px] font-bold uppercase tracking-widest",
              isSelected ? "text-white/40" : "text-slate-400"
            )}>
              {profile.questionStyle.replace(/_/g, " ")}
            </p>
          </div>
          <div className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
            isSelected ? "bg-white/10 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600"
          )}>
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5", isSelected ? "text-white" : "text-slate-300")} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[8px] font-black uppercase tracking-widest",
              isSelected ? "text-white/30" : "text-slate-300"
            )}>
              {profile.totalQuestions} Qs
            </span>
            {profile.isDefault && (
              <>
                <div className={cn("h-0.5 w-0.5 rounded-full", isSelected ? "bg-white/20" : "bg-slate-200")} />
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest flex items-center gap-1",
                  isSelected ? "text-emerald-400" : "text-emerald-600"
                )}>
                  Default
                </span>
              </>
            )}
          </div>

          <span className={cn(
            "rounded-lg px-2 py-0.5 text-[8px] font-black uppercase tracking-widest transition-colors",
            profile.isActive
              ? isSelected ? "bg-emerald-400/20 text-emerald-400" : "bg-emerald-50 text-emerald-600"
              : isSelected ? "bg-white/5 text-white/40" : "bg-slate-50 text-slate-400"
          )}>
            {profile.isActive ? "Active" : "Archive"}
          </span>
        </div>
      </div>
    </button>
  );
}
