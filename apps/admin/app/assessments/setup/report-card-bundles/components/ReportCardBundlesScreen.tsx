"use client";

import {
  ChevronRight,
  Layers,
  Library,
  Plus
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { ScreenProps } from "../types";
import {
  createBundleDraft,
  createEmptyBundleDraft,
  createEmptyScaleDraft,
  createScaleDraft,
  serializeBundleDraft,
  serializeScaleDraft,
  validateBundleDraft,
  validateScaleDraft,
} from "../utils";
import { BundleList } from "./BundleList";
import { EditorActionBar } from "./EditorActionBar";
import { InteractiveSheetEditor } from "./InteractiveSheetEditor";
import { ScaleLiveCanvas } from "./ScaleLiveCanvas";
import { ScaleTemplateEditor } from "./ScaleTemplateEditor";
import { TemplateList } from "./TemplateList";

export const ReportCardBundlesScreen = memo(function ReportCardBundlesScreen({
  scaleTemplates,
  bundles,
  onSaveScaleTemplate,
  onSaveBundle,
  renderAssignmentPanel,
}: ScreenProps) {
  const [tab, setTab] = useState<"bundles" | "scales">("bundles");
  const [selectedScaleId, setSelectedScaleId] = useState<string | "new" | null>(null);
  const [selectedBundleId, setSelectedBundleId] = useState<string | "new" | null>(null);
  const [scaleDraft, setScaleDraft] = useState(createEmptyScaleDraft);
  const [bundleDraft, setBundleDraft] = useState(createEmptyBundleDraft);
  const [bundleSubTab, setBundleSubTab] = useState<"designer" | "distribution">("designer");
  const [isMobile, setIsMobile] = useState(false);

  const loadedScaleIdRef = useRef<string | null>(null);
  const loadedBundleIdRef = useRef<string | null>(null);

  // Serialized snapshots of the clean server state
  const loadedScaleSerializedRef = useRef<string>("");
  const loadedBundleSerializedRef = useRef<string>("");
  const [scaleDirty, setScaleDirty] = useState(false);
  const [bundleDirty, setBundleDirty] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Initial selection setup
  useEffect(() => {
    if (selectedScaleId === null && scaleTemplates.length > 0) {
      setSelectedScaleId(scaleTemplates[0]._id);
    }
  }, [scaleTemplates, selectedScaleId]);

  useEffect(() => {
    if (selectedBundleId === null && bundles.length > 0) {
      setSelectedBundleId(bundles[0]._id);
    }
  }, [bundles, selectedBundleId]);

  // Sync draft only when selection changes or is first loaded
  useEffect(() => {
    if (!selectedScaleId) return;

    if (selectedScaleId === "new") {
      if (loadedScaleIdRef.current !== "new") {
        const empty = createEmptyScaleDraft();
        setScaleDraft(empty);
        loadedScaleSerializedRef.current = serializeScaleDraft(empty);
        setScaleDirty(false);
        loadedScaleIdRef.current = "new";
      }
      return;
    }

    const selected = scaleTemplates.find((template) => template._id === selectedScaleId);
    if (
      selected &&
      (loadedScaleIdRef.current !== selectedScaleId ||
        (!scaleDirty && scaleDraft.sourceUpdatedAt !== selected.updatedAt))
    ) {
      const initial = createScaleDraft(selected);
      setScaleDraft(initial);
      loadedScaleSerializedRef.current = serializeScaleDraft(initial);
      setScaleDirty(false);
      loadedScaleIdRef.current = selectedScaleId;
    }
  }, [scaleDraft.sourceUpdatedAt, scaleDirty, scaleTemplates, selectedScaleId]);

  useEffect(() => {
    if (!selectedBundleId) return;

    if (selectedBundleId === "new") {
      if (loadedBundleIdRef.current !== "new") {
        const empty = createEmptyBundleDraft();
        setBundleDraft(empty);
        loadedBundleSerializedRef.current = serializeBundleDraft(empty);
        setBundleDirty(false);
        loadedBundleIdRef.current = "new";
      }
      return;
    }

    const selected = bundles.find((bundle) => bundle._id === selectedBundleId);
    if (
      selected &&
      (loadedBundleIdRef.current !== selectedBundleId ||
        (!bundleDirty && bundleDraft.sourceUpdatedAt !== selected.updatedAt))
    ) {
      const initial = createBundleDraft(selected);
      setBundleDraft(initial);
      loadedBundleSerializedRef.current = serializeBundleDraft(initial);
      setBundleDirty(false);
      loadedBundleIdRef.current = selectedBundleId;
    }
  }, [bundleDraft.sourceUpdatedAt, bundleDirty, bundles, selectedBundleId]);

  const handleSelectBundle = useCallback((value: string | "new") => {
    setSelectedBundleId(value);
    if (value === "new") {
      const empty = createEmptyBundleDraft();
      setBundleDraft(empty);
      loadedBundleSerializedRef.current = serializeBundleDraft(empty);
      setBundleDirty(false);
      loadedBundleIdRef.current = "new";
    }
  }, []);

  const handleSelectScale = useCallback((value: string | "new") => {
    setSelectedScaleId(value);
    if (value === "new") {
      const empty = createEmptyScaleDraft();
      setScaleDraft(empty);
      loadedScaleSerializedRef.current = serializeScaleDraft(empty);
      setScaleDirty(false);
      loadedScaleIdRef.current = "new";
    }
  }, []);

  const handleBundleChange = useCallback(
    (nextDraft: typeof bundleDraft | ((prev: typeof bundleDraft) => typeof bundleDraft)) => {
      setBundleDraft((prev) => {
        const resolved = typeof nextDraft === "function" ? nextDraft(prev) : nextDraft;
        setBundleDirty(true);
        return resolved;
      });
    },
    []
  );

  const handleScaleChange = useCallback(
    (nextDraft: typeof scaleDraft | ((prev: typeof scaleDraft) => typeof scaleDraft)) => {
      setScaleDraft((prev) => {
        const resolved = typeof nextDraft === "function" ? nextDraft(prev) : nextDraft;
        setScaleDirty(true);
        return resolved;
      });
    },
    []
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!scaleDirty && !bundleDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [bundleDirty, scaleDirty]);

  const handleSaveScale = useCallback(async () => {
    const issue = validateScaleDraft(scaleDraft);
    if (issue) {
      throw new Error(issue);
    }

    const nextId = await onSaveScaleTemplate(scaleDraft);
    loadedScaleIdRef.current = nextId;
    loadedScaleSerializedRef.current = serializeScaleDraft(scaleDraft);
    setScaleDirty(false);
    setSelectedScaleId(nextId);
    setScaleDraft((current) => ({ ...current, templateId: nextId }));
  }, [onSaveScaleTemplate, scaleDraft]);

  const handleSaveBundle = useCallback(async () => {
    const issue = validateBundleDraft(bundleDraft, scaleTemplates);
    if (issue) {
      throw new Error(issue);
    }

    const nextId = await onSaveBundle(bundleDraft);
    loadedBundleIdRef.current = nextId;
    loadedBundleSerializedRef.current = serializeBundleDraft(bundleDraft);
    setBundleDirty(false);
    setSelectedBundleId(nextId);
    setBundleDraft((current) => ({ ...current, bundleId: nextId }));
  }, [bundleDraft, onSaveBundle, scaleTemplates]);

  const handleDiscardScale = useCallback(() => {
    const nextDraft = selectedScaleId && selectedScaleId !== "new"
      ? createScaleDraft(scaleTemplates.find((template) => template._id === selectedScaleId) ?? null)
      : createEmptyScaleDraft();
    loadedScaleSerializedRef.current = serializeScaleDraft(nextDraft);
    setScaleDraft(nextDraft);
    setScaleDirty(false);
  }, [scaleTemplates, selectedScaleId]);

  const handleDiscardBundle = useCallback(() => {
    const nextDraft = selectedBundleId && selectedBundleId !== "new"
      ? createBundleDraft(bundles.find((bundle) => bundle._id === selectedBundleId) ?? null)
      : createEmptyBundleDraft();
    loadedBundleSerializedRef.current = serializeBundleDraft(nextDraft);
    setBundleDraft(nextDraft);
    setBundleDirty(false);
  }, [bundles, selectedBundleId]);

  const handleSaveScaleAndNext = useCallback(async () => {
    if (scaleDirty) {
      await handleSaveScale();
    }
    setTab("bundles");
    setBundleSubTab("designer");
  }, [handleSaveScale, scaleDirty]);

  const handleSaveScaleAndCreateNew = useCallback(async () => {
    if (scaleDirty) {
      await handleSaveScale();
    }
    handleSelectScale("new");
  }, [handleSaveScale, handleSelectScale, scaleDirty]);

  const handleSaveBundleAndNext = useCallback(async () => {
    if (bundleDirty) {
      await handleSaveBundle();
    }
    setBundleSubTab("distribution");
  }, [bundleDirty, handleSaveBundle]);

  return (
    <div className="relative min-h-full lg:h-full w-full flex flex-col lg:overflow-hidden bg-slate-50/50">
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.15); }
      `}} />

      {/* 2-PANE OR 3-PANE WORKBENCH SPLIT */}
      <div className="relative flex-1 flex flex-col lg:flex-row min-h-0 lg:h-full lg:overflow-hidden">

        {/* PANE 1: Left Catalog Sidebar (300px - 320px) */}
        <aside className="w-full lg:w-[280px] xl:w-[300px] lg:h-full lg:overflow-hidden flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white/40 backdrop-blur-xl shrink-0 order-2 lg:order-1">
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {tab === "bundles" ? (
              <BundleList
                bundles={bundles}
                onSelect={handleSelectBundle}
                selectedId={selectedBundleId ?? "new"}
              />
            ) : (
              <TemplateList
                templates={scaleTemplates}
                onSelect={handleSelectScale}
                selectedId={selectedScaleId ?? "new"}
              />
            )}
          </div>
        </aside>

        {/* PANE 2: Center Workspace */}
        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto custom-scrollbar p-6 lg:p-8 order-1 lg:order-2">
          <div className={`${tab === "scales" ? "max-w-3xl" : "max-w-[960px]"} mx-auto space-y-6 pb-28`}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                <span className="hover:text-slate-900 transition-colors cursor-default">Assessments</span>
                <ChevronRight size={10} className="opacity-50" />
                <span className="text-slate-900">Setup</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                    Report Card Add-ons & Traits
                  </h1>
                  <p className="text-xs font-medium text-slate-500 max-w-xl">
                    Configure affective domain traits, psychomotor ratings, and custom remarks directly on the report card sheet.
                  </p>
                </div>
              </div>

              {/* 3-STEP GUIDED WORKFLOW STEPPER */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1.5 bg-slate-200/50 rounded-2xl">
                {/* Step 1 */}
                <button
                  type="button"
                  onClick={() => setTab("scales")}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    tab === "scales"
                      ? "bg-white shadow-sm ring-1 ring-slate-900/5 text-slate-900"
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                      tab === "scales"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    1
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-wider">Rating Scales</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate">1–5, Letter grades (A–E)</div>
                  </div>
                </button>

                {/* Step 2 */}
                <button
                  type="button"
                  onClick={() => {
                    setTab("bundles");
                    setBundleSubTab("designer");
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    tab === "bundles" && bundleSubTab === "designer"
                      ? "bg-white shadow-sm ring-1 ring-slate-900/5 text-slate-900"
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                      tab === "bundles" && bundleSubTab === "designer"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    2
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-wider">Design Add-on Sheet</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate">Traits, remarks & metrics</div>
                  </div>
                </button>

                {/* Step 3 */}
                <button
                  type="button"
                  onClick={() => {
                    setTab("bundles");
                    setBundleSubTab("distribution");
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    tab === "bundles" && bundleSubTab === "distribution"
                      ? "bg-white shadow-sm ring-1 ring-slate-900/5 text-slate-900"
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                      tab === "bundles" && bundleSubTab === "distribution"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    3
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-wider">Assign to Classes</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate">Link to Primary / Secondary</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Mobile Trigger for new items */}
            {isMobile && (
              <button
                onClick={() => (tab === "bundles" ? handleSelectBundle("new") : handleSelectScale("new"))}
                className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
                type="button"
              >
                <Plus className="w-4 h-4" />
                New {tab === "bundles" ? "Add-on" : "Rating Scale"}
              </button>
            )}

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {tab === "bundles" ? (
                <div className="space-y-6">
                  <div className="pt-2">
                    {bundleSubTab === "designer" && (
                      <InteractiveSheetEditor
                        draft={bundleDraft}
                        onChange={handleBundleChange}
                        scaleTemplates={scaleTemplates}
                        onProceedToDistribution={handleSaveBundleAndNext}
                        onNavigateToScales={() => setTab("scales")}
                      />
                    )}
                    {bundleSubTab === "distribution" && (
                      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                              Step 3 &bull; Class Distribution
                            </span>
                            <h3 className="text-xs font-bold text-slate-900">
                              Assigning: {bundleDraft.name || "Untitled Add-on"}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBundleSubTab("designer")}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            ← Back to Sheet Designer
                          </button>
                        </div>
                        {renderAssignmentPanel(bundleDraft.bundleId)}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <ScaleTemplateEditor
                    draft={scaleDraft}
                    onChange={handleScaleChange}
                    hidePreview={true}
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <button
                      type="button"
                      onClick={handleSaveScaleAndCreateNew}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{scaleDirty ? "Save & Create Another Scale" : "+ Create Another Scale"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveScaleAndNext}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span>{scaleDirty ? "Save & Next: Design Add-on Sheet" : "Next: Design Add-on Sheet"}</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* PANE 3: Pinned Right Live Scale Preview (Only on Rating Scales tab) */}
        {tab === "scales" && (
          <aside className="hidden xl:flex xl:w-[380px] 2xl:w-[420px] flex-col h-full overflow-y-auto custom-scrollbar border-l border-slate-200/80 bg-white/60 backdrop-blur-md p-6 shrink-0 order-3 space-y-4">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Step 1 &bull; Live Visualizer
                </span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Report Card Preview
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                PINNED
              </span>
            </div>

            <ScaleLiveCanvas draft={scaleDraft} />

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 text-[11px] text-slate-500 leading-relaxed">
              <p className="font-bold text-slate-800 mb-1">Live Table Key & Grid Preview</p>
              Shows how this scale&apos;s symbol keys (e.g. 5–1 or A–E) and rating markers will render in trait assessment matrices on official student report sheets.
            </div>
          </aside>
        )}

      </div>

      {tab === "scales" ? (
        <EditorActionBar
          dirty={scaleDirty}
          onDiscard={handleDiscardScale}
          onSave={handleSaveScale}
          saveLabel="Save Scale"
          successLabel="Scale template saved"
        />
      ) : (
        <EditorActionBar
          dirty={bundleDirty}
          onDiscard={handleDiscardBundle}
          onSave={handleSaveBundle}
          saveLabel="Save Add-on"
          successLabel="Add-on bundle saved"
        />
      )}
    </div>
  );
});
