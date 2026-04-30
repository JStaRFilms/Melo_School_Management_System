"use client";

import { useDeferredValue, useMemo, useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { 
  Plus, 
  Search, 
  Sparkles, 
  Shield,
  BookOpenText, 
  FileUp, 
  Clock, 
  CheckCircle2, 
  Filter,
  X,
  FileText,
  Loader2
} from "lucide-react";
import { 
  parseTeacherLessonPlanSourceIds,
  parsePlanningContextFromSearchParams,
  buildTeacherLessonPlanHref,
  buildTeacherPlanningWorkspaceHref,
  getUserFacingErrorMessage,
  applyPlanningSourceIdsToReturnTo
} from "@school/shared";

// Feature Imports
import { 
  TeacherLibraryMaterial, 
  TeacherLibraryResponse, 
  TeacherLibrarySubject, 
  TeacherLibraryClassSummary,
  UploadIntent,
  UploadNotice,
  MaterialDraft,
  TeacherKnowledgeTopic,
  TeacherKnowledgeMaterialSourceProofResponse
} from "../../../features/planning-library/types";
import { 
  DEFAULT_FILTERS, 
  inferUploadContentType, 
  isSupportedUploadContentType,
  normalizeFileTitle,
  uploadIntentSuccessMessage
} from "../../../features/planning-library/constants";
import { MaterialCard } from "../../../features/planning-library/components/MaterialCard";
import { LibrarySidebar } from "../../../features/planning-library/components/LibrarySidebar";
import { MaterialEditSheet } from "../../../features/planning-library/components/MaterialEditSheet";

// UI Components
import { TeacherHeader } from "@/lib/components/ui/TeacherHeader";
import { TeacherSheet } from "@/lib/components/ui/TeacherSheet";
import { StatGroup } from "@/lib/components/ui/StatGroup";
import { cn } from "@/lib/utils";

export default function TeacherLibraryPage() {
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [visibility, setVisibility] = useState<any>("all");
  const [processingStatus, setProcessingStatus] = useState<any>("all");

  // Selection & UI State
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isMobileUploadOpen, setIsMobileUploadOpen] = useState(false);

  const deferredSearch = useDeferredValue(searchQuery);
  const sourceIdsParam = searchParams.get("sourceIds");
  const returnTo = searchParams.get("returnTo");
  const safeReturnTo = returnTo && returnTo.startsWith("/planning/") ? returnTo : null;

  const selectedSourceIds = useMemo(
    () => parseTeacherLessonPlanSourceIds(sourceIdsParam),
    [sourceIdsParam]
  );
  const selectedSourceIdSet = useMemo(() => new Set(selectedSourceIds), [selectedSourceIds]);

  // Queries
  const queryArgs = useMemo(() => ({
    searchQuery: deferredSearch.trim() || undefined,
    visibility,
    processingStatus,
    limit: 100,
  }), [deferredSearch, visibility, processingStatus]);

  const materialsData = useQuery(
    "functions/academic/lessonKnowledgeTeacher:listTeacherKnowledgeLibraryMaterials" as never,
    queryArgs as never
  ) as TeacherLibraryResponse | undefined;

  const subjects = useQuery(
    "functions/academic/lessonKnowledgeTeacher:listTeacherLibrarySubjects" as never
  ) as TeacherLibrarySubject[] | undefined;

  const assignableClasses = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableClasses" as never
  ) as TeacherLibraryClassSummary[] | undefined;

  const topicQueryArgs = useMemo(() => ({ limit: 50 }), []);
  const topicCandidates = useQuery(
    "functions/academic/lessonKnowledgeTeacher:listTeacherKnowledgeTopics" as never,
    topicQueryArgs as never
  ) as TeacherKnowledgeTopic[] | undefined;

  // Mutations
  const requestUploadUrl = useMutation("functions/academic/lessonKnowledgeIngestion:requestKnowledgeMaterialUploadUrl" as never);
  const finalizeUpload = useMutation("functions/academic/lessonKnowledgeIngestion:finalizeKnowledgeMaterialUpload" as never);
  const updateMaterial = useMutation("functions/academic/lessonKnowledgeTeacher:updateTeacherKnowledgeMaterialDetails" as never);
  const publishMaterial = useMutation("functions/academic/lessonKnowledgeTeacher:publishTeacherKnowledgeMaterialToStaff" as never);
  const retryMaterialIngestion = useMutation("functions/academic/lessonKnowledgeIngestion:retryKnowledgeMaterialIngestion" as never);

  // Derived Data
  const materials = useMemo(() => materialsData?.materials ?? [], [materialsData]);
  const filteredMaterials = useMemo(() => materials.filter((m) => {
    if (subjectFilter !== "all" && m.subjectId !== subjectFilter) return false;
    if (levelFilter !== "all" && m.level !== levelFilter) return false;
    return true;
  }), [materials, subjectFilter, levelFilter]);

  const summary = materialsData?.summary ?? {
    loaded: 0,
    privateOwner: 0,
    staffVisible: 0,
    readyToSelect: 0,
    publishable: 0,
    needsAttention: 0,
  };

  const levelOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    for (const c of assignableClasses ?? []) {
      const level = (c.gradeName ?? c.name).trim();
      if (level && !seen.has(level)) {
        seen.add(level);
        options.push({ value: level, label: level });
      }
    }
    return options;
  }, [assignableClasses]);

  // Handlers
  const handleToggleSelection = (id: string) => {
    const nextIds = selectedSourceIdSet.has(id)
      ? selectedSourceIds.filter(val => val !== id)
      : [...selectedSourceIds, id];
    
    const params = new URLSearchParams(searchParams.toString());
    if (nextIds.length > 0) params.set("sourceIds", nextIds.join(","));
    else params.delete("sourceIds");
    
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  };

  const handleUpload = async (data: any) => {
    setIsUploading(true);
    setNotice(null);
    try {
      const uploadContentType = inferUploadContentType(data.file);
      const uploadShell = (await requestUploadUrl({
        title: data.title,
        description: data.description || null,
        subjectId: data.subjectId as never,
        level: data.level,
        topicLabel: data.topicLabel || data.title,
        sourceType: data.isCurriculumReference ? "imported_curriculum" : "file_upload",
        uploadIntent: data.uploadIntent,
      } as never)) as { materialId: string; uploadUrl: string };

      const response = await fetch(uploadShell.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": uploadContentType },
        body: data.file,
      });

      if (!response.ok) throw new Error("Upload failed.");
      const payload = await response.json();
      if (!payload.storageId) throw new Error("Storage ID missing.");

      await finalizeUpload({
        materialId: uploadShell.materialId as never,
        storageId: payload.storageId as never,
      } as never);

      setNotice({ tone: "success", message: uploadIntentSuccessMessage(data.uploadIntent) });
      setIsMobileUploadOpen(false); // Close mobile sheet on success
    } catch (err) {
      setNotice({ tone: "error", message: getUserFacingErrorMessage(err, "Upload failed.") });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveDraft = async (draft: MaterialDraft) => {
    setIsSaving(true);
    try {
      await updateMaterial({
        materialId: draft.materialId as never,
        title: draft.title,
        description: draft.description || null,
        subjectId: draft.subjectId as never,
        level: draft.level,
        topicLabel: draft.topicLabel,
        topicId: draft.topicId || undefined,
      } as never);
      setEditingMaterialId(null);
      setNotice({ tone: "success", message: "Changes saved." });
    } catch (err) {
      setNotice({ tone: "error", message: getUserFacingErrorMessage(err, "Save failed.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
     console.log("Archive material:", id);
  };

  if (materialsData === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-200">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const sidebarProps = {
    searchQuery,
    onSearchChange: setSearchQuery,
    subjectFilter,
    onSubjectFilterChange: setSubjectFilter,
    levelFilter,
    onLevelFilterChange: setLevelFilter,
    subjects: subjects ?? [],
    levelOptions,
    subjectsReady: subjects ?? [],
    onUpload: handleUpload,
    isUploading,
    notice,
    onClearNotice: () => setNotice(null),
    isAdmin: session?.user?.role === "admin",
  };

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200 relative">
      <MaterialEditSheet
        isOpen={Boolean(editingMaterialId)}
        onClose={() => setEditingMaterialId(null)}
        material={materials.find(m => m._id === editingMaterialId) ?? null}
        onSave={handleSaveDraft}
        onPublish={async (id) => { await publishMaterial({ materialId: id as never } as never); }}
        onRetry={async (id) => { await retryMaterialIngestion({ materialId: id as never } as never); }}
        onArchive={handleArchive}
        isSaving={isSaving}
        topicCandidates={topicCandidates}
        levelOptions={levelOptions}
      />

      {/* Mobile Sheets */}
      <TeacherSheet 
        isOpen={isMobileFiltersOpen} 
        onClose={() => setIsMobileFiltersOpen(false)}
        title="Filter Library"
      >
        <LibrarySidebar {...sidebarProps} view="filters" />
      </TeacherSheet>

      <TeacherSheet 
        isOpen={isMobileUploadOpen} 
        onClose={() => setIsMobileUploadOpen(false)}
        title="Add New Material"
      >
        <LibrarySidebar {...sidebarProps} view="upload" />
      </TeacherSheet>

      <div className="flex-1 flex flex-col lg:flex-row-reverse lg:overflow-hidden">
        {/* Sidebar Bucket - Desktop Only */}
        <div className="hidden lg:block w-full lg:w-[400px] border-l border-slate-200/60">
          <LibrarySidebar {...sidebarProps} />
        </div>

        {/* Main Bucket */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar p-4 md:p-8">
          <div className="max-w-[1200px] mx-auto space-y-8">
            <TeacherHeader
              title="Planning Library"
              label="Planning Studio"
              description="A central repository for your source materials. Private by default, visible to staff once published."
              actions={
                <StatGroup
                  stats={[
                    { label: "Private", value: summary.privateOwner, icon: <Shield className="h-4 w-4" /> },
                    { label: "Staff Shared", value: summary.staffVisible, icon: <Sparkles className="h-4 w-4" /> },
                    { label: "Selected", value: selectedSourceIds.length, icon: <CheckCircle2 className="h-4 w-4" /> },
                  ]}
                />
              }
            />

            {/* Selection Banner */}
            {selectedSourceIds.length > 0 && (
              <div className="flex flex-col gap-4 p-4 rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-950/10 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white/10 p-2">
                       <BookOpenText className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-widest">
                        {selectedSourceIds.length} Sources Selected
                      </h4>
                      <p className="text-[11px] font-medium text-slate-400">
                        Ready to prepare a lesson or assessment workspace.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete("sourceIds");
                        router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
                      }}
                      className="h-9 px-4 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"
                    >
                      Clear
                    </button>
                    {safeReturnTo && (
                      <button 
                        // @ts-ignore
                        onClick={() => router.push(applyPlanningSourceIdsToReturnTo(safeReturnTo!, selectedSourceIds))}
                        className="h-9 px-5 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Return to Workspace
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Content Grid */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-950/5 pb-4">
                 <div className="space-y-1">
                   <h3 className="font-display text-xl font-black tracking-tight text-slate-950 uppercase">
                     {searchQuery ? "Search Results" : "All Materials"}
                   </h3>
                   <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                     {filteredMaterials.length} Items Found
                   </p>
                 </div>
                 
                 {/* Mobile Actions Overlay */}
                 <div className="lg:hidden flex gap-2">
                   <button 
                     onClick={() => setIsMobileFiltersOpen(true)}
                     className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-950 shadow-sm"
                   >
                     <Filter className="h-4 w-4" />
                   </button>
                 </div>
              </div>

              {filteredMaterials.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredMaterials.map((m) => (
                    <MaterialCard
                      key={m._id}
                      material={m}
                      isSelected={selectedSourceIdSet.has(m._id)}
                      onToggleSelection={() => handleToggleSelection(m._id)}
                      onViewDetails={() => setEditingMaterialId(m._id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 text-center">
                  <div className="rounded-full bg-slate-50 p-4 text-slate-300 ring-1 ring-slate-950/5 mb-4">
                    <Filter className="h-8 w-8" />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-950">No materials found</h4>
                  <p className="mt-2 text-xs font-medium text-slate-400 max-w-[250px]">
                    Try adjusting your filters or upload a new document to your library.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Floating Action Button (Mobile Only) */}
      <button
        onClick={() => setIsMobileUploadOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 h-14 w-14 flex items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl shadow-slate-950/40 hover:scale-105 active:scale-95 transition-all z-50"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
