"use client";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { StatGroup } from "@/components/ui/StatGroup";
import { getUserFacingErrorMessage } from "@school/shared";
import { useMutation,useQuery } from "convex/react";
import {
Database,
LayoutGrid,
Search,
Sparkles,
X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue,useEffect,useMemo,useState } from "react";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasRequestedBackfill, setHasRequestedBackfill] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

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
  useEffect(() => {
    if (currentClass) setActiveClass(currentClass);
  }, [currentClass]);

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

  const handleProvision = async (data: {
    gradeName: string;
    classLabel?: string;
    level: string;
    formTeacherId: string | null;
    subjectIds: string[];
  }) => {
    setIsSubmitting(true);
    setNotice(null);
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
      setNotice({ tone: "success", title: "Class Records Initialized", message: `New blueprint created for ${data.gradeName}.` });
    } catch (err) {
      setNotice({
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
    setNotice(null);
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

      setNotice({ tone: "success", title: "Class Records Updated", message: "Blueprint modifications saved successfully." });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Update Failed",
        message: getUserFacingErrorMessage(err, "Failed to save modifications.")
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    const classDoc = classes?.find(c => c._id === id);
    if (!classDoc) return;
    if (!window.confirm(`Archive ${classDoc.name}? Historical performance and existing student enrollments will be preserved, but the class blueprint will be removed from active setup.`)) return;

    setNotice(null);
    try {
      await archiveClass({ classId: id } as never);
      setSelectedClassId(null);
      setNotice({ tone: "success", title: "Class Archived", message: "Record moved to historical database." });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Archive Failed",
        message: getUserFacingErrorMessage(err, "Failed to archive record.")
      });
    }
  };

  const handleAssignTeacher = async (classId: string, subjectId: string, teacherId: string) => {
    if (!teacherId || !classId) return;
    setNotice(null);
    try {
      await assignTeacherToClassSubject({
        classId,
        subjectId,
        teacherId,
      } as never);
      setNotice({ tone: "success", title: "Assignment Saved", message: "Subject instructor updated." });
    } catch (err) {
      setNotice({
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
    <div className="relative min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200/50">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />

      {/* Mobile Editor Sheet */}
      <AdminSheet
        isOpen={Boolean(selectedClassId) && isMobile}
        onClose={() => setSelectedClassId(null)}
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
             onArchive={() => handleArchive(activeClass._id)}
             onClose={() => setSelectedClassId(null)}
             onAssignTeacher={(subId, teachId) => handleAssignTeacher(activeClass._id, subId, teachId)}
             isSaving={isSaving}
             variant="sheet"
           />
        )}
      </AdminSheet>

      <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 overflow-hidden">
        {/* Sidebar Bucket - Independent Scroll */}
        <aside className="w-full lg:w-[400px] lg:h-full lg:overflow-y-auto lg:border-l border-slate-200/60 bg-white/40 backdrop-blur-xl px-4 py-6 md:px-8 md:py-10 custom-scrollbar z-10">
          <div className="space-y-6">
            <div className="hidden lg:block">
              {selectedClassId && currentClass ? (
                <ClassEditForm
                  classDoc={currentClass}
                  allSubjects={subjects}
                  allTeachers={teachers}
                  currentOfferings={currentOfferings}
                  onUpdate={handleUpdate}
                  onArchive={() => handleArchive(selectedClassId)}
                  onClose={() => setSelectedClassId(null)}
                  onAssignTeacher={(subId, teachId) => handleAssignTeacher(selectedClassId, subId, teachId)}
                  isSaving={isSaving}
                />
              ) : (
                <ClassCreationForm
                  onProvision={handleProvision}
                  isSubmitting={isSubmitting}
                  teachers={teachers}
                  subjects={subjects}
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
                 />
              )}
            </div>

            <div className="pt-6 border-t border-slate-200/60">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Class Lifecycle</h4>
                <p className="mt-2 text-[11px] leading-relaxed font-bold text-slate-400">
                  Classes define the structure of reports and faculty access. Archiving preserves enrollment history.
                </p>
                <button
                  onClick={() => router.push("/academic/archived-records")}
                  className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-950 transition-colors bg-slate-100/50 p-2 rounded-lg border border-slate-200/50"
                >
                  <Database className="h-3 w-3" />
                  View Historical Archives
                </button>
            </div>
          </div>
        </aside>

        {/* Main Content Bucket - Independent Scroll */}
        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto px-4 py-6 md:px-10 md:py-12 custom-scrollbar">
          <div className="max-w-[1200px] mx-auto space-y-10">
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

            {notice && (
              <div className={`group relative overflow-hidden rounded-lg border-l-4 p-4 shadow-lg transition-all border-white bg-white ${
                notice.tone === "success" ? "border-l-emerald-500" : "border-l-rose-500"
              }`}>
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">
                      {notice.title}
                    </p>
                    <p className="text-sm font-bold tracking-tight text-slate-950">{notice.message}</p>
                  </div>
                  <button 
                    onClick={() => setNotice(null)}
                    className="rounded-full p-1.5 hover:bg-slate-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-950/5 pb-4">
              <div className="space-y-1">
                 <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl font-bold tracking-tight text-slate-950 uppercase">Academic Units</h3>
                    <div className="px-2 py-0.5 rounded-full bg-slate-950 text-white text-[9px] font-bold tracking-widest uppercase italic">v2.4</div>
                 </div>
                <p className="text-xs font-medium text-slate-400">
                  Search across grade names, class labels, and form teachers.
                </p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter records..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
                />
              </div>
            </div>

            <div className="space-y-10">
              <ClassSection
                title="Primary Section"
                accent="P"
                accentClass="bg-blue-50 text-blue-500"
                classes={primaryClasses}
                selectedClassId={selectedClassId}
                onSelect={setSelectedClassId}
                onArchive={handleArchive}
                onRequestCreate={() => setSelectedClassId(null)}
              />

              <ClassSection
                title="Nursery Section"
                accent="N"
                accentClass="bg-amber-50 text-amber-500"
                classes={nurseryClasses}
                selectedClassId={selectedClassId}
                onSelect={setSelectedClassId}
                onArchive={handleArchive}
                onRequestCreate={() => setSelectedClassId(null)}
              />

              <ClassSection
                title="Secondary Section"
                accent="S"
                accentClass="bg-indigo-50 text-indigo-500"
                classes={secondaryClasses}
                selectedClassId={selectedClassId}
                onSelect={setSelectedClassId}
                onArchive={handleArchive}
                onRequestCreate={() => setSelectedClassId(null)}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
