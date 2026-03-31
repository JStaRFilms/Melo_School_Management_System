"use client";

import { useMemo, useState } from "react";
import { Layers3, ChevronDown, Sparkles } from "lucide-react";
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
}

export function ClassCreationForm({
  onProvision,
  isSubmitting,
  teachers,
  subjects,
}: ClassCreationFormProps) {
  const [gradeName, setGradeName] = useState("");
  const [classLabel, setClassLabel] = useState("");
  const [level, setLevel] = useState("Primary");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);

  const handleSubjectToggle = (subjectId: string) => {
    setSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId]
    );
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
    setLevel("Primary");
    setFormTeacherId("");
    setSubjectIds([]);
  };

  return (
    <AdminSurface
      as="section"
      intensity="medium"
      rounded="lg"
      className="p-5 space-y-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-xl shadow-slate-950/20">
          <Layers3 className="h-5 w-5" />
        </div>
        <div className="text-right">
          <h3 className="font-display text-sm font-bold tracking-tight text-slate-950 uppercase leading-none">
            Class Builder
          </h3>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Design Academic Blueprint
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Grade Designation
            </label>
            <input
              required
              value={gradeName}
              onChange={(e) => setGradeName(humanNameTyping(e.target.value))}
              onBlur={(e) => setGradeName(humanNameFinal(e.target.value))}
              placeholder="e.g. Primary 4"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Class Label (Optional)
            </label>
            <input
              value={classLabel}
              onChange={(e) => setClassLabel(humanNameTyping(e.target.value))}
              onBlur={(e) => setClassLabel(humanNameFinal(e.target.value))}
              placeholder="e.g. Olive Blossom"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Academic Level
              </label>
              <div className="relative">
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950"
                >
                  <option value="Nursery">Nursery</option>
                  <option value="Primary">Primary</option>
                  <option value="Secondary">Secondary</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-300" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Form Teacher
              </label>
              <div className="relative">
                <select
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950"
                >
                  <option value="">No Assignment</option>
                  {teachers.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-300" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2">
           <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 block mb-1.5">
            Initial Subject Offerings
          </label>
          <div className="max-h-[200px] overflow-y-auto px-1 -mx-1 grid grid-cols-1 gap-2">
            {subjects.map((subject) => {
              const isSelected = subjectIds.includes(subject._id);
              return (
                <button
                  key={subject._id}
                  type="button"
                  onClick={() => handleSubjectToggle(subject._id)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold transition-all border ${
                    isSelected
                      ? "border-slate-950 bg-slate-950/5 text-slate-950"
                      : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                  }`}
                >
                  <span>{subject.name}</span>
                  {isSelected && <Sparkles className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !gradeName.trim()}
          className="group relative h-12 w-full overflow-hidden rounded-xl bg-slate-950 text-white shadow-xl transition-all hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em]">
              {isSubmitting ? "Building..." : "Save Class Blueprint"}
            </span>
          </div>
        </button>
      </form>
    </AdminSurface>
  );
}
