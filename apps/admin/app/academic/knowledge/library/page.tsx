"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  BookOpenText,
  Clock3,
  Filter,
  Sparkles,
  ShieldCheck,
  X,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { StatGroup } from "@/components/ui/StatGroup";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { SubjectRecord } from "@/types";

import { KnowledgeLibraryFilters } from "./components/KnowledgeLibraryFilters";

interface ClassOptionRecord {
  _id: string;
  name: string;
  gradeName: string;
  classLabel?: string;
}

interface LevelOption {
  value: string;
  label: string;
}

import { KnowledgeMaterialDetailPanel } from "./components/KnowledgeMaterialDetailPanel";
import { KnowledgeMaterialList } from "./components/KnowledgeMaterialList";
import type {
  KnowledgeLibraryDetailResponse,
  KnowledgeLibraryFilterState,
  KnowledgeLibraryListResponse,
  KnowledgeMaterialVisibility,
  KnowledgeMaterialReviewStatus,
} from "./components/types";

const DEFAULT_FILTERS: KnowledgeLibraryFilterState = {
  searchQuery: "",
  visibility: "all",
  reviewStatus: "all",
  sourceType: "all",
  processingStatus: "all",
  ownerRole: "all",
  subjectId: "all",
  level: "all",
};

function buildLevelOptions(classes: ClassOptionRecord[] | undefined): LevelOption[] {
  const seen = new Set<string>();
  const options: LevelOption[] = [];

  for (const classDoc of classes ?? []) {
    const level = classDoc.gradeName.trim() || classDoc.name.trim();
    if (!level || seen.has(level)) {
      continue;
    }

    seen.add(level);
    options.push({ value: level, label: level });
  }

  return options;
}

function LoadingShell() {
  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row-reverse">
        <aside className="w-full border-l bg-white/40 backdrop-blur-xl p-4 md:p-8 lg:h-full lg:w-[420px] lg:overflow-y-auto shrink-0">
          <div className="animate-pulse space-y-4">
            <div className="h-12 rounded-2xl bg-slate-100/60" />
            <div className="h-40 rounded-2xl bg-slate-100/60" />
            <div className="h-72 rounded-2xl bg-slate-100/60" />
          </div>
        </aside>
        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-[1400px] space-y-6 md:space-y-8 animate-pulse">
            <div className="h-16 rounded-2xl bg-slate-100/60" />
            <div className="h-48 rounded-2xl bg-slate-100/60" />
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="h-52 rounded-2xl bg-slate-100/60" />
              <div className="h-52 rounded-2xl bg-slate-100/60" />
              <div className="h-52 rounded-2xl bg-slate-100/60" />
              <div className="h-52 rounded-2xl bg-slate-100/60" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function useKnowledgeLibraryQueryArgs(filters: KnowledgeLibraryFilterState, deferredSearch: string) {
  return useMemo(
    () => ({
      searchQuery: deferredSearch.trim() || undefined,
      visibility: filters.visibility,
      reviewStatus: filters.reviewStatus,
      sourceType: filters.sourceType,
      processingStatus: filters.processingStatus,
      ownerRole: filters.ownerRole,
      subjectId: filters.subjectId,
      level: filters.level,
      limit: 250,
    }),
    [
      deferredSearch,
      filters.level,
      filters.ownerRole,
      filters.processingStatus,
      filters.reviewStatus,
      filters.sourceType,
      filters.subjectId,
      filters.visibility,
    ]
  );
}

function matchesSearch(material: KnowledgeLibraryListResponse["materials"][number], query: string) {
  if (!query) return true;

  const normalized = query.toLowerCase();
  const haystack = [
    material.title,
    material.description ?? "",
    material.ownerName,
    material.ownerRole,
    material.sourceType,
    material.visibility,
    material.reviewStatus,
    material.processingStatus,
    material.subjectName,
    material.level,
    material.topicLabel,
    material.externalUrl ?? "",
    material.labelSuggestions.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export default function KnowledgeLibraryPage() {
  const subjects = useQuery("functions/academic/academicSetup:listSubjects" as never) as SubjectRecord[] | undefined;
  const classes = useQuery("functions/academic/academicSetup:listClasses" as never) as ClassOptionRecord[] | undefined;
  const topics = useQuery("functions/academic/lessonKnowledgeAdmin:listAdminKnowledgeTopics" as never) as Array<{ _id: string; title: string; subjectId: string; subjectName: string; level: string; termId: string; status: string; }> | undefined;

  const [filters, setFilters] = useState<KnowledgeLibraryFilterState>(DEFAULT_FILTERS);
  const isMobile = useIsMobile();
  const deferredSearch = useDeferredValue(filters.searchQuery);
  const queryArgs = useKnowledgeLibraryQueryArgs(filters, deferredSearch);
  const libraryData = useQuery(
    "functions/academic/lessonKnowledgeAdmin:listAdminKnowledgeMaterials" as never,
    queryArgs as never
  ) as KnowledgeLibraryListResponse | undefined;

  const levelOptions = useMemo(() => buildLevelOptions(classes), [classes]);

  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<KnowledgeLibraryDetailResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; title: string; message: string } | null>(null);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isSavingState, setIsSavingState] = useState(false);

  const updateDetails = useMutation("functions/academic/lessonKnowledgeAdmin:updateAdminKnowledgeMaterialDetails" as never);
  const updateState = useMutation("functions/academic/lessonKnowledgeAdmin:updateAdminKnowledgeMaterialState" as never);
  const createTopic = useMutation("functions/academic/lessonKnowledgeAdmin:createAdminKnowledgeTopic" as never);

  const detailQuery = useQuery(
    "functions/academic/lessonKnowledgeAdmin:getAdminKnowledgeMaterial" as never,
    selectedMaterialId ? ({ materialId: selectedMaterialId } as never) : ("skip" as never)
  ) as KnowledgeLibraryDetailResponse | undefined;

  useEffect(() => {
    if (!selectedMaterialId) {
      setActiveDetail(null);
      return;
    }

    if (detailQuery?.material._id === selectedMaterialId) {
      setActiveDetail(detailQuery);
      return;
    }

    setActiveDetail(null);
  }, [detailQuery, selectedMaterialId]);

  const materials = useMemo(() => libraryData?.materials ?? [], [libraryData]);

  const filteredMaterials = useMemo(() => {
    const searchQuery = filters.searchQuery.trim();
    return materials.filter((material) => {
      if (searchQuery && !matchesSearch(material, searchQuery)) {
        return false;
      }
      return true;
    });
  }, [filters.searchQuery, materials]);

  useEffect(() => {
    if (!selectedMaterialId) {
      return;
    }

    if (filteredMaterials.some((material) => material._id === selectedMaterialId)) {
      return;
    }

    setSelectedMaterialId(filteredMaterials[0]?._id ?? null);
  }, [filteredMaterials, selectedMaterialId]);

  const summary = useMemo(() => {
    return filteredMaterials.reduce(
      (acc, material) => {
        acc.loaded += 1;
        if (material.reviewStatus === "approved") acc.approved += 1;
        if (material.reviewStatus === "pending_review") acc.pendingReview += 1;
        if (material.reviewStatus === "archived") acc.archived += 1;
        if (material.visibility === "student_approved") acc.studentApproved += 1;
        if (material.processingStatus !== "ready" || material.searchStatus !== "indexed") {
          acc.needsAttention += 1;
        }
        return acc;
      },
      {
        loaded: 0,
        approved: 0,
        pendingReview: 0,
        archived: 0,
        studentApproved: 0,
        needsAttention: 0,
      }
    );
  }, [filteredMaterials]);

  const handleClearFilters = () => setFilters(DEFAULT_FILTERS);

  const handleSaveDetails = async (args: {
    materialId: string;
    title: string;
    description?: string;
    subjectId: string;
    level: string;
    topicLabel: string;
    topicId?: string;
  }) => {
    setNotice(null);
    setIsSavingDetails(true);
    try {
      await updateDetails({
        materialId: args.materialId,
        title: args.title,
        description: args.description ?? null,
        subjectId: args.subjectId,
        level: args.level,
        topicLabel: args.topicLabel,
        ...(args.topicId ? { topicId: args.topicId } : {}),
      } as never);
      setNotice({ tone: "success", title: "Material updated", message: "Relabel changes were saved and the search snapshot was refreshed." });
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Save failed",
        message: getUserFacingErrorMessage(error, "Failed to update material details."),
      });
      throw error;
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleCreateTopic = async (args: {
    title: string;
    summary?: string;
    subjectId: string;
    level: string;
  }) => {
    setNotice(null);
    setIsSavingDetails(true);
    try {
      const result = (await createTopic({
        title: args.title,
        summary: args.summary ?? null,
        subjectId: args.subjectId,
        level: args.level,
      } as never)) as {
        _id: string;
        title: string;
        subjectId: string;
        subjectName: string;
        level: string;
        termId: string;
        status: "draft" | "active" | "retired";
      };

      setNotice({
        tone: "success",
        title: "Topic ready",
        message: `Topic "${result.title}" is now available for attachment.`,
      });

      return result;
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Topic creation failed",
        message: getUserFacingErrorMessage(error, "Failed to create the topic."),
      });
      throw error;
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSaveState = async (args: {
    materialId: string;
    visibility?: KnowledgeMaterialVisibility;
    reviewStatus?: KnowledgeMaterialReviewStatus;
  }) => {
    setNotice(null);
    setIsSavingState(true);
    try {
      const result = (await updateState({
        materialId: args.materialId,
        ...(args.visibility ? { visibility: args.visibility } : {}),
        ...(args.reviewStatus ? { reviewStatus: args.reviewStatus } : {}),
      } as never)) as {
        materialId: string;
        visibility: KnowledgeMaterialVisibility;
        reviewStatus: KnowledgeMaterialReviewStatus;
      };

      setActiveDetail((current) => {
        if (!current || current.material._id !== result.materialId) {
          return current;
        }

        return {
          ...current,
          material: {
            ...current.material,
            visibility: result.visibility,
            reviewStatus: result.reviewStatus,
          },
        };
      });

      setNotice({ tone: "success", title: "Material state updated", message: "Visibility and review status were synchronized through Convex." });
    } catch (error) {
      setNotice({
        tone: "error",
        title: "State update failed",
        message: getUserFacingErrorMessage(error, "Failed to update visibility or review state."),
      });
      throw error;
    } finally {
      setIsSavingState(false);
    }
  };

  if (!subjects || !classes || !libraryData) {
    return <LoadingShell />;
  }

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200">
      <style jsx global>{`
        .knowledge-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .knowledge-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .knowledge-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 9999px;
        }
        .knowledge-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.15);
        }
      `}</style>

      <AdminSheet
        isOpen={Boolean(selectedMaterialId) && isMobile}
        onClose={() => setSelectedMaterialId(null)}
        title="Library inspector"
        description="Review and override knowledge materials."
      >
        <KnowledgeMaterialDetailPanel
          detail={activeDetail}
          subjects={subjects}
          topics={topics ?? []}
          levelOptions={levelOptions}
          variant="sheet"
          isSavingDetails={isSavingDetails}
          isSavingState={isSavingState}
          onSaveDetails={handleSaveDetails}
          onCreateTopic={handleCreateTopic}
          onSaveState={handleSaveState}
          onClose={() => setSelectedMaterialId(null)}
        />
      </AdminSheet>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row-reverse">
        <aside className="w-full border-l bg-white/40 backdrop-blur-xl p-4 md:p-6 lg:h-full lg:w-[420px] lg:overflow-y-auto knowledge-scrollbar shrink-0">
          <KnowledgeMaterialDetailPanel
            detail={activeDetail}
            subjects={subjects}
            topics={topics ?? []}
            levelOptions={levelOptions}
            isSavingDetails={isSavingDetails}
            isSavingState={isSavingState}
            onSaveDetails={handleSaveDetails}
            onCreateTopic={handleCreateTopic}
            onSaveState={handleSaveState}
            onClose={() => setSelectedMaterialId(null)}
          />
        </aside>

        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto knowledge-scrollbar p-4 md:p-8">
          <div className="mx-auto max-w-[1400px] space-y-6 md:space-y-8">
            <AdminHeader
              label="Academic Knowledge"
              title="Library Console"
              description="Inspect the school library, refine labels, and apply admin override actions without leaving the academic workspace."
              actions={
                <StatGroup
                  stats={[
                    { label: "Loaded", value: summary.loaded, icon: <BookOpenText className="h-4 w-4" /> },
                    { label: "Approved", value: summary.approved, icon: <ShieldCheck className="h-4 w-4" /> },
                    { label: "Pending", value: summary.pendingReview, icon: <Clock3 className="h-4 w-4" /> },
                    { label: "Needs attention", value: summary.needsAttention, icon: <Filter className="h-4 w-4" /> },
                  ]}
                  variant="wrap"
                />
              }
            />

            {notice && (
              <div className={`group relative overflow-hidden rounded-xl border-l-4 p-4 shadow-lg transition-all border-white bg-white ${
                notice.tone === "success" ? "border-l-emerald-500" : "border-l-rose-500"
              }`}>
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">
                      {notice.title}
                    </p>
                    <p className="text-sm font-bold tracking-tight text-slate-950">{notice.message}</p>
                  </div>
                  <button onClick={() => setNotice(null)} className="rounded-full p-1.5 hover:bg-slate-50 transition-colors">
                    <X className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            )}

            <KnowledgeLibraryFilters
              filters={filters}
              subjects={subjects}
              onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
              onClear={handleClearFilters}
            />

            <div className="flex items-center justify-between border-b border-slate-950/5 pb-3">
              <div>
                <h2 className="font-display text-sm font-black uppercase tracking-[0.2em] text-slate-400">Library results</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Search matches the material search snapshot; filters stay aligned with stored visibility and review state.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                {filteredMaterials.length} result{filteredMaterials.length === 1 ? "" : "s"}
              </span>
            </div>

            <KnowledgeMaterialList
              materials={filteredMaterials}
              selectedMaterialId={selectedMaterialId}
              onSelectMaterial={setSelectedMaterialId}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
