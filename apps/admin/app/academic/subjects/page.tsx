"use client";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { StatGroup } from "@/components/ui/StatGroup";
import type { SubjectRecord } from "@/types";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useMutation, useQuery } from "convex/react";
import { BookOpenText, Plus, Search, Shapes } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { SubjectCard } from "./components/SubjectCard";
import { SubjectCreationForm } from "./components/SubjectCreationForm";
import { SubjectEditForm } from "./components/SubjectEditForm";

export default function SubjectsPage() {
  const subjects = useQuery(
    "functions/academic/academicSetup:listSubjects" as never
  ) as SubjectRecord[] | undefined;

  const createSubject = useMutation("functions/academic/academicSetup:createSubject" as never);
  const updateSubject = useMutation("functions/academic/academicSetup:updateSubject" as never);
  const archiveSubject = useMutation("functions/academic/academicSetup:archiveSubject" as never);

  const [search, setSearch] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectToArchive, setSubjectToArchive] = useState<SubjectRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const showNotice = (notice: { tone: "success" | "error"; title?: string; message: string }) => {
    const title = notice.title ?? (notice.tone === "success" ? "Success" : "Something went wrong");

    if (notice.tone === "success") {
      appToast.success(title, { description: notice.message });
      return;
    }

    appToast.error(title, { description: notice.message });
  };

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

  const subjectStats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    if (!subjects) return { total: 0, recent: 0 };
    return {
      total: subjects.length,
      recent: subjects.filter((s) => s.createdAt >= weekAgo).length,
    };
  }, [subjects]);

  const handleCreate = async (name: string, code: string) => {
    setIsSubmitting(true);
    try {
      await createSubject({ name, code } as never);
      showNotice({ tone: "success", title: "Catalog Updated", message: `${name} has been added.` });
    } catch (err) {
      showNotice({
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
    try {
      await updateSubject({ subjectId: id, name, code } as never);
      showNotice({ tone: "success", title: "Record Updated", message: "Subject details saved." });
    } catch (err) {
      showNotice({
        tone: "error",
        title: "Update Failed",
        message: getUserFacingErrorMessage(err, "Failed to save changes.")
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchivePrompt = (subject: SubjectRecord) => {
    setSubjectToArchive(subject);
  };

  const executeArchive = async () => {
    if (!subjectToArchive) return;
    setIsArchiving(true);
    try {
      await archiveSubject({ subjectId: subjectToArchive._id } as never);
      if (selectedSubjectId === subjectToArchive._id) {
        setSelectedSubjectId(null);
      }
      setSubjectToArchive(null);
      showNotice({ tone: "success", title: "Subject Archived", message: `${subjectToArchive.name} catalog entry deactivated.` });
    } catch (err) {
      showNotice({
        tone: "error",
        title: "Archive Failed",
        message: getUserFacingErrorMessage(err, "Failed to deactivate record.")
      });
    } finally {
      setIsArchiving(false);
    }
  };

  if (subjects === undefined) {
    return (
      <div className="relative min-h-full lg:h-full w-full flex flex-col lg:overflow-hidden bg-surface-200/50">
        <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 lg:h-full lg:overflow-hidden">
          <aside className="w-full lg:w-[400px] xl:w-[420px] lg:h-full lg:overflow-hidden flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200/60 bg-white/40 backdrop-blur-xl p-4 md:p-5 shrink-0">
            <div className="animate-pulse space-y-6">
              <div className="h-64 rounded-xl bg-slate-100/50" />
              <div className="h-20 rounded-xl bg-slate-100/50" />
            </div>
          </aside>
          <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto px-4 py-6 md:px-10 md:py-12 custom-scrollbar">
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
    <div className="relative min-h-full lg:h-full w-full flex flex-col lg:overflow-hidden bg-surface-200/50">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />

      {/* Confirmation Modal for Archiving */}
      <ConfirmationModal
        isOpen={Boolean(subjectToArchive)}
        onClose={() => setSubjectToArchive(null)}
        onConfirm={executeArchive}
        title={`Archive ${subjectToArchive?.name || "Subject"}?`}
        description="Archived subjects are hidden from active class creation and enrollment catalogs. Historical term results, past exam scores, and student transcripts remain safely preserved."
        confirmLabel="Archive Subject"
        confirmVariant="danger"
        isLoading={isArchiving}
      />
      
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
            onArchive={() => handleArchivePrompt(activeSubject)}
            onClose={() => setSelectedSubjectId(null)}
            isSaving={isSaving}
            variant="sheet"
          />
        )}
      </AdminSheet>

      <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 lg:h-full lg:overflow-hidden">
        {/* Sidebar Bucket - Locked & Pinned */}
        <aside className="w-full lg:w-[400px] xl:w-[420px] lg:h-full lg:overflow-hidden flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200/60 bg-white/40 backdrop-blur-xl p-4 md:p-5 z-10 shrink-0">
          <div id="subject-builder-section" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5 space-y-4">
            <div className="hidden lg:block">
              {selectedSubject ? (
                <SubjectEditForm
                  subject={selectedSubject}
                  onUpdate={handleUpdate}
                  onArchive={() => handleArchivePrompt(selectedSubject)}
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
          </div>

          <div className="pt-3 border-t border-slate-200/60 shrink-0">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Inventory Status</h4>
            <p className="mt-1 text-[11px] leading-relaxed font-medium text-slate-400">
              Subjects defined here are available school-wide for class setup and result collation.
            </p>
          </div>
        </aside>

        {/* Main Bucket */}
        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto px-4 py-6 md:px-10 md:py-12 custom-scrollbar">
          <div className="max-w-[1200px] mx-auto space-y-6 md:space-y-8">
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
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 placeholder:text-slate-300"
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
                  onArchive={() => handleArchivePrompt(subject)}
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
