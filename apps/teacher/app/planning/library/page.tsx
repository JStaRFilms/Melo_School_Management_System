"use client";

import { useDeferredValue, useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { 
  Plus, 
  Sparkles, 
  Shield,
  BookOpenText, 
  CheckCircle2, 
  Filter,
  Loader2,
  Search
} from "lucide-react";
import { 
  parseTeacherLessonPlanSourceIds,
  getUserFacingErrorMessage,
  applyPlanningSourceIdsToReturnTo
} from "@school/shared";

// Feature Imports
import { 
  TeacherLibraryMaterial,
  TeacherLibraryResponse, 
  TeacherLibrarySubject, 
  TeacherLibraryClassSummary,
  UploadNotice,
  MaterialDraft,
  TeacherKnowledgeTopic,
  TeacherKnowledgeMaterialSourceProofResponse
} from "../../../features/planning-library/types";
import { 
  inferUploadContentType, 
  uploadIntentSuccessMessage
} from "../../../features/planning-library/constants";
import { MaterialCard } from "../../../features/planning-library/components/MaterialCard";
import { LibrarySidebar } from "../../../features/planning-library/components/LibrarySidebar";
import { MaterialEditSheet } from "../../../features/planning-library/components/MaterialEditSheet";
import { MaterialPreviewInspector } from "../../../features/planning-library/components/MaterialPreviewInspector";

// UI Components
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
  const [visibility] = useState<any>("all");
  const [processingStatus] = useState<any>("all");

  // Selection & UI State
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isMobileUploadOpen, setIsMobileUploadOpen] = useState(false);
  const [previewMaterialId, setPreviewMaterialId] = useState<string | null>(null);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const returnToPreviewOnEditCloseRef = useRef(false);
  
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
  const previewMaterial = useMemo(
    () => materials.find((material) => material._id === previewMaterialId) ?? null,
    [materials, previewMaterialId]
  );

  // Persistence for smooth exit animations
  const [activeMaterial, setActiveMaterial] = useState<TeacherLibraryMaterial | null>(null);
  useEffect(() => {
    if (previewMaterial) setActiveMaterial(previewMaterial);
  }, [previewMaterial]);

  const sourceProofArgs = useMemo(
    () => (previewMaterial ? { materialId: previewMaterial._id } : "skip"),
    [previewMaterial]
  );
  const sourceProof = useQuery(
    "functions/academic/lessonKnowledgeTeacher:getTeacherKnowledgeMaterialSourceProof" as never,
    sourceProofArgs as never
  ) as TeacherKnowledgeMaterialSourceProofResponse | undefined;
  const isSourceProofLoading = Boolean(previewMaterial && sourceProof === undefined);

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

  const returnLabel = useMemo(() => {
    if (!safeReturnTo) return "Return";
    if (safeReturnTo.includes("/lesson-plans")) return "Return to Note";
    if (safeReturnTo.includes("/question-bank")) return "Return to Bank";
    if (safeReturnTo.includes("/videos")) return "Return to Videos";
    return "Return to Workspace";
  }, [safeReturnTo]);

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

  // Smart Focus: Auto-scroll to selected card on mobile
  useEffect(() => {
    if (previewMaterialId && isMobile) {
      const timerId = window.setTimeout(() => {
        const element = document.getElementById(`material-${previewMaterialId}`);
        if (element) {
          const yOffset = -120;
          const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 100);
      return () => window.clearTimeout(timerId);
    }
  }, [previewMaterialId, isMobile]);

  // Handlers
  const handleOpenPreview = (id: string) => {
    setPreviewMaterialId(id);
    if (isMobile) setIsMobilePreviewOpen(true);
  };

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
        subjectId: data.subjectId ? (data.subjectId as never) : null,
        level: data.level,
        topicLabel: data.topicLabel || data.title,
        sourceType: data.isCurriculumReference ? "imported_curriculum" : "file_upload",
        uploadIntent: data.uploadIntent,
        selectedPageRanges: uploadContentType.includes("pdf") ? data.selectedPageRanges?.trim() || null : null,
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
      setIsMobileUploadOpen(false);
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
        onClose={() => {
          setEditingMaterialId(null);
          if (returnToPreviewOnEditCloseRef.current) {
            returnToPreviewOnEditCloseRef.current = false;
            // Small delay to let the edit sheet begin its exit before re-opening preview
            setTimeout(() => setIsMobilePreviewOpen(true), 50);
          }
        }}
        material={materials.find(m => m._id === editingMaterialId) ?? null}
        onSave={handleSaveDraft}
        onPublish={async (id) => { await publishMaterial({ materialId: id as never } as never); }}
        onRetry={async (id) => { await retryMaterialIngestion({ materialId: id as never } as never); }}
        onArchive={handleArchive}
        isSaving={isSaving}
        topicCandidates={topicCandidates}
        levelOptions={levelOptions}
      />

      {/* Mobile Selection/Preview Sheet */}
      <TeacherSheet
        isOpen={isMobilePreviewOpen}
        onClose={() => setIsMobilePreviewOpen(false)}
        title="Material Insight"
        description="Inspect and manage this library entry."
      >
        {activeMaterial && (
          <MaterialPreviewInspector
            material={activeMaterial}
            sourceProof={sourceProof}
            isSourceProofLoading={isSourceProofLoading}
            isSelectedAsSource={selectedSourceIdSet.has(activeMaterial._id)}
            onToggleSelection={() => handleToggleSelection(activeMaterial._id)}
            onEdit={() => {
              returnToPreviewOnEditCloseRef.current = true;
              setEditingMaterialId(activeMaterial._id);
              setIsMobilePreviewOpen(false);
            }}
            onClose={() => setIsMobilePreviewOpen(false)}
            className="-mx-6 -mb-6 h-[calc(100vh-8rem)]"
          />
        )}
      </TeacherSheet>

      {/* Mobile Configuration Sheets */}
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
        title="Upload Material"
      >
        <LibrarySidebar {...sidebarProps} view="upload" />
      </TeacherSheet>

      <div className="flex-1 flex flex-col lg:flex-row-reverse lg:overflow-hidden min-h-0">
        {/* Sticky Desktop Workbench Sidebar */}
        <aside className="hidden lg:block w-[420px] h-full overflow-y-auto border-l border-slate-200/60 bg-white/40 backdrop-blur-xl custom-scrollbar shrink-0">
          {previewMaterial ? (
            <MaterialPreviewInspector
              material={previewMaterial}
              sourceProof={sourceProof}
              isSourceProofLoading={isSourceProofLoading}
              isSelectedAsSource={selectedSourceIdSet.has(previewMaterial._id)}
              onToggleSelection={() => handleToggleSelection(previewMaterial._id)}
              onEdit={() => setEditingMaterialId(previewMaterial._id)}
              onClose={() => setPreviewMaterialId(null)}
            />
          ) : (
            <LibrarySidebar {...sidebarProps} />
          )}
        </aside>

        {/* Main Resource Catalog */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar p-4 md:p-8 lg:p-10">
          <div className="max-w-[1200px] mx-auto space-y-8 lg:space-y-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  Academic Engine
                </p>
                <h1 className="font-display text-2xl lg:text-3xl font-black tracking-tighter text-slate-950 uppercase">
                  Planning Library
                </h1>
              </div>

              <StatGroup
                stats={[
                  { label: "Private", value: summary.privateOwner, icon: <Shield className="h-4 w-4" /> },
                  { label: "Staff Shared", value: summary.staffVisible, icon: <Sparkles className="h-4 w-4" /> },
                  { label: "Selected", value: selectedSourceIds.length, icon: <CheckCircle2 className="h-4 w-4" /> },
                ]}
                className="lg:translate-y-1"
              />
            </div>



            <div className="space-y-6 lg:space-y-8">
              {/* Toolbar */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200/60 pb-6">
                 <div className="space-y-1.5">
                   <h3 className="font-display text-lg lg:text-xl font-black tracking-tight text-slate-950 uppercase">
                     {searchQuery ? "Search Results" : "Live Library"}
                   </h3>
                   <div className="flex items-center gap-2">
                     <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                       {filteredMaterials.length} Documents Available
                     </p>
                   </div>
                 </div>
                 
                 <div className="flex gap-3">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter catalog..."
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300 shadow-sm"
                      />
                    </div>
                    {/* Mobile Filters Toggle */}
                    <button 
                      onClick={() => setIsMobileFiltersOpen(true)}
                      className="lg:hidden h-11 w-11 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-950 shadow-sm"
                    >
                      <Filter className="h-4 w-4" />
                    </button>
                 </div>
              </div>

              {/* Resource Grid */}
              {filteredMaterials.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredMaterials.map((m) => (
                    <MaterialCard
                      key={m._id}
                      material={m}
                      isSelected={previewMaterialId === m._id}
                      isSelectedAsSource={selectedSourceIdSet.has(m._id)}
                      onSelect={() => handleToggleSelection(m._id)}
                      onInspect={() => handleOpenPreview(m._id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-32 flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white/50 text-center">
                  <div className="rounded-2xl bg-white p-5 text-slate-200 shadow-sm ring-1 ring-slate-950/5 mb-6">
                    <Filter className="h-10 w-10" />
                  </div>
                  <h4 className="text-base font-black uppercase tracking-widest text-slate-950">Catalog Empty</h4>
                  <p className="mt-2 text-xs font-medium text-slate-400 max-w-[280px]">
                    Try adjusting your subject filters or upload a new source document.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="h-32" /> {/* Bottom spacer for floating HUD */}
        </main>
      </div>

      {/* Floating Selection Command Bar */}
      {selectedSourceIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-700 cubic-bezier(0.16, 1, 0.3, 1)">
          <div className="bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-2.5 sm:p-3.5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between gap-3 sm:gap-6">
              <div className="flex items-center gap-2.5 sm:gap-3.5 pl-1">
                <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0 ring-1 ring-white/5">
                  <BookOpenText className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white whitespace-nowrap">
                      {selectedSourceIds.length} Selected
                    </span>
                    <span className="hidden md:block h-1 w-1 rounded-full bg-white/20" />
                    <span className="hidden md:block text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                      Ready
                    </span>
                  </div>
                  <p className="hidden sm:block text-[10px] font-bold text-slate-500 uppercase tracking-tight mt-0.5">
                    Context synced to workspace
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button 
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete("sourceIds");
                    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
                  }}
                  className="h-9 sm:h-11 px-3 sm:px-4 rounded-xl hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                >
                  Clear
                </button>
                {safeReturnTo && (
                  <button 
                    onClick={() => {
                      const href = applyPlanningSourceIdsToReturnTo(safeReturnTo!, selectedSourceIds);
                      if (href) router.push(href);
                    }}
                    className="h-9 sm:h-11 px-4 sm:px-6 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2 whitespace-nowrap"
                  >
                    <span className="hidden min-[450px]:inline">{returnLabel}</span>
                    <span className="min-[450px]:hidden">Return</span>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Mobile Action */}
      <button
        onClick={() => setIsMobileUploadOpen(true)}
        className="lg:hidden fixed bottom-8 right-8 h-16 w-16 flex items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl shadow-slate-950/40 hover:scale-105 active:scale-95 transition-all z-50"
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  );
}
