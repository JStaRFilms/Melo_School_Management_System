"use client";

import { useState, useEffect, useMemo } from "react";
import { Layers3, ChevronDown, Sparkles, Search, X, Check } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { humanNameTyping, humanNameFinal } from "@/human-name";

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

interface ClassCreationFormProps {
  onProvision: (data: {
    gradeName: string;
    classLabel?: string;
    level: string;
    formTeacherId: string | null;
    subjectIds: string[];
  }) => Promise<void>;
  isSubmitting: boolean;
  teachers: Teacher[];
  subjects: Subject[];
  initialLevel?: string;
  sessionName?: string;
}

export function ClassCreationForm({
  onProvision,
  isSubmitting,
  teachers,
  subjects,
  initialLevel = "Nursery",
  sessionName,
}: ClassCreationFormProps) {
  const [gradeName, setGradeName] = useState("");
  const [classLabel, setClassLabel] = useState("");
  const [level, setLevel] = useState(initialLevel);
  const [formTeacherId, setFormTeacherId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");

  useEffect(() => {
    if (initialLevel) {
      setLevel(initialLevel);
    }
  }, [initialLevel]);

  const filteredSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    if (!query) return subjects;
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query)
    );
  }, [subjects, subjectSearch]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedGradeName = humanNameFinal(gradeName);
    if (!normalizedGradeName) return;

    await onProvision({
      gradeName: normalizedGradeName,
      classLabel: humanNameFinal(classLabel) || undefined,
      level,
      formTeacherId: formTeacherId || null,
      subjectIds,
    });

    // Reset form
    setGradeName("");
    setClassLabel("");
    setLevel(initialLevel || "Nursery");
    setFormTeacherId("");
    setSubjectIds([]);
    setSubjectSearch("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary text-white shadow-md shadow-brand-primary/20">
            <Layers3 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-display text-xs font-bold tracking-tight text-slate-950 uppercase leading-none">
              Class Builder
            </h3>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
              Design Academic Blueprint
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 py-3 pr-0.5">
        {/* Core Info Surface */}
        <AdminSurface intensity="medium" rounded="lg" className="p-3.5 space-y-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
              Grade Designation *
            </label>
            <input
              required
              value={gradeName}
              onChange={(e) => setGradeName(e.target.value)}
              onBlur={(e) => setGradeName(humanNameFinal(e.target.value))}
              placeholder="e.g. Primary 4, JSS 2"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 placeholder:text-slate-300"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
              Class Label (Optional)
            </label>
            <input
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              onBlur={(e) => setClassLabel(humanNameFinal(e.target.value))}
              placeholder="e.g. Olive Blossom, Gold"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 placeholder:text-slate-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between h-4">
                <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 block">
                  Academic Level
                </label>
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
                <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 block">
                  Form Teacher
                </label>
                {sessionName && (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[80px]">
                    {sessionName}
                  </span>
                )}
              </div>
              <div className="relative">
                <select
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-brand-primary truncate pr-6 cursor-pointer"
                >
                  <option value="">No Assignment</option>
                  {teachers.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-300" />
              </div>
            </div>
          </div>
        </AdminSurface>

        {/* Initial Subject Offerings with Search */}
        <AdminSurface intensity="medium" rounded="lg" className="p-3.5 space-y-3 flex-1 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-900 block">
                Initial Subject Offerings
              </label>
              <p className="text-[10px] text-slate-400 font-medium">Select subjects taught in this class</p>
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
              {filteredSubjects.length} of {subjects.length} subjects
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

          {/* Subjects List */}
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
      </div>

      {/* Pinned Bottom Action Bar */}
      <div className="shrink-0 pt-3 border-t border-slate-200/70 bg-white/90 backdrop-blur-xs">
        <button
          type="submit"
          disabled={isSubmitting || !gradeName.trim()}
          className="group relative flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary text-white text-[10px] font-bold uppercase tracking-[0.15em] shadow-md transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
        >
          <span>
            {isSubmitting ? "Building..." : "Save Class Blueprint"}
          </span>
        </button>
      </div>
    </form>
  );
}

