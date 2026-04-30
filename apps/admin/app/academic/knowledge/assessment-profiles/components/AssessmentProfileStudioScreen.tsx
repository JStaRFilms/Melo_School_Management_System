"use client";

import { BookOpenText, ShieldCheck, Layers3, Sparkles, Hash, LayoutGrid } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/utils";

import type { AssessmentProfileDraft, Profile } from "../types";
import { 
  createAssessmentProfileDraft, 
  createEmptyAssessmentProfileDraft, 
  serializeAssessmentProfileDraft 
} from "../utils";

import { AssessmentProfileListPanel } from "./AssessmentProfileListPanel";
import { AssessmentProfileEditor } from "./AssessmentProfileEditor";
import { AssessmentProfileActionBar } from "./AssessmentProfileActionBar";

interface AssessmentProfileStudioScreenProps {
  profiles: Profile[];
  onSaveProfile: (draft: AssessmentProfileDraft) => Promise<void>;
}

export function AssessmentProfileStudioScreen({
  profiles,
  onSaveProfile,
}: AssessmentProfileStudioScreenProps) {
  const isMobile = useIsMobile(1024);
  const [selectedProfileId, setSelectedProfileId] = useState<string | "new" | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [draft, setDraft] = useState<AssessmentProfileDraft>(createEmptyAssessmentProfileDraft());
  const [searchQuery, setSearchQuery] = useState("");

  const selectedProfile = useMemo(() => {
    if (!selectedProfileId || selectedProfileId === "new") return null;
    return profiles.find((p) => p._id === selectedProfileId) ?? null;
  }, [selectedProfileId, profiles]);

  const activeDraftSource = useMemo(() => {
    if (!selectedProfile) return createEmptyAssessmentProfileDraft();
    return createAssessmentProfileDraft(selectedProfile);
  }, [selectedProfile]);

  const dirty = useMemo(
    () => serializeAssessmentProfileDraft(draft) !== serializeAssessmentProfileDraft(activeDraftSource),
    [activeDraftSource, draft]
  );

  useEffect(() => {
    if (selectedProfileId === null && profiles.length > 0 && !isMobile) {
      setSelectedProfileId(profiles[0]._id);
    }
  }, [profiles, selectedProfileId, isMobile]);

  useEffect(() => {
    if (selectedProfileId === "new") {
      setDraft(createEmptyAssessmentProfileDraft());
      if (isMobile) setIsSheetOpen(true);
    } else if (selectedProfile) {
      setDraft(createAssessmentProfileDraft(selectedProfile));
      if (isMobile) setIsSheetOpen(true);
    }
  }, [selectedProfile, selectedProfileId, isMobile]);

  const handleSelectProfile = useCallback((id: string | "new") => {
    setSelectedProfileId(id);
  }, []);

  const handleCreateProfile = useCallback(() => {
    setSelectedProfileId("new");
    setDraft(createEmptyAssessmentProfileDraft());
  }, []);

  const updateDraft = useCallback((patch: Partial<AssessmentProfileDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const handleSave = useCallback(async () => {
    await onSaveProfile(draft);
    if (isMobile) setIsSheetOpen(false);
  }, [draft, onSaveProfile, isMobile]);

  const handleDiscard = useCallback(() => {
    setDraft(activeDraftSource);
    if (isMobile) setIsSheetOpen(false);
  }, [activeDraftSource, isMobile]);

  const summary = useMemo(() => {
    return {
      total: profiles.length,
      active: profiles.filter((p) => p.isActive).length,
      defaultCount: profiles.filter((p) => p.isDefault).length,
      inactive: profiles.filter((p) => !p.isActive).length,
    };
  }, [profiles]);

  const closeSheet = () => {
    setIsSheetOpen(false);
    setSelectedProfileId(null);
  };

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-slate-50/30">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.1); }
      `}</style>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Catalog Sidebar */}
        <aside className="w-full lg:w-[400px] shrink-0 lg:border-r border-slate-200/40 bg-white/40 backdrop-blur-3xl lg:h-full lg:overflow-y-auto custom-scrollbar order-1">
          {isMobile && (
             <div className="px-6 pt-10 pb-4 space-y-8 animate-in fade-in slide-in-from-top-4 duration-1000">
                <div className="flex flex-col gap-0.5">
                  <h1 className="text-sm font-black uppercase tracking-tight text-slate-950">Assessment Profiles</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Control Intelligence Hub</p>
                </div>
                
                <StatGroup
                  stats={[
                    { label: "Active", value: summary.active, icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> },
                    { label: "Standard", value: summary.defaultCount, icon: <Layers3 className="h-3.5 w-3.5 text-blue-500" /> },
                    { label: "Total", value: summary.total, icon: <Hash className="h-3.5 w-3.5 text-slate-400" /> },
                  ]}
                  variant="grid"
                />
             </div>
          )}
          <AssessmentProfileListPanel
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            onSelectProfile={handleSelectProfile}
            onCreateProfile={handleCreateProfile}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
        </aside>

        {/* Desktop Workspace */}
        {!isMobile && (
          <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto custom-scrollbar p-10 xl:p-14 order-2">
            <div className="mx-auto max-w-[1200px] space-y-12 pb-40">
              <AdminHeader
                label="Infrastructure"
                title="Profile Designer"
                description="Engineered defaults for school-wide assessment generation. Fine-tune question distribution and AI behaviors."
                actions={
                  <StatGroup
                    stats={[
                      { label: "Live Nodes", value: summary.active, icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> },
                      { label: "Default Profile", value: summary.defaultCount, icon: <Layers3 className="h-3.5 w-3.5 text-blue-500" /> },
                      { label: "Archived", value: summary.inactive, icon: <Sparkles className="h-3.5 w-3.5 text-amber-500" /> },
                    ]}
                    variant="wrap"
                  />
                }
              />

              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                   <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-950/10">
                      <LayoutGrid className="h-4 w-4" />
                   </div>
                   <div className="space-y-0.5">
                      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Workspace</h2>
                      <p className="text-sm font-black text-slate-950 tracking-tight">{selectedProfile ? selectedProfile.name : "System: New Configuration"}</p>
                   </div>
                </div>
                <div className="h-[1px] flex-1 bg-slate-200/50" />
              </div>

              <AssessmentProfileEditor
                draft={draft}
                onChange={updateDraft}
              />
            </div>
          </main>
        )}
      </div>

      {/* Mobile Editor Sheet */}
      {isMobile && (
        <AdminSheet
          isOpen={isSheetOpen}
          onClose={closeSheet}
          title={selectedProfileId === "new" ? "New Profile" : "Profile Settings"}
          description={selectedProfileId === "new" ? "Define system parameters" : `Modifying: ${draft.name}`}
        >
          <div className="pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <AssessmentProfileEditor
              draft={draft}
              onChange={updateDraft}
            />
          </div>
          
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-2xl border-t border-slate-100/50 flex gap-4 z-[110] shadow-[0_-20px_40px_rgba(0,0,0,0.03)]">
             <button 
               onClick={handleDiscard}
               className="flex-1 h-14 rounded-2xl bg-slate-50 text-slate-400 text-xs font-black uppercase tracking-widest hover:bg-slate-100 hover:text-slate-950 transition-all active:scale-95 border border-slate-100"
             >
               Discard
             </button>
             <button 
               onClick={handleSave}
               disabled={!dirty || !draft.name}
               className={cn(
                 "flex-[2] h-14 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-2xl active:scale-[0.98]",
                 dirty && draft.name 
                  ? "bg-slate-950 text-white shadow-slate-950/20" 
                  : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
               )}
             >
               {selectedProfileId === "new" ? "Initialize Node" : "Sync Profile"}
             </button>
          </div>
        </AdminSheet>
      )}

      {/* Desktop Action Bar */}
      {!isMobile && (
        <AssessmentProfileActionBar
          dirty={dirty}
          saveLabel="Sync Profile Node"
          successLabel="Infrastructure Updated"
          onDiscard={handleDiscard}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
