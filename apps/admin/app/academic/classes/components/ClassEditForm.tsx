"use client";

import { useState, useEffect, useRef, useMemo, type SVGProps } from "react";
import { Layers3, ChevronDown, Archive, Save, X, Sparkles, BookOpen, Search, Check } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { humanNameTyping, humanNameFinal } from "@/human-name";
import { ClassAggregationManager } from "./ClassAggregationManager";

type Teacher = {
  _id: string;
  name: string;
  email: string;
};

type Subject = {
  _id: string;
  name: string;
  code: string;
};

type ClassOffering = {
  _id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherId?: string;
  teacherName?: string;
};

type ClassSummary = {
  _id: string;
  name: string;
  level: string;
  gradeName?: string;
  classLabel?: string;
  formTeacherId?: string;
  formTeacherName?: string;
  subjectNames: string[];
  studentCount: number;
  createdAt: number;
};

interface ClassEditFormProps {
  classDoc: ClassSummary;
  allSubjects: Subject[];
  allTeachers: Teacher[];
  currentOfferings?: ClassOffering[];
  onUpdate: (data: {
    gradeName: string;
    classLabel?: string;
    level: string;
    formTeacherId: string | null;
    subjectIds: string[];
  }) => Promise<void>;
  onArchive: () => void;
  onClose: () => void;
  onAssignTeacher: (subjectId: string, teacherId: string) => Promise<void>;
  onDirtyChange?: (isDirty: boolean) => void;
  isSaving: boolean;
  variant?: "sidebar" | "sheet";
  sessionName?: string;
}

export function ClassEditForm({
  classDoc,
  allSubjects,
  allTeachers,
  currentOfferings,
  onUpdate,
  onArchive,
  onClose,
  onAssignTeacher,
  onDirtyChange,
  isSaving,
  variant = "sidebar",
  sessionName,
}: ClassEditFormProps) {
  const [activeTab, setActiveTab] = useState<"blueprint" | "faculty" | "aggregates">("blueprint");
  const [gradeName, setGradeName] = useState("");
  const [classLabel, setClassLabel] = useState("");
  const [level, setLevel] = useState(classDoc.level || "Nursery");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");

  const initialGradeName = classDoc.gradeName || classDoc.name || "";
  const initialClassLabel = classDoc.classLabel || "";
  const initialLevel = classDoc.level || "Nursery";
  const initialFormTeacherId = classDoc.formTeacherId || "";
  const initialSubjectIds = useMemo(
    () => (currentOfferings?.map((offering) => offering.subjectId) ?? []).sort(),
    [currentOfferings]
  );

  const filteredSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    if (!query) return allSubjects;
    return allSubjects.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query)
    );
  }, [allSubjects, subjectSearch]);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    if (initialGradeName || initialClassLabel || initialFormTeacherId || initialLevel) {
      setGradeName(initialGradeName);
      setClassLabel(initialClassLabel);
      setLevel(initialLevel);
      setFormTeacherId(initialFormTeacherId);
      hasInitialized.current = true;
    }
  }, [initialGradeName, initialClassLabel, initialFormTeacherId, initialLevel]);

  useEffect(() => {
    if (hasInitialized.current) return;
    if (initialSubjectIds.length > 0) {
      setSubjectIds(initialSubjectIds);
    }
  }, [initialSubjectIds]);

  const isDirty = useMemo(() => {
    const gradeChanged = gradeName.trim() !== initialGradeName.trim();
    const labelChanged = classLabel.trim() !== initialClassLabel.trim();
    const levelChanged = level !== initialLevel;
    const teacherChanged = (formTeacherId || "") !== (initialFormTeacherId || "");
    const currentSorted = [...subjectIds].sort();
    const subjectsChanged =
      currentSorted.length !== initialSubjectIds.length ||
      currentSorted.some((id, i) => id !== initialSubjectIds[i]);
    return gradeChanged || labelChanged || levelChanged || teacherChanged || subjectsChanged;
  }, [gradeName, initialGradeName, classLabel, initialClassLabel, level, initialLevel, formTeacherId, initialFormTeacherId, subjectIds, initialSubjectIds]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSubjectToggle = (subjectId: string) => {
    setSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredSubjects.map((s) => s._id);
    setSubjectIds((current) => {
      const combined = new Set([...current, ...filteredIds]);
      return Array.from(combined);
    });
  };

  const handleClearAll = () => {
    setSubjectIds([]);
  };

  const handleDiscard = () => {
    setGradeName(initialGradeName);
    setClassLabel(initialClassLabel);
    setLevel(initialLevel);
    setFormTeacherId(initialFormTeacherId);
    setSubjectIds(initialSubjectIds);
    setSubjectSearch("");
  };

  const handleSave = async () => {
    const normalizedGradeName = humanNameFinal(gradeName);
    if (!normalizedGradeName) return;

    await onUpdate({
      gradeName: normalizedGradeName,
      classLabel: humanNameFinal(classLabel) || undefined,
      level,
      formTeacherId: formTeacherId || null,
      subjectIds,
    });
  };

  const tabs = [
    { id: "blueprint", label: "Blueprint", icon: <Layers3 className="h-3.5 w-3.5" /> },
    { id: "faculty", label: "Faculty", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { id: "aggregates", label: "Aggregates", icon: <Sparkles className="h-3.5 w-3.5" /> },
  ] as const;

  return (
    <div className={`flex flex-col h-full ${variant === "sheet" ? "pb-24 pt-2" : ""}`}>
      {variant === "sidebar" && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-md shadow-slate-950/20">
              <PencilIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xs font-bold tracking-tight text-slate-950 uppercase leading-none">
                  Edit Record
                </h3>
                {isDirty && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-bold tracking-wider animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Unsaved
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 truncate max-w-[170px]">
                {classDoc.name}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-950 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Mini-Tabs Navigation */}
      <div className="flex p-1 gap-1 my-3 bg-slate-100/50 rounded-xl border border-slate-200/50 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-white text-slate-950 shadow-xs ring-1 ring-slate-950/5"
                : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Scrollable Tab Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pr-0.5">
        {activeTab === "blueprint" && (
          <>
            {/* Core Configuration */}
            <AdminSurface intensity="medium" rounded="lg" className="p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-50 pb-1.5">
                <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-600">
                  Structure
                </label>
                <Sparkles className="h-3 w-3 text-cyan-300" />
              </div>
              
              <div className="grid gap-2.5">
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-0.5">Grade Name</p>
                  <input
                    required
                    value={gradeName}
                    onChange={(e) => setGradeName(e.target.value)}
                    onBlur={(e) => setGradeName(humanNameFinal(e.target.value))}
                    placeholder="Grade Designation"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight ml-0.5">Class Label</p>
                  <input
                    value={classLabel}
                    onChange={(e) => setClassLabel(e.target.value)}
                    onBlur={(e) => setClassLabel(humanNameFinal(e.target.value))}
                    placeholder="e.g. Olive Blossom"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between h-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                        Section / Level
                      </p>
                    </div>
                    <div className="relative">
                      <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                        className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-brand-primary cursor-pointer truncate pr-6"
                      >
                        <option value="Nursery">Nursery</option>
                        <option value="Primary">Primary</option>
                        <option value="Secondary">Secondary</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-300" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between h-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                        Form Teacher
                      </p>
                      {sessionName && (
                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[70px]">
                          {sessionName}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <select
                        value={formTeacherId}
                        onChange={(e) => setFormTeacherId(e.target.value)}
                        className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-brand-primary pr-6 truncate cursor-pointer"
                      >
                        <option value="">Unassigned</option>
                        {allTeachers.map((t) => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-300" />
                    </div>
                  </div>
                </div>
              </div>
            </AdminSurface>

            {/* Subject Offerings */}
            <AdminSurface intensity="medium" rounded="lg" className="p-3.5 space-y-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-900 block">
                    Subject Catalog
                  </label>
                  <p className="text-[10px] text-slate-400 font-medium">Assign subjects to this class</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-black tracking-tight">
                  {subjectIds.length} Selected
                </span>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  placeholder="Search subjects..."
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                />
                {subjectSearch && (
                  <button
                    type="button"
                    onClick={() => setSubjectSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Select Actions */}
              <div className="flex items-center justify-between text-[10px] px-0.5">
                <span className="text-slate-400 font-medium">
                  {filteredSubjects.length} of {allSubjects.length} subjects
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-[9px] font-bold uppercase tracking-wider text-brand-primary hover:underline cursor-pointer"
                  >
                    {subjectSearch ? "Select Matches" : "Select All"}
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={subjectIds.length === 0}
                    className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 disabled:opacity-40 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Subjects Grid */}
              <div className="min-h-[160px] max-h-[300px] overflow-y-auto px-1 -mx-1 grid grid-cols-1 gap-1.5 custom-scrollbar">
                {filteredSubjects.map((subject) => {
                  const isSelected = subjectIds.includes(subject._id);
                  return (
                    <button
                      key={subject._id}
                      type="button"
                      onClick={() => handleSubjectToggle(subject._id)}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold transition-all border cursor-pointer ${
                        isSelected
                          ? "border-brand-primary bg-brand-primary/10 text-brand-primary shadow-xs"
                          : "border-slate-100 bg-slate-50/70 text-slate-600 hover:border-slate-200 hover:bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="truncate block text-xs font-bold">{subject.name}</span>
                        {subject.code && (
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 block mt-0.5">
                            {subject.code}
                          </span>
                        )}
                      </div>
                      {isSelected ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-primary text-white shrink-0 shadow-xs">
                          <Check className="h-3 w-3 stroke-[2.5]" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-md border border-slate-200 bg-white shrink-0" />
                      )}
                    </button>
                  );
                })}

                {filteredSubjects.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-medium">No subjects found matching &ldquo;{subjectSearch}&rdquo;</p>
                    <button
                      type="button"
                      onClick={() => setSubjectSearch("")}
                      className="text-[10px] font-bold text-brand-primary hover:underline cursor-pointer"
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </div>
            </AdminSurface>
          </>
        )}

        {activeTab === "faculty" && (
          <AdminSurface intensity="medium" rounded="lg" className="p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-50 pb-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-600">
                Faculty Assignments
              </label>
              <BookOpen className="h-3.5 w-3.5 text-emerald-300" />
            </div>
            {currentOfferings && currentOfferings.length > 0 ? (
              <div className="space-y-2">
                {currentOfferings.map((offering) => (
                  <div
                    key={offering._id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1.5 transition-all hover:bg-white hover:border-slate-200 group"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-slate-700 truncate group-hover:text-slate-950">
                        {offering.subjectName}
                      </p>
                      <span className="text-[8px] font-black tracking-widest text-slate-300 uppercase">
                        {offering.subjectCode}
                      </span>
                    </div>
                    <div className="relative">
                      <select
                        value={offering.teacherId ?? ""}
                        onChange={(e) => void onAssignTeacher(offering.subjectId, e.target.value)}
                        className="h-8 w-full appearance-none rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-950 outline-none transition-all focus:border-brand-primary pr-6 truncate"
                      >
                        <option value="">No Instructor Assigned</option>
                        {allTeachers.map((t) => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center space-y-1 opacity-60">
                <Layers3 className="h-6 w-6 mx-auto text-slate-300" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Initialize Blueprint First</p>
              </div>
            )}
          </AdminSurface>
        )}

        {activeTab === "aggregates" && (
          <ClassAggregationManager
            classId={classDoc._id}
            offerings={currentOfferings}
          />
        )}
      </div>

      {/* Pinned Action Bar at the Bottom */}
      <div className="shrink-0 pt-3 mt-3 border-t border-slate-200/70 bg-white/90 backdrop-blur-xs space-y-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !gradeName.trim()}
          className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary text-white text-[10px] font-bold uppercase tracking-[0.15em] shadow-md transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 cursor-pointer ${
            isDirty ? "ring-2 ring-brand-primary ring-offset-1" : ""
          }`}
        >
          <Save className="h-3.5 w-3.5 text-white/80" />
          <span>{isSaving ? "Saving Changes..." : isDirty ? "Save Blueprint Changes" : "Update Blueprint"}</span>
        </button>

        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              className="flex-1 flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Discard Changes
            </button>
          )}
          <button
            type="button"
            onClick={onArchive}
            disabled={isSaving}
            className="flex-1 flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50/50 text-[9px] font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Archive className="h-3 w-3" />
            <span>Archive Record</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
