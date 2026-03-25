"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  Layers3,
  LayoutGrid,
  Plus,
  Users2,
} from "lucide-react";
import { humanNameFinal, humanNameTyping } from "@/human-name";

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

type Subject = {
  _id: string;
  name: string;
  code: string;
};

type Teacher = {
  _id: string;
  name: string;
  email: string;
};

type ClassOffering = {
  _id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherId?: string;
  teacherName?: string;
};

export default function ClassesPage() {
  const classes = useQuery(
    "functions/academic/academicSetup:listClasses" as never
  ) as ClassSummary[] | undefined;

  const subjects = useQuery(
    "functions/academic/academicSetup:listSubjects" as never
  ) as Subject[] | undefined;

  const teachers = useQuery(
    "functions/academic/academicSetup:listTeachers" as never
  ) as Teacher[] | undefined;

  const createClass = useMutation(
    "functions/academic/academicSetup:createClass" as never
  );
  const backfillClassNaming = useMutation(
    "functions/academic/academicSetup:backfillClassNaming" as never
  );
  const updateClass = useMutation(
    "functions/academic/academicSetup:updateClass" as never
  );
  const setClassSubjects = useMutation(
    "functions/academic/academicSetup:setClassSubjects" as never
  );
  const assignTeacherToClassSubject = useMutation(
    "functions/academic/academicSetup:assignTeacherToClassSubject" as never
  );

  const [builderGradeName, setBuilderGradeName] = useState("");
  const [builderClassLabel, setBuilderClassLabel] = useState("");
  const [level, setLevel] = useState("Primary");
  const [builderFormTeacherId, setBuilderFormTeacherId] = useState("");
  const [builderSubjectIds, setBuilderSubjectIds] = useState<string[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedGradeName, setSelectedGradeName] = useState("");
  const [selectedClassLabel, setSelectedClassLabel] = useState("");
  const [selectedFormTeacherId, setSelectedFormTeacherId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingClassConfig, setIsSavingClassConfig] = useState(false);
  const [hasRequestedBackfill, setHasRequestedBackfill] = useState(false);

  const currentClass = useMemo(
    () => classes?.find((classDoc) => classDoc._id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const currentOfferings = useQuery(
    "functions/academic/academicSetup:getClassSubjects" as never,
    selectedClassId ? ({ classId: selectedClassId } as never) : ("skip" as never)
  ) as ClassOffering[] | undefined;

  useEffect(() => {
    if (!currentClass) {
      setSelectedGradeName("");
      setSelectedClassLabel("");
      setSelectedFormTeacherId("");
      setSelectedSubjectIds([]);
      return;
    }

    setSelectedGradeName(currentClass.gradeName ?? currentClass.name);
    setSelectedClassLabel(currentClass.classLabel ?? "");
    setSelectedFormTeacherId(currentClass.formTeacherId ?? "");
  }, [currentClass]);

  useEffect(() => {
    if (!classes || classes.length === 0 || hasRequestedBackfill) {
      return;
    }

    void backfillClassNaming({} as never);
    setHasRequestedBackfill(true);
  }, [backfillClassNaming, classes, hasRequestedBackfill]);

  useEffect(() => {
    if (!currentOfferings) {
      return;
    }

    setSelectedSubjectIds(currentOfferings.map((offering) => offering.subjectId));
  }, [currentOfferings]);

  const primaryClasses =
    classes?.filter((classDoc) => classDoc.level === "Primary") ?? [];
  const secondaryClasses =
    classes?.filter((classDoc) => classDoc.level === "Secondary") ?? [];

  const handleBuilderSubjectToggle = (subjectId: string) => {
    setBuilderSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId]
    );
  };

  const handleSelectedSubjectToggle = (subjectId: string) => {
    setSelectedSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId]
    );
  };

  const resetFlash = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleCreateClass = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedGradeName = humanNameFinal(builderGradeName);
    const normalizedClassLabel = humanNameFinal(builderClassLabel);
    if (!normalizedGradeName) {
      return;
    }

    resetFlash();
    setIsSubmitting(true);

    try {
      const classId = (await createClass({
        gradeName: normalizedGradeName,
        classLabel: normalizedClassLabel || undefined,
        level,
        formTeacherId: builderFormTeacherId || null,
      } as never)) as string;

      if (builderSubjectIds.length > 0) {
        await setClassSubjects({
          classId,
          subjectIds: builderSubjectIds,
        } as never);
      }

      setBuilderGradeName("");
      setBuilderClassLabel("");
      setLevel("Primary");
      setBuilderFormTeacherId("");
      setBuilderSubjectIds([]);
      setSuccessMessage("Class blueprint saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveClassConfig = async () => {
    if (!selectedClassId || !currentClass) {
      return;
    }

    const normalizedGradeName = humanNameFinal(
      selectedGradeName ?? currentClass.gradeName ?? currentClass.name
    );
    const normalizedClassLabel = humanNameFinal(selectedClassLabel ?? "");
    if (!normalizedGradeName) {
      setError("Class grade name is required");
      return;
    }

    resetFlash();
    setIsSavingClassConfig(true);

    try {
      await updateClass({
        classId: selectedClassId,
        gradeName: normalizedGradeName,
        classLabel: normalizedClassLabel || null,
        formTeacherId: selectedFormTeacherId || null,
      } as never);
      await setClassSubjects({
        classId: selectedClassId,
        subjectIds: selectedSubjectIds,
      } as never);
      setSuccessMessage("Class configuration updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save class blueprint"
      );
    } finally {
      setIsSavingClassConfig(false);
    }
  };

  const handleAssignTeacher = async (classId: string, subjectId: string, teacherId: string) => {
    if (!teacherId) {
      return;
    }

    resetFlash();

    try {
      await assignTeacherToClassSubject({
        classId,
        subjectId,
        teacherId,
      } as never);
      setSuccessMessage("Subject teacher assignment saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to assign subject teacher"
      );
    }
  };

  const scrollToBuilder = () => {
    document.getElementById("class-builder")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (classes === undefined || subjects === undefined || teachers === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
        <div className="text-[#64748b]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-8 pb-32">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section
        id="class-builder"
        className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#0f172a]">
              Class Builder
            </h2>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-tight text-[#94a3b8]">
              Create class and define subject offerings
            </p>
          </div>
          <span className="rounded-full border border-[#4f46e5]/20 bg-[#4f46e5]/10 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.15em] text-[#4f46e5]">
            Step 2 of Setup
          </span>
        </div>

        <form onSubmit={handleCreateClass} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <LabeledInput
              label="Grade Name"
              value={builderGradeName}
              onChange={(value) => setBuilderGradeName(humanNameTyping(value))}
              onBlur={(value) => setBuilderGradeName(humanNameFinal(value))}
              placeholder="Primary 4"
            />

            <LabeledInput
              label="Class Label"
              value={builderClassLabel}
              onChange={(value) => setBuilderClassLabel(humanNameTyping(value))}
              onBlur={(value) => setBuilderClassLabel(humanNameFinal(value))}
              placeholder="Olive Blossom"
              required={false}
            />

            <div>
              <label className="mb-1 block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
                Section
              </label>
              <select
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                className="h-10 w-full rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
              >
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
                Form Teacher
              </label>
              <div className="relative">
                <select
                  value={builderFormTeacherId}
                  onChange={(event) => setBuilderFormTeacherId(event.target.value)}
                  className="h-10 w-full appearance-none rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 pr-10 text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
                >
                  <option value="">Assign Later</option>
                  {teachers.map((teacher) => (
                    <option key={teacher._id} value={teacher._id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#cbd5e1]" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
              Subject Offerings
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {subjects.map((subject) => {
                const isSelected = builderSubjectIds.includes(subject._id);
                return (
                  <button
                    key={subject._id}
                    type="button"
                    onClick={() => handleBuilderSubjectToggle(subject._id)}
                    className={`rounded-lg px-3 py-2 text-left text-xs font-bold transition-all ${
                      isSelected
                        ? "border-2 border-[#4f46e5] bg-[#4f46e5]/10 text-[#4f46e5]"
                        : "border border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#cbd5e1]"
                    }`}
                  >
                    {subject.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !builderGradeName.trim()}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#4f46e5] px-4 text-xs font-bold uppercase tracking-[0.025em] text-white shadow-lg shadow-[#4f46e5]/10 transition-all hover:bg-[#4338ca] disabled:opacity-50"
            >
              <Layers3 className="h-3.5 w-3.5 text-white/50" />
              {isSubmitting ? "Creating..." : "Save Class Blueprint"}
            </button>
          </div>
        </form>
      </section>

      <ClassSection
        title="Primary Section"
        accent="P"
        accentClass="bg-blue-100 text-blue-600"
        emptyLabel="Initialize Primary Classes"
        classes={primaryClasses}
        subjects={subjects}
        teachers={teachers}
        selectedClassId={selectedClassId}
        selectedGradeName={selectedGradeName}
        selectedClassLabel={selectedClassLabel}
        selectedSubjectIds={selectedSubjectIds}
        selectedFormTeacherId={selectedFormTeacherId}
        currentOfferings={currentOfferings}
        setSelectedClassId={setSelectedClassId}
        setSelectedGradeName={setSelectedGradeName}
        setSelectedClassLabel={setSelectedClassLabel}
        setSelectedFormTeacherId={setSelectedFormTeacherId}
        onToggleSubject={handleSelectedSubjectToggle}
        onSaveClassConfig={handleSaveClassConfig}
        onAssignTeacher={handleAssignTeacher}
        onRequestCreate={scrollToBuilder}
        isSavingClassConfig={isSavingClassConfig}
      />

      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-8">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-[#4f46e5]/10 text-[10px] font-bold text-[#4f46e5]">
              S
            </span>
            <h2 className="text-xs font-black uppercase tracking-[0.15em] text-[#0f172a]">
              Secondary Section
            </h2>
          </div>
        </div>

        <ClassGrid
          emptyLabel="Initialize Secondary Classes"
          classes={secondaryClasses}
          subjects={subjects}
          teachers={teachers}
          selectedClassId={selectedClassId}
          selectedGradeName={selectedGradeName}
          selectedClassLabel={selectedClassLabel}
          selectedSubjectIds={selectedSubjectIds}
          selectedFormTeacherId={selectedFormTeacherId}
          currentOfferings={currentOfferings}
          setSelectedClassId={setSelectedClassId}
          setSelectedGradeName={setSelectedGradeName}
          setSelectedClassLabel={setSelectedClassLabel}
          setSelectedFormTeacherId={setSelectedFormTeacherId}
          onToggleSubject={handleSelectedSubjectToggle}
          onSaveClassConfig={handleSaveClassConfig}
          onAssignTeacher={handleAssignTeacher}
          isSavingClassConfig={isSavingClassConfig}
        />
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 border-t border-[#f1f5f9] bg-white p-4 sm:justify-end sm:p-6">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-tighter text-[#0f172a] italic">
            System/Structure v2.1
          </span>
          <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-[#94a3b8] italic">
            {classes.length} Classes • {subjects.length} Subjects
          </span>
        </div>
        <button className="h-12 rounded-xl bg-[#0f172a] px-10 text-[11px] font-bold uppercase tracking-[0.15em] text-white shadow-xl transition-all hover:bg-[#1e293b]">
          Audit Archive
        </button>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur?.(event.target.value)}
        className="h-10 w-full rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function ClassSection({
  title,
  accent,
  accentClass,
  emptyLabel,
  classes,
  subjects,
  teachers,
  selectedClassId,
  selectedGradeName,
  selectedClassLabel,
  selectedSubjectIds,
  selectedFormTeacherId,
  currentOfferings,
  setSelectedClassId,
  setSelectedGradeName,
  setSelectedClassLabel,
  setSelectedFormTeacherId,
  onToggleSubject,
  onSaveClassConfig,
  onAssignTeacher,
  onRequestCreate,
  isSavingClassConfig,
}: {
  title: string;
  accent: string;
  accentClass: string;
  emptyLabel: string;
  classes: ClassSummary[];
  subjects: Subject[];
  teachers: Teacher[];
  selectedClassId: string | null;
  selectedGradeName: string;
  selectedClassLabel: string;
  selectedSubjectIds: string[];
  selectedFormTeacherId: string;
  currentOfferings: ClassOffering[] | undefined;
  setSelectedClassId: (value: string | null) => void;
  setSelectedGradeName: (value: string) => void;
  setSelectedClassLabel: (value: string) => void;
  setSelectedFormTeacherId: (value: string) => void;
  onToggleSubject: (subjectId: string) => void;
  onSaveClassConfig: () => Promise<void>;
  onAssignTeacher: (classId: string, subjectId: string, teacherId: string) => Promise<void>;
  onRequestCreate: () => void;
  isSavingClassConfig: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold ${accentClass}`}>
            {accent}
          </span>
          <h2 className="text-xs font-black uppercase tracking-[0.15em] text-[#0f172a]">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onRequestCreate}
          className="flex h-10 items-center gap-2 rounded-lg bg-[#0f172a] px-4 text-xs font-bold uppercase tracking-[0.025em] text-white shadow-xl shadow-[#e2e8f0] transition-all hover:bg-[#1e293b]"
        >
          <Plus className="h-3.5 w-3.5 text-white/40" />
          New Class
        </button>
      </div>

      <ClassGrid
        emptyLabel={emptyLabel}
        classes={classes}
        subjects={subjects}
        teachers={teachers}
        selectedClassId={selectedClassId}
        selectedGradeName={selectedGradeName}
        selectedClassLabel={selectedClassLabel}
        selectedSubjectIds={selectedSubjectIds}
        selectedFormTeacherId={selectedFormTeacherId}
        currentOfferings={currentOfferings}
        setSelectedClassId={setSelectedClassId}
        setSelectedGradeName={setSelectedGradeName}
        setSelectedClassLabel={setSelectedClassLabel}
        setSelectedFormTeacherId={setSelectedFormTeacherId}
        onToggleSubject={onToggleSubject}
        onSaveClassConfig={onSaveClassConfig}
        onAssignTeacher={onAssignTeacher}
        isSavingClassConfig={isSavingClassConfig}
      />
    </section>
  );
}

function ClassGrid({
  emptyLabel,
  classes,
  subjects,
  teachers,
  selectedClassId,
  selectedGradeName,
  selectedClassLabel,
  selectedSubjectIds,
  selectedFormTeacherId,
  currentOfferings,
  setSelectedClassId,
  setSelectedGradeName,
  setSelectedClassLabel,
  setSelectedFormTeacherId,
  onToggleSubject,
  onSaveClassConfig,
  onAssignTeacher,
  isSavingClassConfig,
}: {
  emptyLabel: string;
  classes: ClassSummary[];
  subjects: Subject[];
  teachers: Teacher[];
  selectedClassId: string | null;
  selectedGradeName: string;
  selectedClassLabel: string;
  selectedSubjectIds: string[];
  selectedFormTeacherId: string;
  currentOfferings: ClassOffering[] | undefined;
  setSelectedClassId: (value: string | null) => void;
  setSelectedGradeName: (value: string) => void;
  setSelectedClassLabel: (value: string) => void;
  setSelectedFormTeacherId: (value: string) => void;
  onToggleSubject: (subjectId: string) => void;
  onSaveClassConfig: () => Promise<void>;
  onAssignTeacher: (classId: string, subjectId: string, teacherId: string) => Promise<void>;
  isSavingClassConfig: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {classes.length === 0 ? (
        <div className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] bg-white p-5 opacity-40 transition-opacity hover:opacity-100">
          <LayoutGrid className="mb-3 h-8 w-8 text-[#e2e8f0]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
            {emptyLabel}
          </span>
        </div>
      ) : null}

      {classes.map((classDoc) => (
        <ClassCard
          key={classDoc._id}
          classDoc={classDoc}
          subjects={subjects}
          teachers={teachers}
          isSelected={selectedClassId === classDoc._id}
          selectedGradeName={selectedGradeName}
          selectedClassLabel={selectedClassLabel}
          selectedSubjectIds={selectedSubjectIds}
          selectedFormTeacherId={selectedFormTeacherId}
          currentOfferings={selectedClassId === classDoc._id ? currentOfferings : undefined}
          onSelect={() => setSelectedClassId(classDoc._id)}
          onCancel={() => setSelectedClassId(null)}
          onGradeNameChange={setSelectedGradeName}
          onClassLabelChange={setSelectedClassLabel}
          onFormTeacherChange={setSelectedFormTeacherId}
          onToggleSubject={onToggleSubject}
          onSaveClassConfig={onSaveClassConfig}
          onAssignTeacher={onAssignTeacher}
          isSavingClassConfig={isSavingClassConfig}
        />
      ))}
    </div>
  );
}

function ClassCard({
  classDoc,
  subjects,
  teachers,
  isSelected,
  selectedGradeName,
  selectedClassLabel,
  selectedSubjectIds,
  selectedFormTeacherId,
  currentOfferings,
  onSelect,
  onCancel,
  onGradeNameChange,
  onClassLabelChange,
  onFormTeacherChange,
  onToggleSubject,
  onSaveClassConfig,
  onAssignTeacher,
  isSavingClassConfig,
}: {
  classDoc: ClassSummary;
  subjects: Subject[];
  teachers: Teacher[];
  isSelected: boolean;
  selectedGradeName: string;
  selectedClassLabel: string;
  selectedSubjectIds: string[];
  selectedFormTeacherId: string;
  currentOfferings: ClassOffering[] | undefined;
  onSelect: () => void;
  onCancel: () => void;
  onGradeNameChange: (value: string) => void;
  onClassLabelChange: (value: string) => void;
  onFormTeacherChange: (value: string) => void;
  onToggleSubject: (subjectId: string) => void;
  onSaveClassConfig: () => Promise<void>;
  onAssignTeacher: (classId: string, subjectId: string, teacherId: string) => Promise<void>;
  isSavingClassConfig: boolean;
}) {
  const previewBadges = classDoc.subjectNames.slice(0, 4);

  return (
    <div className="space-y-5 rounded-xl border border-[#e2e8f0] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#cbd5e1] hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-xl font-black tracking-tight text-[#0f172a]">
            {classDoc.name}
          </h3>
          <p
            className={`text-[9px] font-bold uppercase tracking-[0.15em] ${
              classDoc.formTeacherName
                ? "text-emerald-600"
                : "italic text-[#94a3b8]"
            }`}
          >
            {classDoc.formTeacherName
              ? `Form Teacher: ${classDoc.formTeacherName}`
              : "No Form Teacher Assigned"}
          </p>
        </div>
        <span className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#64748b]">
          {isSelected ? "Editing" : "Saved"}
        </span>
      </div>

      {isSelected ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledInput
              label="Grade Name"
              value={selectedGradeName}
              onChange={(value) => onGradeNameChange(humanNameTyping(value))}
              onBlur={(value) => onGradeNameChange(humanNameFinal(value))}
              placeholder="Primary 4"
            />
            <LabeledInput
              label="Class Label"
              value={selectedClassLabel}
              onChange={(value) => onClassLabelChange(humanNameTyping(value))}
              onBlur={(value) => onClassLabelChange(humanNameFinal(value))}
              placeholder="Olive Blossom"
              required={false}
            />
          </div>

          <div>
            <span className="mb-1 block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
              Form Teacher
            </span>
            <div className="relative">
              <select
                value={selectedFormTeacherId}
                onChange={(event) => onFormTeacherChange(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 pr-10 text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
              >
                <option value="">No Form Teacher Assigned</option>
                {teachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#cbd5e1]" />
            </div>
          </div>

          <div className="space-y-3">
            <span className="block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
              Select Offerings
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {subjects.map((subject) => {
                const isSubjectSelected = selectedSubjectIds.includes(subject._id);
                return (
                  <button
                    key={subject._id}
                    type="button"
                    onClick={() => onToggleSubject(subject._id)}
                    className={`rounded-lg px-3 py-2 text-left text-xs font-bold transition-all ${
                      isSubjectSelected
                        ? "border-2 border-[#4f46e5] bg-[#4f46e5]/10 text-[#4f46e5]"
                        : "border border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#cbd5e1]"
                    }`}
                  >
                    {subject.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onSaveClassConfig}
            disabled={isSavingClassConfig}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#4f46e5] text-xs font-bold uppercase tracking-[0.025em] text-white shadow-lg shadow-[#4f46e5]/10 transition-all hover:bg-[#4338ca] disabled:opacity-50"
          >
            <Layers3 className="h-3.5 w-3.5 text-white/50" />
            {isSavingClassConfig ? "Saving..." : "Save Class Blueprint"}
          </button>

          {currentOfferings && currentOfferings.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="space-y-1">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
                  Subject Teacher Mapping
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#94a3b8]">
                  Assign at least one teacher for class edit access.
                </p>
              </div>
              <div className="space-y-3">
                {currentOfferings.map((offering) => (
                  <div
                    key={offering._id}
                    className="flex flex-col gap-2 rounded-lg border border-white bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#0f172a]">
                        {offering.subjectName}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
                        {offering.subjectCode}
                      </p>
                    </div>
                    <div className="relative sm:w-[220px]">
                      <select
                        value={offering.teacherId ?? ""}
                        onChange={(event) =>
                          void onAssignTeacher(
                            classDoc._id,
                            offering.subjectId,
                            event.target.value
                          )
                        }
                        className="h-10 w-full appearance-none rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 pr-10 text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
                      >
                        <option value="">
                          {offering.teacherName ? "Reassign teacher" : "Assign teacher"}
                        </option>
                        {teachers.map((teacher) => (
                          <option key={teacher._id} value={teacher._id}>
                            {teacher.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#cbd5e1]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <span className="block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
            Current Offerings
          </span>
          {previewBadges.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {previewBadges.map((subjectName) => (
                <span
                  key={`${classDoc._id}-${subjectName}`}
                  className="rounded border border-[#e2e8f0] bg-[#f1f5f9] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.05em] text-[#475569]"
                >
                  {subjectName}
                </span>
              ))}
              {classDoc.subjectNames.length > previewBadges.length ? (
                <span className="rounded bg-[#f1f5f9] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.05em] text-[#475569]">
                  + {classDoc.subjectNames.length - previewBadges.length} more
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-[10px] font-bold uppercase italic text-[#cbd5e1]">
              Empty Set
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-[#f8fafc] pt-4">
        <div className="space-y-0.5">
          <span className="block text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#94a3b8]">
            Students
          </span>
          <span className="flex items-center gap-2 text-[11px] font-bold text-[#0f172a]">
            <Users2 className="h-3.5 w-3.5 text-[#94a3b8]" />
            {classDoc.studentCount} Registered
          </span>
        </div>
        <button
          type="button"
          onClick={isSelected ? onCancel : onSelect}
          className={`flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-bold uppercase tracking-[0.025em] transition-all ${
            isSelected
              ? "border border-[#e2e8f0] bg-[#f1f5f9] text-[#475569]"
              : classDoc.subjectNames.length > 0
                ? "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]"
                : "bg-[#4f46e5] text-white shadow-lg shadow-[#4f46e5]/10 hover:bg-[#4338ca]"
          }`}
        >
          {isSelected
            ? "Cancel"
            : classDoc.subjectNames.length > 0
              ? "Configure Subjects"
              : "Setup Offerings"}
        </button>
      </div>
    </div>
  );
}
