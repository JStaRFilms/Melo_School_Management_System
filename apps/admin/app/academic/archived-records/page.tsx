"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  BookMarked,
  CalendarDays,
  CalendarRange,
  FolderArchive,
  GraduationCap,
  Users,
  Search,
  Filter,
  X,
  History,
  CornerDownRight,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { ArchivedRecordsFilters } from "./components/ArchivedRecordsFilters";
import { ArchivedRecordsList } from "./components/ArchivedRecordsList";
import { ArchivedRecordDetail } from "./components/ArchivedRecordDetail";
import type { ArchivedRecordItem, ArchivedRecordsSummary, ArchiveFilterType } from "./components/types";

interface ArchivedRecordsQueryResult {
  summary: ArchivedRecordsSummary;
  records: ArchivedRecordItem[];
}

function LoadingShell() {
  return (
    <div className="space-y-4 p-4 md:p-8">
      <div className="h-24 rounded-2xl bg-slate-100/50 animate-pulse" />
      <div className="h-64 rounded-2xl bg-slate-100/50 animate-pulse" />
    </div>
  );
}

export default function ArchivedRecordsPage() {
  const archiveData = useQuery(
    "functions/academic/archiveRecords:listArchivedRecords" as never
  ) as ArchivedRecordsQueryResult | undefined;
  
  const restoreTeacher = useMutation("functions/academic/academicSetup:restoreTeacher" as never);
  const restoreSession = useMutation("functions/academic/academicSetup:restoreSession" as never);
  const restoreClass = useMutation("functions/academic/academicSetup:restoreClass" as never);
  const restoreSubject = useMutation("functions/academic/academicSetup:restoreSubject" as never);
  const restoreStudent = useMutation("functions/academic/studentEnrollment:restoreStudent" as never);
  const restoreEvent = useMutation("functions/academic/events:restoreEvent" as never);

  const [activeType, setActiveType] = useState<ArchiveFilterType>("all");
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<ArchivedRecordItem | null>(null);
  const [activeRecord, setActiveRecord] = useState<ArchivedRecordItem | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Hybrid Sync: Ensure detail view doesn't collapse during close animation
  useEffect(() => {
    if (selectedRecord) {
      setActiveRecord(selectedRecord);
    }
  }, [selectedRecord]);

  // Smart Focus: Auto-scroll to selected card on mobile
  useEffect(() => {
    if (selectedRecord && typeof window !== "undefined" && window.innerWidth < 1024) {
      const scrollTimer = setTimeout(() => {
        const element = document.getElementById("record-" + selectedRecord.id);
        if (element) {
          const yOffset = -120;
          const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 150);
      return () => clearTimeout(scrollTimer);
    }
  }, [selectedRecord]);

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const handleRestoreRecord = async () => {
    if (!selectedRecord) return;
    setStatusMessage(null);
    setIsRestoring(true);

    try {
      switch (selectedRecord.type) {
        case "teacher": await restoreTeacher({ teacherId: selectedRecord.recordId as never }); break;
        case "session": await restoreSession({ sessionId: selectedRecord.recordId as never }); break;
        case "class": await restoreClass({ classId: selectedRecord.recordId as never }); break;
        case "subject": await restoreSubject({ subjectId: selectedRecord.recordId as never }); break;
        case "student": await restoreStudent({ studentId: selectedRecord.recordId as never }); break;
        case "event": await restoreEvent({ eventId: selectedRecord.recordId as never }); break;
        default: throw new Error("Unsupported record type");
      }
      const label = selectedRecord.typeLabel;
      setSelectedRecord(null);
      setStatusMessage({ tone: "success", text: `${label} restored successfully.` });
    } catch (err) {
      setStatusMessage({ tone: "error", text: getUserFacingErrorMessage(err, "Failed to restore record") });
    } finally {
      setIsRestoring(false);
    }
  };

  const filteredRecords = useMemo(
    () => archiveData?.records.filter((record) => {
      if (activeType !== "all" && record.type !== activeType) return false;
      if (hasInvalidDateRange) return false;
      const archivedDay = new Date(record.archivedAt).toISOString().slice(0, 10);
      if (dateFrom && archivedDay < dateFrom) return false;
      if (dateTo && archivedDay > dateTo) return false;
      if (!normalizedSearch) return true;
      const haystacks = [record.name, record.subtitle ?? "", record.typeLabel, record.archivedByName ?? "", record.statusNote, record.linkedHistory, ...record.detailFields.map(f => `${f.label} ${f.value}`)];
      return haystacks.some(v => v.toLowerCase().includes(normalizedSearch));
    }) ?? [],
    [activeType, archiveData?.records, dateFrom, dateTo, hasInvalidDateRange, normalizedSearch]
  );

  if (archiveData === undefined) return <LoadingShell />;

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-slate-50/50">
      <style jsx>{`
        :global(.custom-scrollbar::-webkit-scrollbar) {
          width: 4px;
        }

        :global(.custom-scrollbar::-webkit-scrollbar-thumb) {
          background: transparent;
        }

        :global(.custom-scrollbar:hover::-webkit-scrollbar-thumb) {
          background: rgba(15, 23, 42, 0.1);
        }
      `}</style>

      {/* Mobile Audit Sheet */}
      <AdminSheet
        isOpen={Boolean(selectedRecord) && isMobile}
        onClose={() => setSelectedRecord(null)}
        title="Audit Inspector"
        description="Review archived record details."
      >
        {activeRecord && (
          <ArchivedRecordDetail
            record={activeRecord}
            onRestore={handleRestoreRecord}
            onClose={() => setSelectedRecord(null)}
            isRestoring={isRestoring}
            variant="sheet"
          />
        )}
      </AdminSheet>

      <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 overflow-hidden">
        {/* Mobile Stats: Fixed at top of scroll on mobile only */}
        <div className="lg:hidden bg-white/60 backdrop-blur-xl border-b border-slate-100 p-4 shrink-0 shadow-sm">
          <StatGroup
            variant="double-row"
            stats={[
              { label: "Total", value: archiveData.summary.totalArchived, icon: <Archive /> },
              { label: "Classes", value: archiveData.summary.archivedClasses, icon: <FolderArchive /> },
              { label: "Subjects", value: archiveData.summary.archivedSubjects, icon: <BookMarked /> },
              { label: "Staff", value: archiveData.summary.archivedTeachers, icon: <Users /> },
              { label: "Students", value: archiveData.summary.archivedStudents, icon: <GraduationCap /> },
              { label: "Sessions", value: archiveData.summary.archivedSessions, icon: <CalendarDays /> },
              { label: "Events", value: archiveData.summary.archivedEvents, icon: <CalendarRange /> },
            ]}
          />
        </div>

        {/* Sidebar Bucket: Desktop Detail View & Global Filters */}
        <aside className="w-full lg:w-[380px] lg:h-full lg:overflow-y-auto border-l bg-white/40 backdrop-blur-xl custom-scrollbar shrink-0">
          <div className="p-4 md:p-8 space-y-8">
            <div className="hidden lg:block">
              {selectedRecord ? (
                <ArchivedRecordDetail
                  record={selectedRecord}
                  onRestore={handleRestoreRecord}
                  onClose={() => setSelectedRecord(null)}
                  isRestoring={isRestoring}
                />
              ) : (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="space-y-1 px-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">
                      <Search size={10} />
                      Directory Lookup
                    </div>
                    <h3 className="text-xs lg:text-sm font-bold text-slate-900 tracking-tight">Search Archive</h3>
                  </div>

                  <ArchivedRecordsFilters
                    activeType={activeType}
                    searchValue={searchValue}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onTypeChange={setActiveType}
                    onSearchChange={setSearchValue}
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                  />

                  <div className="pt-6 border-t border-slate-200/60 px-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                      <Filter size={10} />
                      Audit Context
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed font-medium text-slate-400">
                      Filter by date or record type to isolate historical academic snapshots for compliance and reporting.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Filters (Only if no record selected) */}
            <div className="lg:hidden">
              {!selectedRecord && (
                <div className="space-y-8">
                  <ArchivedRecordsFilters
                    activeType={activeType}
                    searchValue={searchValue}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onTypeChange={setActiveType}
                    onSearchChange={setSearchValue}
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                  />
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar">
          <div className="max-w-[1200px] mx-auto px-4 py-6 md:px-8 md:py-10 space-y-8">
            <div className="space-y-6 md:space-y-8">
              {/* Desktop-only Stats */}
              <div className="hidden lg:block">
                <StatGroup
                  variant="wrap"
                  stats={[
                    { label: "Total", value: archiveData.summary.totalArchived, icon: <Archive /> },
                    { label: "Classes", value: archiveData.summary.archivedClasses, icon: <FolderArchive /> },
                    { label: "Subjects", value: archiveData.summary.archivedSubjects, icon: <BookMarked /> },
                    { label: "Staff", value: archiveData.summary.archivedTeachers, icon: <Users /> },
                    { label: "Students", value: archiveData.summary.archivedStudents, icon: <GraduationCap /> },
                    { label: "Sessions", value: archiveData.summary.archivedSessions, icon: <CalendarDays /> },
                    { label: "Events", value: archiveData.summary.archivedEvents, icon: <CalendarRange /> },
                  ]}
                />
              </div>
              <AdminHeader title="Archive Audit" />
            </div>

            {statusMessage && (
              <div className={`group relative overflow-hidden rounded-xl border-l-4 p-4 shadow-sm transition-all duration-500 bg-white ${
                statusMessage.tone === "success" ? "border-emerald-500" : "border-rose-500"
              }`}>
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-0.5 text-xs lg:text-sm">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">
                      {statusMessage.tone === "success" ? "Operation Successful" : "Operation Failed"}
                    </p>
                    <p className="text-xs font-bold tracking-tight">{statusMessage.text}</p>
                  </div>
                  <button onClick={() => setStatusMessage(null)} className="rounded-full p-1.5 hover:bg-slate-50"><X size={14} /></button>
                </div>
              </div>
            )}

            {hasInvalidDateRange && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs font-medium text-amber-800 flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                The archive date range is logically inconsistent. Please re-check from/to values.
              </div>
            )}

            <AdminSurface intensity="low" className="overflow-hidden border-slate-950/5">
               <ArchivedRecordsList
                records={filteredRecords}
                onSelectRecord={setSelectedRecord}
              />
            </AdminSurface>
          </div>
        </main>
      </div>
    </div>
  );
}
