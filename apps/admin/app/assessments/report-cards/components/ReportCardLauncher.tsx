"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import Link from "next/link";
import {
  CalendarDays,
  Target,
  Users,
  User,
  Printer,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  Search,
} from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";

type SelectorOption = { id: string; name: string };

export function ReportCardLauncher() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawSessions = useQuery(
    "functions/academic/adminSelectors:getAdminSessions" as never
  ) as SelectorOption[] | undefined;

  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    searchParams.get("sessionId") || ""
  );

  useEffect(() => {
    if (!selectedSessionId && rawSessions && rawSessions.length > 0) {
      setSelectedSessionId(rawSessions[0].id);
    }
  }, [rawSessions, selectedSessionId]);

  const rawTerms = useQuery(
    "functions/academic/adminSelectors:getTermsBySession" as never,
    selectedSessionId ? ({ sessionId: selectedSessionId } as never) : ("skip" as never)
  ) as SelectorOption[] | undefined;

  const [selectedTermId, setSelectedTermId] = useState<string>(
    searchParams.get("termId") || ""
  );

  useEffect(() => {
    if (!selectedTermId && rawTerms && rawTerms.length > 0) {
      setSelectedTermId(rawTerms[0].id);
    }
  }, [rawTerms, selectedTermId]);

  const rawClasses = useQuery(
    "functions/academic/adminSelectors:getAllClasses" as never
  ) as SelectorOption[] | undefined;

  const [selectedClassId, setSelectedClassId] = useState<string>(
    searchParams.get("classId") || ""
  );

  useEffect(() => {
    if (!selectedClassId && rawClasses && rawClasses.length > 0) {
      setSelectedClassId(rawClasses[0].id);
    }
  }, [rawClasses, selectedClassId]);

  const rawStudents = useQuery(
    "functions/academic/reportCards:getStudentsForReportCardBatch" as never,
    selectedSessionId && selectedTermId && selectedClassId
      ? ({
          sessionId: selectedSessionId,
          termId: selectedTermId,
          classId: selectedClassId,
        } as never)
      : ("skip" as never)
  ) as
    | Array<{
        studentId: string;
        studentName: string;
        admissionNumber: string;
        passportUrl?: string | null;
      }>
    | undefined;

  // Live URL sync as user changes dropdowns
  useEffect(() => {
    if (!selectedSessionId) return;
    const params = new URLSearchParams();
    params.set("sessionId", selectedSessionId);
    if (selectedTermId) params.set("termId", selectedTermId);
    if (selectedClassId) params.set("classId", selectedClassId);
    const newQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (newQuery !== currentQuery) {
      window.history.replaceState(null, "", `${window.location.pathname}?${newQuery}`);
    }
  }, [selectedSessionId, selectedTermId, selectedClassId, searchParams]);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = useMemo(() => {
    if (!rawStudents) return [];
    if (!searchQuery.trim()) return rawStudents;
    const q = searchQuery.toLowerCase();
    return rawStudents.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q)
    );
  }, [rawStudents, searchQuery]);

  const handleOpenStudent = (studentId: string) => {
    router.push(
      `/assessments/report-cards?sessionId=${selectedSessionId}&termId=${selectedTermId}&classId=${selectedClassId}&studentId=${studentId}`
    );
  };

  const handlePrintClass = () => {
    if (!filteredStudents.length) return;
    router.push(
      `/assessments/report-cards?sessionId=${selectedSessionId}&termId=${selectedTermId}&classId=${selectedClassId}&studentId=${filteredStudents[0].studentId}&printClass=1`
    );
  };

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto bg-slate-50/40 p-4 sm:p-8 lg:p-12 custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-8 pb-32">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              <Link href="/admin/dashboard" className="hover:text-slate-900 transition-colors">
                Admin
              </Link>
              <ChevronRight size={10} className="opacity-50" />
              <span>Assessments</span>
              <ChevronRight size={10} className="opacity-50" />
              <span className="text-slate-900">Report Cards</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Student Report Cards
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-xl">
              Select an academic term and class to view, verify, and batch-print official terminal report sheets.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/assessments/report-card-extras${
                selectedSessionId ? `?sessionId=${selectedSessionId}&termId=${selectedTermId}&classId=${selectedClassId}` : ""
              }`}
              className="h-10 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <SlidersHorizontal size={14} className="text-slate-400" />
              Term Defaults & Remarks
            </Link>
          </div>
        </div>

        {/* Filter Controls */}
        <AdminSurface intensity="low" className="p-4 sm:p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Session Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <CalendarDays size={13} className="text-slate-400" />
                Session
              </label>
              <select
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionId(e.target.value);
                  setSelectedTermId("");
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-slate-400"
              >
                {(rawSessions ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Term Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Target size={13} className="text-slate-400" />
                Term
              </label>
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                disabled={!selectedSessionId || !rawTerms?.length}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-slate-400 disabled:opacity-50"
              >
                {(rawTerms ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Users size={13} className="text-slate-400" />
                Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-slate-400"
              >
                {(rawClasses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </AdminSurface>

        {/* Student List and Actions */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Enrolled Students
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                {filteredStudents.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by name or reg no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 outline-none transition focus:border-slate-400"
                />
              </div>

              {filteredStudents.length > 0 && (
                <button
                  type="button"
                  onClick={handlePrintClass}
                  className="h-9 px-4 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 shrink-0"
                >
                  <Printer size={13} />
                  Print Class Batch
                </button>
              )}
            </div>
          </div>

          {rawStudents === undefined ? (
            <div className="p-12 text-center text-xs font-semibold text-slate-400 bg-white border border-slate-200/80 rounded-2xl">
              Loading students...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center space-y-2 bg-white border border-slate-200/80 rounded-2xl">
              <p className="text-sm font-bold text-slate-700">No students found</p>
              <p className="text-xs text-slate-400">
                {searchQuery
                  ? "No students match your search filter."
                  : "No students are currently enrolled in this class."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStudents.map((student) => {
                const initials =
                  student.studentName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p.charAt(0).toUpperCase())
                    .join("") || "ST";

                return (
                  <button
                    key={student.studentId}
                    type="button"
                    onClick={() => handleOpenStudent(student.studentId)}
                    className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md transition-all text-left flex items-center justify-between group active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {student.passportUrl ? (
                        <img
                          src={student.passportUrl}
                          alt={student.studentName}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-black flex items-center justify-center shrink-0 shadow-xs">
                          {initials}
                        </div>
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate block">
                          {student.studentName}
                        </span>
                        <span className="text-[10px] font-mono font-medium text-slate-400 block">
                          {student.admissionNumber}
                        </span>
                      </div>
                    </div>
                    <div className="h-8 px-3 rounded-lg bg-slate-50 group-hover:bg-slate-900 group-hover:text-white text-slate-600 text-[11px] font-bold flex items-center gap-1 transition-all shrink-0 ml-2">
                      <FileText size={12} />
                      <span>View</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
