"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { X, Check, Landmark, BookOpenText, Sparkles, UserPlus, Loader2 } from "lucide-react";
import { appToast, getErrorMessage } from "@school/shared/toast";
import {
  PLATFORM_MODULE_DEFINITIONS,
  type PlatformModuleDefinition,
} from "@school/shared";

export interface SchoolFeatureSet {
  billing: boolean;
  curriculum: boolean;
  knowledgeLibrary: boolean;
  admissions: boolean;
}

export interface ManageFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: {
    _id: string;
    name: string;
    features: SchoolFeatureSet;
  } | null;
}

function getModuleIcon(iconName: PlatformModuleDefinition["iconName"]) {
  switch (iconName) {
    case "Landmark":
      return <Landmark className="h-5 w-5 text-emerald-600" />;
    case "BookOpenText":
      return <BookOpenText className="h-5 w-5 text-indigo-600" />;
    case "Sparkles":
      return <Sparkles className="h-5 w-5 text-amber-500" />;
    case "UserPlus":
      return <UserPlus className="h-5 w-5 text-blue-600" />;
    default:
      return <Sparkles className="h-5 w-5 text-slate-500" />;
  }
}

export function ManageFeaturesModal({
  isOpen,
  onClose,
  school,
}: ManageFeaturesModalProps) {
  const [features, setFeatures] = useState<SchoolFeatureSet>({
    billing: true,
    curriculum: true,
    knowledgeLibrary: true,
    admissions: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const updateFeatures = useMutation(
    "functions/platform/index:updateSchoolFeatures" as never
  );

  useEffect(() => {
    if (school) {
      setFeatures({
        billing: school.features?.billing ?? true,
        curriculum: school.features?.curriculum ?? true,
        knowledgeLibrary: school.features?.knowledgeLibrary ?? true,
        admissions: school.features?.admissions ?? false,
      });
    }
  }, [school]);

  if (!isOpen || !school) return null;

  const handleToggle = (key: keyof SchoolFeatureSet) => {
    setFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateFeatures({
        schoolId: school._id as never,
        features,
      } as never);

      appToast.success("Features updated", {
        description: `Modular features for ${school.name} were updated successfully.`,
      });
      onClose();
    } catch (err) {
      appToast.error("Failed to update features", {
        description: getErrorMessage(err, "An error occurred while saving features."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Manage School Modules</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure enabled workspaces and routes for <span className="font-semibold text-slate-700">{school.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-3.5 max-h-[65vh] overflow-y-auto">
          {PLATFORM_MODULE_DEFINITIONS.map((m) => {
            const isEnabled = features[m.key];
            return (
              <div
                key={m.key}
                onClick={() => handleToggle(m.key)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isEnabled
                    ? "border-indigo-200 bg-indigo-50/30 shadow-xs ring-1 ring-indigo-100"
                    : "border-slate-200 bg-white hover:bg-slate-50/80 opacity-75"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3.5 pr-4">
                    <div className="p-2 rounded-lg bg-white shadow-xs border border-slate-100 mt-0.5">
                      {getModuleIcon(m.iconName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{m.title}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{m.description}</p>
                    </div>
                  </div>

                  <div className="pt-0.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(m.key);
                      }}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? "bg-indigo-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Controlled Routes Strip */}
                <div className="mt-3 pt-2.5 border-t border-slate-100/80 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">
                    {isEnabled ? "Active Routes:" : "Hidden Routes:"}
                  </span>
                  {m.controlledRoutes.map((r) => (
                    <span
                      key={r.path}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        isEnabled
                          ? "bg-slate-100 text-slate-700 font-medium"
                          : "bg-slate-100/50 text-slate-400 line-through opacity-70"
                      }`}
                    >
                      <span className={`h-1 w-1 rounded-full ${isEnabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {r.label} ({r.path})
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Save Module Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
