"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@school/convex/_generated/api";
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

function getWorkspaceBadge(workspace: "Admin" | "Teacher" | "Portal" | "Public") {
  switch (workspace) {
    case "Admin":
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/70 shrink-0 whitespace-nowrap">Admin</span>;
    case "Teacher":
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200/70 shrink-0 whitespace-nowrap">Teacher</span>;
    case "Portal":
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0 whitespace-nowrap">Portal</span>;
    case "Public":
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/70 shrink-0 whitespace-nowrap">Public</span>;
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
    api.functions.platform.index.updateSchoolFeatures
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
        schoolId: school._id,
        features,
      });

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
                {/* Top Row: Icon, Title, Badge & Switch */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-white shadow-xs border border-slate-100 shrink-0">
                      {getModuleIcon(m.iconName)}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-sm font-bold text-slate-900 leading-tight">{m.title}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 shrink-0 whitespace-nowrap border border-slate-200/60">
                        {m.badge}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
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

                {/* Full-width Description */}
                <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">{m.description}</p>

                {/* Controlled Routes Grid */}
                <div className="mt-3 pt-2.5 border-t border-slate-100/80 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {isEnabled ? "Controlled Workspaces & Routes:" : "Disabled Routes (Hidden from Sidebar):"}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {m.controlledRoutes.map((r) => (
                      <div
                        key={r.path}
                        className={`flex items-center gap-2 p-1.5 px-2 rounded-lg text-[10px] min-w-0 transition-colors ${
                          isEnabled
                            ? "bg-white text-slate-800 border border-slate-200/80 shadow-2xs"
                            : "bg-slate-100/50 text-slate-400 line-through opacity-70 border border-slate-200/40"
                        }`}
                      >
                        <div className="shrink-0">{getWorkspaceBadge(r.workspace)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 truncate leading-tight">{r.label}</div>
                          <div className="font-mono text-[9px] text-slate-400 truncate">{r.path}</div>
                        </div>
                      </div>
                    ))}
                  </div>
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
