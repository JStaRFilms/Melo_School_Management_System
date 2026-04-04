"use client";

import { useState, useEffect, type SVGProps } from "react";
import { Layers3, ChevronDown, Archive, Save, X, Sparkles, BookOpen } from "lucide-react";
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
    formTeacherId: string | null;
    subjectIds: string[];
  }) => Promise<void>;
  onArchive: () => void;
  onClose: () => void;
  onAssignTeacher: (subjectId: string, teacherId: string) => Promise<void>;
  isSaving: boolean;
  variant?: "sidebar" | "sheet";
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
  isSaving,
  variant = "sidebar",
}: ClassEditFormProps) {
  const [activeTab, setActiveTab] = useState<"blueprint" | "faculty" | "aggregates">("blueprint");
  const [gradeName, setGradeName] = useState("");
  const [classLabel, setClassLabel] = useState("");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);

  useEffect(() => {
    setGradeName(classDoc.gradeName || classDoc.name);
    setClassLabel(classDoc.classLabel || "");
    setFormTeacherId(classDoc.formTeacherId || "");
  }, [classDoc]);

  useEffect(() => {
    setSubjectIds(currentOfferings?.map((offering) => offering.subjectId) ?? []);
  }, [classDoc._id, currentOfferings]);

  const handleSubjectToggle = (subjectId: string) => {
    setSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId]
    );
  };

  const handleSave = async () => {
    const normalizedGradeName = humanNameFinal(gradeName);
    if (!normalizedGradeName) return;

    await onUpdate({
      gradeName: normalizedGradeName,
      classLabel: humanNameFinal(classLabel) || undefined,
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
    <div className={`space-y-5 ${variant === "sheet" ? "pb-24 pt-2" : ""}`}>
      {variant === "sidebar" && (
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-xl shadow-slate-950/20">
              <PencilIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold tracking-tight text-slate-950 uppercase leading-none">
                Edit Record
              </h3>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {classDoc.name}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-50 transition-colors text-slate-300 hover:text-slate-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Mini-Tabs Navigation */}
      <div className="flex p-1 gap-1 bg-slate-100/50 rounded-xl border border-slate-200/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5"
                : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {activeTab === "blueprint" && (
          <>
            {/* Core Configuration */}
            <AdminSurface intensity="medium" rounded="lg" className="p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600">
                    Structure
                  </label>
                  <Sparkles className="h-3 w-3 text-cyan-200" />
              </div>
              
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter ml-1">Grade Name</p>
                  <input
                    required
                    value={gradeName}
                    onChange={(e) => setGradeName(humanNameTyping(e.target.value))}
                    onBlur={(e) => setGradeName(humanNameFinal(e.target.value))}
                    placeholder="Grade Designation"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter ml-1">Class Label</p>
                  <input
                    value={classLabel}
                    onChange={(e) => setClassLabel(humanNameTyping(e.target.value))}
                    onBlur={(e) => setClassLabel(humanNameFinal(e.target.value))}
                    placeholder="e.g. Olive Blossom"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                  />
                </div>

                <div className="space-y-1.5">
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter ml-1">Form Teacher</p>
                  <div className="relative">
                    <select
                      value={formTeacherId}
                      onChange={(e) => setFormTeacherId(e.target.value)}
                      className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950"
                    >
                      <option value="">Unassigned</option>
                      {allTeachers.map((t) => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-300" />
                  </div>
                </div>
              </div>
            </AdminSurface>

            {/* Subject Offerings */}
            <AdminSurface intensity="medium" rounded="lg" className="p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
                    Subject Catalog
                  </label>
                  <div className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[9px] font-bold">{subjectIds.length} Selected</div>
              </div>
              <div className="max-h-[350px] overflow-y-auto px-1 -mx-1 grid grid-cols-2 gap-2 custom-scrollbar">
                {allSubjects.map((subject) => {
                  const isSelected = subjectIds.includes(subject._id);
                  return (
                    <button
                      key={subject._id}
                      type="button"
                      onClick={() => handleSubjectToggle(subject._id)}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[11px] font-bold transition-all border ${
                        isSelected
                          ? "border-slate-950 bg-slate-950/5 text-slate-950"
                          : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                      }`}
                    >
                      <span className="truncate">{subject.name}</span>
                      {isSelected && <Sparkles className="h-3 w-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={handleSave}
                disabled={isSaving || !gradeName.trim()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-white text-[11px] font-bold uppercase tracking-[0.2em] shadow-xl shadow-slate-950/10 transition-all hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50"
              >
                <Save className="h-4 w-4 text-white/50" />
                {isSaving ? "Syncing..." : "Update Blueprint"}
              </button>
            </AdminSurface>
          </>
        )}

        {activeTab === "faculty" && (
          <AdminSurface intensity="medium" rounded="lg" className="p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                  Faculty Assignments
                </label>
                <BookOpen className="h-3.5 w-3.5 text-emerald-200" />
            </div>
            {currentOfferings && currentOfferings.length > 0 ? (
              <div className="space-y-2">
                {currentOfferings.map((offering) => (
                  <div
                    key={offering._id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2.5 transition-all hover:bg-white hover:border-slate-200 hover:shadow-sm group"
                  >
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-700 truncate group-hover:text-slate-950">
                          {offering.subjectName}
                        </p>
                        <span className="text-[8px] font-black tracking-widest text-slate-300 uppercase italic">
                           {offering.subjectCode}
                        </span>
                    </div>
                    <div className="relative">
                      <select
                        value={offering.teacherId ?? ""}
                        onChange={(e) => void onAssignTeacher(offering.subjectId, e.target.value)}
                        className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-950 outline-none transition-all focus:border-slate-950"
                      >
                        {allTeachers.map((t) => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center space-y-2 opacity-50">
                <Layers3 className="h-8 w-8 mx-auto text-slate-200" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Initialize Blueprint First</p>
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

      {/* System Actions */}
      <div className="pt-4 border-t border-slate-100 flex gap-3">
        <button
          type="button"
          onClick={onArchive}
          disabled={isSaving}
          className="flex-1 flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-100 bg-rose-50/50 text-[9px] font-black uppercase tracking-[0.2em] text-rose-500 hover:bg-rose-100 transition-colors disabled:opacity-50"
        >
          <Archive className="h-3.5 w-3.5" />
          Archive Record
        </button>
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
