"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import {
  BookOpenText,
  Check,
  ChevronDown,
  GraduationCap,
  Landmark,
  Loader2,
  LockKeyhole,
  Settings2,
  Sparkles,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { appToast, getErrorMessage } from "@school/shared/toast";
import {
  PLATFORM_CORE_AREAS,
  PLATFORM_MODULE_DEFINITIONS,
  resolveSchoolModuleFeatures,
  type ControlledRoute,
  type PlatformModuleDefinition,
  type ProductModuleKey,
  type ResolvedSchoolModuleFeatures,
} from "@school/shared";

export type SchoolFeatureSet = ResolvedSchoolModuleFeatures;

export interface ManageFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: {
    _id: string;
    name: string;
    features: SchoolFeatureSet;
  } | null;
}

const coreIcons = {
  operations: UsersRound,
  assessment: GraduationCap,
  administration: Settings2,
} as const;

function getModuleIcon(iconName: PlatformModuleDefinition["iconName"]) {
  const className = "h-5 w-5";
  switch (iconName) {
    case "Landmark":
      return <Landmark aria-hidden="true" className={`${className} text-emerald-700`} />;
    case "BookOpenText":
      return <BookOpenText aria-hidden="true" className={`${className} text-indigo-700`} />;
    case "Sparkles":
      return <Sparkles aria-hidden="true" className={`${className} text-amber-600`} />;
    case "UserPlus":
      return <UserPlus aria-hidden="true" className={`${className} text-blue-700`} />;
    case "UsersRound":
      return <UsersRound aria-hidden="true" className={`${className} text-violet-700`} />;
  }
}

function WorkspaceBadge({ workspace }: { workspace: ControlledRoute["workspace"] }) {
  const styles = {
    Admin: "border-blue-200 bg-blue-50 text-blue-700",
    Teacher: "border-purple-200 bg-purple-50 text-purple-700",
    Portal: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Public: "border-amber-200 bg-amber-50 text-amber-700",
  }[workspace];

  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${styles}`}>
      {workspace}
    </span>
  );
}

function RouteGroups({ routes }: { routes: ControlledRoute[] }) {
  const groupedRoutes = useMemo(() => {
    const groups = new Map<string, ControlledRoute[]>();
    for (const route of routes) {
      groups.set(route.group, [...(groups.get(route.group) ?? []), route]);
    }
    return [...groups.entries()];
  }, [routes]);

  return (
    <div className="space-y-3">
      {groupedRoutes.map(([group, groupRoutes]) => (
        <section key={group} aria-label={group}>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {group}
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {groupRoutes.map((route) => (
              <div
                key={`${route.workspace}:${route.path}`}
                className="flex min-w-0 items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
              >
                <WorkspaceBadge workspace={route.workspace} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold leading-tight text-slate-800">
                    {route.label}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-slate-400">
                    {route.path}
                  </p>
                  {route.requires ? (
                    <p className="mt-1 text-[10px] text-slate-500">
                      Also requires {PLATFORM_MODULE_DEFINITIONS.find((module) => module.key === route.requires)?.shortTitle}.
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ManageFeaturesModal({
  isOpen,
  onClose,
  school,
}: ManageFeaturesModalProps) {
  const [features, setFeatures] = useState<SchoolFeatureSet>(() =>
    resolveSchoolModuleFeatures(school?.features),
  );
  const [initialFeatures, setInitialFeatures] = useState<SchoolFeatureSet>(() =>
    resolveSchoolModuleFeatures(school?.features),
  );
  const [isSaving, setIsSaving] = useState(false);

  const updateFeatures = useMutation(
    "functions/platform/index:updateSchoolFeatures" as never,
  );

  useEffect(() => {
    if (!school) return;
    const resolved = resolveSchoolModuleFeatures(school.features);
    setFeatures(resolved);
    setInitialFeatures(resolved);
  }, [school]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  const changedKeys = PLATFORM_MODULE_DEFINITIONS
    .map((module) => module.key)
    .filter((key) => features[key] !== initialFeatures[key]);

  if (!isOpen || !school) return null;

  const handleToggle = (key: ProductModuleKey) => {
    setFeatures((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateFeatures({
        schoolId: school._id as never,
        features,
      } as never);

      appToast.success("Module access updated", {
        description: `${school.name} now has the selected module access.`,
      });
      onClose();
    } catch (error) {
      appToast.error("Could not update module access", {
        description: getErrorMessage(error, "Review the selections and try again."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close module settings"
        className="fixed inset-0 cursor-default bg-slate-950/45 backdrop-blur-sm"
        onClick={isSaving ? undefined : onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-settings-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="module-settings-title" className="text-base font-bold text-slate-950">
              Module access
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Choose the optional products available to <span className="font-semibold text-slate-700">{school.name}</span>. Staff permissions still control what each person can do.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <section aria-labelledby="included-title" className="rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600">
                <LockKeyhole aria-hidden="true" className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="included-title" className="text-sm font-bold text-slate-900">
                    Included with every school
                  </h3>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    Always on
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Core records, assessments, administration, and school groups are not paywalled.
                </p>
              </div>
            </div>
            <div className="divide-y divide-slate-200">
              {PLATFORM_CORE_AREAS.map((area) => {
                const Icon = coreIcons[area.key];
                return (
                  <details key={area.key} className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">{area.title}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{area.description}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {area.controlledRoutes.length} pages
                      </span>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <div className="pb-1 pl-7 pt-3">
                      <RouteGroups routes={area.controlledRoutes} />
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="optional-title" className="mt-6">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h3 id="optional-title" className="text-sm font-bold text-slate-900">
                  Optional modules
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  These selections are manual now and can map to subscription plans later.
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                {PLATFORM_MODULE_DEFINITIONS.filter((module) => features[module.key]).length} of {PLATFORM_MODULE_DEFINITIONS.length} enabled
              </span>
            </div>

            <div className="space-y-2.5">
              {PLATFORM_MODULE_DEFINITIONS.map((module) => {
                const isEnabled = features[module.key];
                return (
                  <article
                    key={module.key}
                    className={`rounded-xl border transition-colors ${
                      isEnabled ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <div className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 shadow-xs">
                        {getModuleIcon(module.iconName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{module.title}</h4>
                          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {module.badge}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{module.description}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <button
                          type="button"
                          role="switch"
                          aria-label={`${module.title}: ${isEnabled ? "enabled" : "disabled"}`}
                          aria-checked={isEnabled}
                          onClick={() => handleToggle(module.key)}
                          className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                            isEnabled ? "bg-indigo-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                              isEnabled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <span className={`text-[10px] font-bold ${isEnabled ? "text-indigo-700" : "text-slate-500"}`}>
                          {isEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>

                    <details className="group border-t border-slate-200/80 px-4 py-2.5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                        <span>View affected pages</span>
                        <span className="flex items-center gap-2 text-slate-400">
                          {module.controlledRoutes.length} pages
                          <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                        </span>
                      </summary>
                      <div className="pb-1 pt-3">
                        <RouteGroups routes={module.controlledRoutes} />
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <p className="text-[11px] text-slate-500" role="status">
            {changedKeys.length === 0
              ? "No unsaved changes"
              : `${changedKeys.length} module ${changedKeys.length === 1 ? "change" : "changes"} ready to save`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg px-3.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || changedKeys.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSaving ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <Check aria-hidden="true" className="h-3.5 w-3.5" />}
              {isSaving ? "Saving…" : "Save access"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
