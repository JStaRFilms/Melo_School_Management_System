"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  Library, 
  Layers, 
  ChevronRight,
  Plus
} from "lucide-react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { BundleEditor } from "./BundleEditor";
import { BundleList } from "./BundleList";
import { BundlePreview } from "./BundlePreview";
import { EditorActionBar } from "./EditorActionBar";
import { ScaleTemplateEditor } from "./ScaleTemplateEditor";
import { TemplateList } from "./TemplateList";
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

export function ReportCardBundlesScreen({
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
  const [bundleSubTab, setBundleSubTab] = useState<"designer" | "monitor" | "distribution">("designer");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!selectedScaleId || selectedScaleId === "new") {
      return;
    }

    const selected = scaleTemplates.find((template) => template._id === selectedScaleId);
    if (selected) {
      setScaleDraft(createScaleDraft(selected));
    }
  }, [scaleTemplates, selectedScaleId]);

  useEffect(() => {
    if (!selectedBundleId || selectedBundleId === "new") {
      return;
    }

    const selected = bundles.find((bundle) => bundle._id === selectedBundleId);
    if (selected) {
      setBundleDraft(createBundleDraft(selected));
    }
  }, [bundles, selectedBundleId]);

  useEffect(() => {
    if (selectedScaleId === null) {
      setSelectedScaleId(scaleTemplates[0]?._id ?? "new");
    }
  }, [scaleTemplates, selectedScaleId]);

  useEffect(() => {
    if (selectedBundleId === null) {
      setSelectedBundleId(bundles[0]?._id ?? "new");
    }
  }, [bundles, selectedBundleId]);

  const activeScaleSource = useMemo(() => {
    if (!selectedScaleId || selectedScaleId === "new") {
      return createEmptyScaleDraft();
    }
    return createScaleDraft(scaleTemplates.find((template) => template._id === selectedScaleId) ?? null);
  }, [scaleTemplates, selectedScaleId]);

  const activeBundleSource = useMemo(() => {
    if (!selectedBundleId || selectedBundleId === "new") {
      return createEmptyBundleDraft();
    }
    return createBundleDraft(bundles.find((bundle) => bundle._id === selectedBundleId) ?? null);
  }, [bundles, selectedBundleId]);

  const scaleDirty = useMemo(
    () => serializeScaleDraft(scaleDraft) !== serializeScaleDraft(activeScaleSource),
    [activeScaleSource, scaleDraft]
  );
  const bundleDirty = useMemo(
    () => serializeBundleDraft(bundleDraft) !== serializeBundleDraft(activeBundleSource),
    [activeBundleSource, bundleDraft]
  );
  const assignmentPanel = useMemo(
    () => renderAssignmentPanel(bundleDraft.bundleId),
    [bundleDraft.bundleId, renderAssignmentPanel]
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

  const handleSaveScale = async () => {
    const issue = validateScaleDraft(scaleDraft);
    if (issue) {
      throw new Error(issue);
    }

    const nextId = await onSaveScaleTemplate(scaleDraft);
    setSelectedScaleId(nextId);
    setScaleDraft((current) => ({ ...current, templateId: nextId }));
  };

  const handleSaveBundle = async () => {
    const issue = validateBundleDraft(bundleDraft, scaleTemplates);
    if (issue) {
      throw new Error(issue);
    }

    const nextId = await onSaveBundle(bundleDraft);
    setSelectedBundleId(nextId);
    setBundleDraft((current) => ({ ...current, bundleId: nextId }));
  };

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-slate-50/50">
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.15); }
      `}} />

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* Sidebar Bucket - Catalog */}
        <aside className="lg:w-[400px] lg:h-full lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white/4 backdrop-blur-sm custom-scrollbar order-2 lg:order-1">
          {tab === "bundles" ? (
            <BundleList
              bundles={bundles}
              onSelect={(value) => {
                setSelectedBundleId(value);
                setBundleDraft(value === "new" ? createEmptyBundleDraft() : bundleDraft);
              }}
              selectedId={selectedBundleId ?? "new"}
            />
          ) : (
            <TemplateList
              templates={scaleTemplates}
              onSelect={(value) => {
                setSelectedScaleId(value);
                setScaleDraft(value === "new" ? createEmptyScaleDraft() : scaleDraft);
              }}
              selectedId={selectedScaleId ?? "new"}
            />
          )}
        </aside>

        {/* Main Content Bucket */}
        <main className="flex-1 flex flex-col lg:h-full lg:overflow-y-auto custom-scrollbar px-2 py-4 lg:p-6 order-1 lg:order-2">
          <div className="max-w-[1500px] mx-auto w-full space-y-6">
            <div className="space-y-6 pb-20">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  <span className="hover:text-slate-900 transition-colors cursor-default">Assessments</span>
                  <ChevronRight size={10} className="opacity-50" />
                  <span className="text-slate-900">Setup</span>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Report Card Bundles</h1>
                    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                      <span className="flex items-center gap-1.5"><Library size={12} className="text-slate-300" /> {bundles.length} Bundles</span>
                      <span className="w-1 h-1 rounded-full bg-slate-200" />
                      <span className="flex items-center gap-1.5"><Layers size={12} className="text-slate-300" /> {scaleTemplates.length} Scales</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-200/50 p-1 rounded-xl">
                    {[
                      { id: "bundles", label: "Bundles", icon: <Library className="w-3.5 h-3.5" /> },
                      { id: "scales", label: "Scales", icon: <Layers className="w-3.5 h-3.5" /> },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setTab(item.id as typeof tab)}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all rounded-lg ${
                          tab === item.id 
                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5" 
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile Trigger for new items */}
              {isMobile && (
                <button
                  onClick={() => tab === "bundles" ? setSelectedBundleId("new") : setSelectedScaleId("new")}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New {tab === "bundles" ? "Bundle" : "Scale"}
                </button>
              )}

              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {tab === "bundles" ? (
                  <div className="space-y-6">
                    {/* Sub-Tab Navigation for Bundles */}
                    <div className="flex items-center gap-6 border-b border-slate-200/60 pb-px overflow-x-auto scrollbar-hide">
                      {[
                        { id: "designer", label: "Blueprint Designer" },
                        { id: "monitor", label: "Virtual Monitor" },
                        { id: "distribution", label: "Distribution Engine" },
                      ].map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => setBundleSubTab(sub.id as typeof bundleSubTab)}
                          className={`relative pb-3 text-xs font-black uppercase tracking-[0.2em] transition-all ${
                            bundleSubTab === sub.id 
                              ? "text-slate-900" 
                              : "text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          {sub.label}
                          {bundleSubTab === sub.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full animate-in fade-in zoom-in-95 duration-300" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="pt-2">
                      {bundleSubTab === "designer" && (
                        <BundleEditor draft={bundleDraft} onChange={setBundleDraft} scaleTemplates={scaleTemplates} />
                      )}
                      {bundleSubTab === "monitor" && (
                        <BundlePreview draft={bundleDraft} scaleTemplates={scaleTemplates} />
                      )}
                      {bundleSubTab === "distribution" && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                          {assignmentPanel}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <ScaleTemplateEditor draft={scaleDraft} onChange={setScaleDraft} />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {tab === "scales" ? (
        <EditorActionBar
          dirty={scaleDirty}
          onDiscard={() =>
            setScaleDraft(
              selectedScaleId && selectedScaleId !== "new"
                ? createScaleDraft(scaleTemplates.find((template) => template._id === selectedScaleId) ?? null)
                : createEmptyScaleDraft()
            )
          }
          onSave={handleSaveScale}
          saveLabel="Save Scale"
          successLabel="Scale template saved"
        />
      ) : (
        <EditorActionBar
          dirty={bundleDirty}
          onDiscard={() =>
            setBundleDraft(
              selectedBundleId && selectedBundleId !== "new"
                ? createBundleDraft(bundles.find((bundle) => bundle._id === selectedBundleId) ?? null)
                : createEmptyBundleDraft()
            )
          }
          onSave={handleSaveBundle}
          saveLabel="Save Bundle"
          successLabel="Bundle saved"
        />
      )}
    </div>
  );
}
