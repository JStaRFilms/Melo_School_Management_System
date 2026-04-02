"use client";

import { useDeferredValue, useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { BookOpenText, Shapes, Search, Plus, X } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { SubjectCard } from "./components/SubjectCard";
import { SubjectCreationForm } from "./components/SubjectCreationForm";
import { SubjectEditForm } from "./components/SubjectEditForm";
import type { SubjectRecord } from "@/types";

export default function SubjectsPage() {
  const subjects = useQuery(
    "functions/academic/academicSetup:listSubjects" as never
  ) as SubjectRecord[] | undefined;

  const createSubject = useMutation("functions/academic/academicSetup:createSubject" as never);
  const updateSubject = useMutation("functions/academic/academicSetup:updateSubject" as never);
  const archiveSubject = useMutation("functions/academic/academicSetup:archiveSubject" as never);

  const [search, setSearch] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const deferredSearch = useDeferredValue(search);
  const selectedSubject = useMemo(() => 
    subjects?.find((s) => s._id === selectedSubjectId) ?? null,
  [subjects, selectedSubjectId]);

  const [activeSubject, setActiveSubject] = useState<SubjectRecord | null>(null);

  useEffect(() => {
    if (selectedSubject) {
      setActiveSubject(selectedSubject);
    }
  }, [selectedSubject]);

  // Handle auto-scroll to selected card on mobile
  useEffect(() => {
    if (selectedSubjectId && typeof window !== "undefined" && window.innerWidth < 1024) {
      const scrollTimer = setTimeout(() => {
          const element = document.getElementById(`subject-${selectedSubjectId}`);
        if (element) {
          const yOffset = -120; // Ensure card is comfortably in view above the sheet
          const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 100);
      return () => clearTimeout(scrollTimer);
    }
  }, [selectedSubjectId]);

  const filteredSubjects = useMemo(() => {
    if (!subjects) return [];
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return subjects;
    return subjects.filter(
      (s) => s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query)
    );
  }, [deferredSearch, subjects]);

  const [subjectStats, oneWeekAgo] = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    if (!subjects) return [{ total: 0, recent: 0 }, weekAgo];
    return [
      {
        total: subjects.length,
        recent: subjects.filter((s) => s.createdAt >= weekAgo).length,
      },
      weekAgo,
    ];
  }, [subjects]);

  const handleCreate = async (name: string, code: string) => {
    setIsSubmitting(true);
    setNotice(null);
    try {
      await createSubject({ name, code } as never);
      setNotice({ tone: "success", title: "Catalog Updated", message: `${name} has been added.` });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Creation Failed",
        message: getUserFacingErrorMessage(err, "Failed to create subject.")
      });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, name: string, code: string) => {
    setIsSaving(true);
    setNotice(null);
    try {
      await updateSubject({ subjectId: id, name, code } as never);
      setNotice({ tone: "success", title: "Record Updated", message: "Subject details saved." });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Update Failed",
        message: getUserFacingErrorMessage(err, "Failed to save changes.")
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    const subject = subjects?.find(s => s._id === id);
    if (!subject) return;
    if (!window.confirm(`Archive ${subject.name}? This hides it from active enrollment.`)) return;

    setNotice(null);
    try {
      await archiveSubject({ subjectId: id } as never);
      setSelectedSubjectId(null);
      setNotice({ tone: "success", title: "Subject Archived", message: "Catalog entry deactivated." });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Archive Failed",
        message: getUserFacingErrorMessage(err, "Failed to deactivate record.")
      });
    }
  };

  if (subjects === undefined) {
    return (
      <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200">
        <div className="flex flex-col lg:flex-row-reverse flex-1 min-h-0">
          <aside className="w-full lg:w-[400px] lg:h-full border-l bg-white/40 backdrop-blur-xl shrink-0 p-4 md:p-8">
            <div className="animate-pulse space-y-6">
              <div className="h-64 rounded-xl bg-slate-100/50" />
              <div className="h-20 rounded-xl bg-slate-100/50" />
            </div>
          </aside>
          <main className="flex-1 lg:h-full p-4 md:p-8">
            <div className="max-w-[1200px] mx-auto animate-pulse space-y-10">
              <div className="h-10 w-48 rounded-lg bg-slate-100/50" />
              <div className="h-32 rounded-xl bg-slate-100/50" />
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-40 rounded-xl bg-slate-100/50" />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.15);
        }
      `}</style>
      
      {/* Mobile Editor Sheet */}
      <AdminSheet
        isOpen={Boolean(selectedSubjectId) && isMobile}
        onClose={() => setSelectedSubjectId(null)}
        title="Edit Subject"
        description="Update subject catalog entry."
      >
        {activeSubject && (
          <SubjectEditForm
            subject={activeSubject}
            onUpdate={handleUpdate}
            onArchive={handleArchive}
            onClose={() => setSelectedSubjectId(null)}
            isSaving={isSaving}
            variant="sheet"
          />
        )}
      </AdminSheet>

      <div className="flex flex-col lg:flex-row-reverse flex-1 min-h-0">
        {/* Sidebar Bucket */}
        <aside className="w-full lg:w-[400px] lg:h-full lg:overflow-y-auto border-l bg-white/40 backdrop-blur-xl custom-scrollbar shrink-0">
          <div className="p-4 md:p-6 lg:p-8 space-y-8">
            <div className="hidden lg:block">
              {selectedSubject ? (
                <SubjectEditForm
                  subject={selectedSubject}
                  onUpdate={handleUpdate}
                  onArchive={handleArchive}
                  onClose={() => setSelectedSubjectId(null)}
                  isSaving={isSaving}
                />
              ) : (
                <SubjectCreationForm
                  onCreate={handleCreate}
                  isSubmitting={isSubmitting}
                />
              )}
            </div>

            <div className="lg:hidden">
              {!selectedSubject && (
                 <SubjectCreationForm
                   onCreate={handleCreate}
                   isSubmitting={isSubmitting}
                 />
              )}
            </div>
            
            <div className="pt-6 border-t border-slate-200/60">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Inventory Status</h4>
              <p className="mt-2 text-xs leading-relaxed font-medium text-slate-400">
                Subjects defined here are available school-wide for class setup and result collation.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Bucket */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar">
          <div className="max-w-[1200px] mx-auto px-4 py-6 md:px-8 md:py-10 space-y-6 md:space-y-8">
            <AdminHeader
              title="Subject Catalog"
              actions={
                <StatGroup
                  stats={[
                    {
                      label: "Total Entries",
                      value: subjectStats.total,
                      icon: <BookOpenText className="h-4 w-4" />,
                    },
                    {
                      label: "Added This Week",
                      value: subjectStats.recent,
                      icon: <Shapes className="h-4 w-4" />,
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

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-950/5 pb-4">
              <div className="space-y-0.5">
                <h3 className="font-display text-xs lg:text-xl font-bold tracking-tight text-slate-950 uppercase">Live Catalog</h3>
                <p className="text-xs font-medium text-slate-500">
                  Global list of subjects available for academic operations.
                </p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter subjects..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredSubjects.map((subject) => (
                <SubjectCard
                  key={subject._id}
                  subject={subject}
                  isSelected={selectedSubjectId === subject._id}
                  onSelect={() => setSelectedSubjectId(subject._id)}
                  onArchive={() => handleArchive(subject._id)}
                />
              ))}

              {filteredSubjects.length === 0 && (
                <div className="sm:col-span-2 xl:col-span-3 py-12 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-12 text-center">
                  <div className="rounded-2xl bg-white p-4 text-slate-200 shadow-sm ring-1 ring-slate-950/5">
                    <Plus className="h-6 w-6" />
                  </div>
                  <p className="mt-6 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">No Records Found</p>
                  <p className="mt-2 text-sm font-medium text-slate-400 max-w-[200px]">Adjust your filters or add a new subject to the catalog.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
