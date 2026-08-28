"use client";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { StatGroup } from "@/components/ui/StatGroup";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useMutation, useQuery } from "convex/react";
import {
  Database,
  LayoutGrid,
  Search,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ClassCreationForm } from "./components/ClassCreationForm";
import { ClassEditForm } from "./components/ClassEditForm";
import { ClassSection } from "./components/ClassSection";

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
  const router = useRouter();
  const classes = useQuery("functions/academic/academicSetup:listClasses" as never) as ClassSummary[] | undefined;
  const subjects = useQuery("functions/academic/academicSetup:listSubjects" as never) as Subject[] | undefined;
  const teachers = useQuery("functions/academic/academicSetup:listTeachers" as never) as Teacher[] | undefined;

  const createClass = useMutation("functions/academic/academicSetup:createClass" as never);
  const backfillClassNaming = useMutation("functions/academic/academicSetup:backfillClassNaming" as never);
  const updateClass = useMutation("functions/academic/academicSetup:updateClass" as never);
  const archiveClass = useMutation("functions/academic/academicSetup:archiveClass" as never);
  const setClassSubjects = useMutation("functions/academic/academicSetup:setClassSubjects" as never);
  const assignTeacherToClassSubject = useMutation("functions/academic/academicSetup:assignTeacherToClassSubject" as never);

  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [builderLevel, setBuilderLevel] = useState<string>("Nursery");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [classToArchive, setClassToArchive] = useState<ClassSummary | null>(null);
  const [hasRequestedBackfill, setHasRequestedBackfill] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!classes || classes.length === 0 || hasRequestedBackfill) return;
    let cancelled = false;

    const runBackfill = async () => {
      try {
        await backfillClassNaming({} as never);
      } catch (error) {
        console.error("backfillClassNaming failed", error);
      } finally {
        if (!cancelled) {
          setHasRequestedBackfill(true);
        }
      }
    };

    void runBackfill();
    return () => {
      cancelled = true;
    };
  }, [backfillClassNaming, classes, hasRequestedBackfill]);

  const showNotice = (notice: { tone: "success" | "error"; title?: string; message: string }) => {
    const title = notice.title ?? (notice.tone === "success" ? "Success" : "Something went wrong");

    if (notice.tone === "success") {
      appToast.success(title, { description: notice.message });
      return;
    }

    appToast.error(title, { description: notice.message });
  };

  const deferredSearch = useDeferredValue(search);
  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return classes;
    return classes.filter(
      (c) => 
        c.name.toLowerCase().includes(query) || 
        c.gradeName?.toLowerCase().includes(query) ||
        c.classLabel?.toLowerCase().includes(query) ||
        c.formTeacherName?.toLowerCase().includes(query)
    );
  }, [deferredSearch, classes]);

  const currentClass = useMemo(
    () => classes?.find((c) => c._id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const currentOfferings = useQuery(
    "functions/academic/academicSetup:getClassSubjects" as never,
    selectedClassId ? ({ classId: selectedClassId } as never) : ("skip" as never)
  ) as ClassOffering[] | undefined;

  const [activeClass, setActiveClass] = useState<ClassSummary | null>(null);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  useEffect(() => {
    if (currentClass) setActiveClass(currentClass);
  }, [currentClass]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isEditorDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEditorDirty]);

  const guardUnsavedAction = (action: () => void) => {
    if (isEditorDirty) {
      setPendingNavigation(() => action);
      setShowUnsavedModal(true);
    } else {
      action();
    }
  };

  useEffect(() => {
    if (selectedClassId && typeof window !== "undefined" && window.innerWidth < 1024) {
      const scrollTimer = setTimeout(() => {
        const element = document.getElementById(`class-${selectedClassId}`);
        if (element) {
          const yOffset = -120;
          const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 100);
      return () => clearTimeout(scrollTimer);
    }
  }, [selectedClassId]);

  const handleRequestCreate = (level: string = "Nursery") => {
    setSelectedClassId(null);
    setBuilderLevel(level);
    setIsEditorDirty(false);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      const builder = document.getElementById("class-builder-section");
      if (builder) {
        builder.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const handleProvision = async (data: {
    gradeName: string;
    classLabel?: string;
    level: string;
    formTeacherId: string | null;
    subjectIds: string[];
  }) => {
    setIsSubmitting(true);
    try {
      const classId = (await createClass({
        gradeName: data.gradeName,
        classLabel: data.classLabel || undefined,
        level: data.level,
        formTeacherId: data.formTeacherId || null,
      } as never)) as string;

      if (data.subjectIds.length > 0) {
        await setClassSubjects({
          classId,
          subjectIds: data.subjectIds,
        } as never);
      }
      showNotice({ tone: "success", title: "Class Records Initialized", message: `New blueprint created for ${data.gradeName}.` });
    } catch (err) {
      showNotice({
        tone: "error",
        title: "Provisioning Failed",
        message: getUserFacingErrorMessage(err, "Failed to create class.")
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: {
    gradeName: string;
    classLabel?: string;
    formTeacherId: string | null;
    subjectIds: string[];
  }) => {
    if (!selectedClassId) return;
    setIsSaving(true);
    try {
      await updateClass({
        classId: selectedClassId,
        gradeName: data.gradeName,
        classLabel: data.classLabel || null,
        formTeacherId: data.formTeacherId || null,
      } as never);

      await setClassSubjects({
        classId: selectedClassId,
        subjectIds: data.subjectIds,
      } as never);

      setIsEditorDirty(false);
      showNotice({ tone: "success", title: "Class Records Updated", message: "Blueprint modifications saved successfully." });
    } catch (err) {
      showNotice({
        tone: "error",
        title: "Update Failed",
        message: getUserFacingErrorMessage(err, "Failed to save modifications.")
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchivePrompt = (id: string) => {
    const classDoc = classes?.find(c => c._id === id);
    if (!classDoc) return;
    setClassToArchive(classDoc);
  };

  const executeArchive = async () => {
    if (!classToArchive) return;
    setIsArchiving(true);
    try {
      await archiveClass({ classId: classToArchive._id } as never);
      if (selectedClassId === classToArchive._id) {
        setSelectedClassId(null);
      }
      setClassToArchive(null);
      showNotice({ tone: "success", title: "Class Archived", message: `${classToArchive.name} moved to historical archives.` });
    } catch (err) {
      showNotice({
        tone: "error",
        title: "Archive Failed",
        message: getUserFacingErrorMessage(err, "Failed to archive record.")
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleAssignTeacher = async (classId: string, subjectId: string, teacherId: string) => {
    if (!teacherId || !classId) return;
    try {
      await assignTeacherToClassSubject({
        classId,
        subjectId,
        teacherId,
      } as never);
      showNotice({ tone: "success", title: "Assignment Saved", message: "Subject instructor updated." });
    } catch (err) {
      showNotice({
        tone: "error",
        title: "Assignment Failed",
        message: getUserFacingErrorMessage(err, "Failed to update instructor.")
      });
    }
  };

  const nurseryClasses = useMemo(() => filteredClasses.filter(c => c.level === "Nursery"), [filteredClasses]);
  const primaryClasses = useMemo(() => filteredClasses.filter(c => c.level === "Primary"), [filteredClasses]);
  const secondaryClasses = useMemo(() => filteredClasses.filter(c => c.level === "Secondary"), [filteredClasses]);

  if (classes === undefined || subjects === undefined || teachers === undefined) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 py-10 md:px-8">
        <div className="animate-pulse space-y-10">
          <div className="h-10 w-48 rounded-lg bg-slate-100" />
          <div className="grid gap-10 lg:grid-cols-3">
             <div className="lg:col-span-2 space-y-8 h-96 rounded-xl bg-slate-50" />
             <div className="h-96 rounded-xl bg-slate-50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full lg:h-full w-full flex flex-col lg:overflow-hidden bg-surface-200/50">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />

      {/* Confirmation Modal for Archiving */}
      <ConfirmationModal
        isOpen={Boolean(classToArchive)}
        onClose={() => setClassToArchive(null)}
        onConfirm={executeArchive}
        title={`Archive ${classToArchive?.name || "Class"}?`}
        description="Historical academic performance, past grades, and existing student enrollment records will remain safely preserved in the database. The class blueprint will be removed from active academic sessions."
        confirmLabel="Archive Class"
        confirmVariant="danger"
        isLoading={isArchiving}
      />

      {/* Confirmation Modal for Unsaved Changes */}
      <ConfirmationModal
        isOpen={showUnsavedModal}
        onClose={() => {
          setShowUnsavedModal(false);
          setPendingNavigation(null);
        }}
        onConfirm={() => {
          setIsEditorDirty(false);
          setShowUnsavedModal(false);
          if (pendingNavigation) {
            pendingNavigation();
            setPendingNavigation(null);
          }
        }}
        title="Discard Unsaved Changes?"
        description={`You have unsaved edits in ${currentClass?.name || "this class record"}. If you switch classes or close the editor now, your changes will be discarded.`}
        confirmLabel="Discard & Continue"
        confirmVariant="warning"
      />

      {/* Mobile Editor Sheet */}
      <AdminSheet
        isOpen={Boolean(selectedClassId) && isMobile}
        onClose={() => guardUnsavedAction(() => setSelectedClassId(null))}
        title="Edit Class Record"
        description="Modify blueprints and subject mappings."
      >
        {activeClass && (
           <ClassEditForm
             classDoc={activeClass}
             allSubjects={subjects}
             allTeachers={teachers}
             currentOfferings={currentOfferings}
             onUpdate={handleUpdate}
             onArchive={() => handleArchivePrompt(activeClass._id)}
             onClose={() => guardUnsavedAction(() => setSelectedClassId(null))}
             onAssignTeacher={(subId, teachId) => handleAssignTeacher(activeClass._id, subId, teachId)}
             onDirtyChange={setIsEditorDirty}
             isSaving={isSaving}
             variant="sheet"
           />
        )}
      </AdminSheet>

      <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 lg:h-full lg:overflow-hidden">
        {/* Sidebar Bucket - Locked & Pinned */}
        <aside className="w-full lg:w-[400px] xl:w-[420px] lg:h-full lg:overflow-hidden flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200/60 bg-white/40 backdrop-blur-xl p-4 md:p-5 z-10 shrink-0">
          <div id="class-builder-section" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5 space-y-4">
            <div className="hidden lg:block h-full">
              {selectedClassId && currentClass ? (
                <ClassEditForm
                  classDoc={currentClass}
                  allSubjects={subjects}
                  allTeachers={teachers}
                  currentOfferings={currentOfferings}
                  onUpdate={handleUpdate}
                  onArchive={() => handleArchivePrompt(selectedClassId)}
                  onClose={() => guardUnsavedAction(() => setSelectedClassId(null))}
                  onAssignTeacher={(subId, teachId) => handleAssignTeacher(selectedClassId, subId, teachId)}
                  onDirtyChange={setIsEditorDirty}
                  isSaving={isSaving}
                />
              ) : (
                <ClassCreationForm
                  onProvision={handleProvision}
                  isSubmitting={isSubmitting}
                  teachers={teachers}
                  subjects={subjects}
                  initialLevel={builderLevel}
                />
              )}
            </div>

            <div className="lg:hidden">
              {!selectedClassId && (
                 <ClassCreationForm
                   onProvision={handleProvision}
                   isSubmitting={isSubmitting}
                   teachers={teachers}
                   subjects={subjects}
                   initialLevel={builderLevel}
                 />
              )}
            </div>
          </div>

          {!selectedClassId && (
            <div className="pt-3 border-t border-slate-200/60 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Class Lifecycle</h4>
                  <p className="text-[10px] font-medium text-slate-400">
                    Archiving preserves past grades.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/academic/archived-records")}
                  className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-500 hover:text-slate-950 transition-colors bg-slate-100/70 py-1.5 px-2.5 rounded-lg border border-slate-200/50 cursor-pointer"
                >
                  <Database className="h-3 w-3" />
                  <span>Archives</span>
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Bucket - Independent Scroll */}
        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto px-4 py-6 md:px-10 md:py-12 custom-scrollbar">
          <div className="max-w-[1200px] mx-auto space-y-8">
            <AdminHeader
              title="Class Management"
              actions={
                <StatGroup
                  stats={[
                    {
                      label: "Active Units",
                      value: classes.length,
                      icon: <LayoutGrid className="h-4 w-4" />,
                    },
                    {
                      label: "Curriculum Map",
                      value: subjects.length,
                      icon: <Sparkles className="h-4 w-4" />,
                    },
                  ]}
                />
              }
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-950/5 pb-4">
              <div className="space-y-1">
                <h3 className="font-display text-xl font-bold tracking-tight text-slate-950 uppercase">
                  Academic Units
                </h3>
                <p className="text-xs font-medium text-slate-500">
                  Search across grade names, class labels, and form teachers.
                </p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter records..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 placeholder:text-slate-300"
                />
              </div>
            </div>

            {/* ═══ CHRONOLOGICAL SECTION PROGRESSION: Nursery ➔ Primary ➔ Secondary ═══ */}
            <div className="space-y-8">
              <ClassSection
                title="Nursery Section"
                level="Nursery"
                accent="N"
                accentClass="bg-amber-50 text-amber-600 border border-amber-200/60"
                classes={nurseryClasses}
                selectedClassId={selectedClassId}
                onSelect={(id) => guardUnsavedAction(() => setSelectedClassId(id))}
                onArchive={handleArchivePrompt}
                onRequestCreate={(lvl) => guardUnsavedAction(() => handleRequestCreate(lvl))}
              />

              <ClassSection
                title="Primary Section"
                level="Primary"
                accent="P"
                accentClass="bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                classes={primaryClasses}
                selectedClassId={selectedClassId}
                onSelect={(id) => guardUnsavedAction(() => setSelectedClassId(id))}
                onArchive={handleArchivePrompt}
                onRequestCreate={(lvl) => guardUnsavedAction(() => handleRequestCreate(lvl))}
              />

              <ClassSection
                title="Secondary Section"
                level="Secondary"
                accent="S"
                accentClass="bg-blue-50 text-blue-700 border border-blue-200/60"
                classes={secondaryClasses}
                selectedClassId={selectedClassId}
                onSelect={(id) => guardUnsavedAction(() => setSelectedClassId(id))}
                onArchive={handleArchivePrompt}
                onRequestCreate={(lvl) => guardUnsavedAction(() => handleRequestCreate(lvl))}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

