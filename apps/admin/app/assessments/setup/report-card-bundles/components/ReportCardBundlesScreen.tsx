"use client";

import { useEffect, useMemo, useState } from "react";
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
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 pb-28 sm:px-6 sm:py-10">
      <div className="space-y-4">
        <div className="breadcrumb-text flex items-center gap-2">
          <a className="transition-colors hover:text-slate-900" href="#">
            Assessments
          </a>
          <span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-900">Report Card Bundles</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Report card bundle setup</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
            Manage reusable scales, build bundle fields with reorder controls, preview the final layout, and assign bundles across classes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["bundles", "Bundles"],
            ["scales", "Reusable scales"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={[
                "rounded-full px-4 py-2 text-sm font-medium transition",
                tab === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
              onClick={() => setTab(value as typeof tab)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "scales" ? (
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <TemplateList
            onSelect={(value) => {
              setSelectedScaleId(value);
              setScaleDraft(value === "new" ? createEmptyScaleDraft() : scaleDraft);
            }}
            selectedId={selectedScaleId ?? "new"}
            templates={scaleTemplates}
          />
          <ScaleTemplateEditor draft={scaleDraft} onChange={setScaleDraft} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            <BundleList
              bundles={bundles}
              onSelect={(value) => {
                setSelectedBundleId(value);
                setBundleDraft(value === "new" ? createEmptyBundleDraft() : bundleDraft);
              }}
              selectedId={selectedBundleId ?? "new"}
            />
            <BundleEditor draft={bundleDraft} onChange={setBundleDraft} scaleTemplates={scaleTemplates} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <BundlePreview draft={bundleDraft} scaleTemplates={scaleTemplates} />
            {assignmentPanel}
          </div>
        </div>
      )}

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
