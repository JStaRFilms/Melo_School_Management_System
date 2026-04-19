"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { ReportCardSheetData } from "@school/shared";
import { SchoolLogoManagerCard } from "./SchoolLogoManagerCard";
import { 
  MessageSquare, 
  Calendar, 
  Users, 
  Image as ImageIcon, 
  Save, 
  Trash2, 
  Plus 
} from "lucide-react";

function formatDateInputValue(value: number | null) {
  if (!value) return "";

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).getTime();
}

function parseIntegerInputValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function ReportCardAdminPanel({
  studentId,
  sessionId,
  termId,
  reportCard,
}: {
  studentId: string;
  sessionId: string;
  termId: string;
  reportCard: ReportCardSheetData;
}) {
  const termSettings = useQuery(
    "functions/academic/reportCardTermSettings:getTermReportCardSettings" as never,
    termId ? ({ termId } as never) : ("skip" as never)
  ) as
    | {
        termId: string;
        nextTermBegins: number | null;
        defaultTimesSchoolOpened: number | null;
        resultCalculationMode: "standalone" | "cumulative_annual";
        groups: Array<{
          _id: string;
          name: string;
          classIds: string[];
          nextTermBegins: number | null;
          timesSchoolOpened: number | null;
        }>;
      }
    | undefined;
  const classes = useQuery(
    "functions/academic/adminSelectors:getAllClasses" as never
  ) as Array<{ id: string; name: string }> | undefined;
  const saveComments = useMutation(
    "functions/academic/reportCards:saveStudentReportCardComments" as never
  );
  const saveTermDefaults = useMutation(
    "functions/academic/reportCardTermSettings:saveTermReportCardDefaults" as never
  );
  const saveTermGroup = useMutation(
    "functions/academic/reportCardTermSettings:saveTermReportCardSettingGroup" as never
  );
  const deleteTermGroup = useMutation(
    "functions/academic/reportCardTermSettings:deleteTermReportCardSettingGroup" as never
  );

  const [classTeacherComment, setClassTeacherComment] = useState(
    reportCard.classTeacherComment ?? ""
  );
  const [headTeacherComment, setHeadTeacherComment] = useState(
    reportCard.headTeacherComment ?? ""
  );
  const [defaultNextTermBegins, setDefaultNextTermBegins] = useState(
    formatDateInputValue(reportCard.student.nextTermBegins)
  );
  const [defaultTimesOpened, setDefaultTimesOpened] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupClassIds, setGroupClassIds] = useState<string[]>([]);
  const [groupNextTermBegins, setGroupNextTermBegins] = useState("");
  const [groupTimesOpened, setGroupTimesOpened] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSuccess, setGroupSuccess] = useState<string | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [termSettingsReady, setTermSettingsReady] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isSavingTermDefaults, setIsSavingTermDefaults] = useState(false);
  const [termDefaultsError, setTermDefaultsError] = useState<string | null>(null);
  const [termDefaultsSuccess, setTermDefaultsSuccess] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null);
  const [isSavingComments, setIsSavingComments] = useState(false);

  useEffect(() => {
    setClassTeacherComment(reportCard.classTeacherComment ?? "");
  }, [reportCard.classTeacherComment, studentId, sessionId, termId]);

  useEffect(() => {
    setHeadTeacherComment(reportCard.headTeacherComment ?? "");
  }, [reportCard.headTeacherComment, studentId, sessionId, termId]);

  useEffect(() => {
    setDefaultNextTermBegins(formatDateInputValue(reportCard.student.nextTermBegins));
  }, [reportCard.student.nextTermBegins, termId]);

  useEffect(() => {
    if (!termSettings) return;
    setDefaultNextTermBegins(formatDateInputValue(termSettings.nextTermBegins));
    setDefaultTimesOpened(
      termSettings.defaultTimesSchoolOpened === null
        ? ""
        : String(termSettings.defaultTimesSchoolOpened)
    );
    setTermSettingsReady(true);
  }, [termSettings]);

  const selectedGroup = useMemo(
    () =>
      termSettings?.groups.find((group) => group._id === selectedGroupId) ?? null,
    [selectedGroupId, termSettings]
  );

  useEffect(() => {
    if (!selectedGroup) {
      setGroupId(null);
      setGroupName("");
      setGroupClassIds([]);
      setGroupNextTermBegins("");
      setGroupTimesOpened("");
      return;
    }
    setGroupId(selectedGroup._id);
    setGroupName(selectedGroup.name);
    setGroupClassIds(selectedGroup.classIds);
    setGroupNextTermBegins(formatDateInputValue(selectedGroup.nextTermBegins));
    setGroupTimesOpened(
      selectedGroup.timesSchoolOpened === null
        ? ""
        : String(selectedGroup.timesSchoolOpened)
    );
  }, [selectedGroup]);

  const handleSaveComments = async () => {
    setIsSavingComments(true);
    setCommentError(null);
    setCommentSuccess(null);

    try {
      await saveComments({
        studentId,
        sessionId,
        termId,
        classTeacherComment,
        headTeacherComment,
      } as never);
      setCommentSuccess("Comments saved.");
    } catch (error) {
      setCommentError(
        error instanceof Error
          ? error.message
          : "Unable to save comments."
      );
    } finally {
      setIsSavingComments(false);
    }
  };

  const handleSaveTermDefaults = async () => {
    setIsSavingTermDefaults(true);
    setTermDefaultsError(null);
    setTermDefaultsSuccess(null);

    try {
      await saveTermDefaults({
        termId,
        nextTermBegins: parseDateInputValue(defaultNextTermBegins),
        defaultTimesSchoolOpened: parseIntegerInputValue(defaultTimesOpened),
        resultCalculationMode:
          termSettings?.resultCalculationMode ??
          reportCard.resultCalculationMode ??
          "standalone",
      } as never);
      setTermDefaultsSuccess("Term defaults saved.");
    } catch (error) {
      setTermDefaultsError(
        error instanceof Error
          ? error.message
          : "Unable to save defaults."
      );
    } finally {
      setIsSavingTermDefaults(false);
    }
  };

  const handleSaveGroup = async () => {
    setIsSavingGroup(true);
    setGroupError(null);
    setGroupSuccess(null);

    try {
      const nextGroupId = (await saveTermGroup({
        groupId,
        termId,
        name: groupName,
        classIds: groupClassIds,
        nextTermBegins: parseDateInputValue(groupNextTermBegins),
        timesSchoolOpened: parseIntegerInputValue(groupTimesOpened),
      } as never)) as string;
      setSelectedGroupId(nextGroupId);
      setGroupSuccess("Class group saved.");
    } catch (error) {
      setGroupError(
        error instanceof Error
          ? error.message
          : "Unable to save group."
      );
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;
    setIsDeletingGroup(true);
    setGroupError(null);
    setGroupSuccess(null);
    try {
      await deleteTermGroup({ groupId } as never);
      setSelectedGroupId(null);
      setGroupSuccess("Group removed.");
    } catch (error) {
      setGroupError(
        error instanceof Error
          ? error.message
          : "Unable to delete group."
      );
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const resetGroupEditor = () => {
    setSelectedGroupId(null);
    setGroupId(null);
    setGroupName("");
    setGroupClassIds([]);
    setGroupNextTermBegins("");
    setGroupTimesOpened("");
    setGroupError(null);
    setGroupSuccess(null);
  };

  const missingDataSubjects = reportCard.results.filter(
    (r) => r.calculationMode === "cumulative_annual" && r.missingHistoricalTerms && r.missingHistoricalTerms.length > 0
  );

  return (
    <div className="rc-no-print space-y-10">
      {reportCard.resultCalculationMode === "cumulative_annual" && missingDataSubjects.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 min-w-fit">
              <svg className="h-5 w-5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900">Missing prior-term data</h4>
              <p className="mt-1 text-xs text-rose-700/90 leading-relaxed font-medium">
                Cumulative annual computation cannot complete because {missingDataSubjects.length} subject{missingDataSubjects.length === 1 ? " is" : "s are"} missing scores from previous terms.
              </p>
              <p className="mt-2 text-xs font-semibold text-rose-800">
                Printing stays blocked until the missing prior-term totals are backfilled.
              </p>
              <Link
                href={`/assessments/report-cards/backfill?sessionId=${sessionId}&classId=${reportCard.classId}`}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-rose-950 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-rose-800"
              >
                Open historical backfill
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Student Specific Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <MessageSquare className="h-4 w-4 text-slate-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Student Performance
          </h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-900 ml-1">Class Teacher Comment</span>
            <textarea
              value={classTeacherComment}
              onChange={(event) => {
                setClassTeacherComment(event.target.value);
                setCommentError(null);
                setCommentSuccess(null);
              }}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-950/5 resize-none"
              placeholder="Observation on progress..."
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-900 ml-1">Head Teacher Comment</span>
            <textarea
              value={headTeacherComment}
              onChange={(event) => {
                setHeadTeacherComment(event.target.value);
                setCommentError(null);
                setCommentSuccess(null);
              }}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-950/5 resize-none"
              placeholder="Final administrative remarks..."
            />
          </div>

          {(commentError || commentSuccess) && (
            <div className={`text-[11px] font-bold px-1 animate-in fade-in slide-in-from-top-1 ${commentError ? "text-rose-500" : "text-emerald-500"}`}>
              {commentError || commentSuccess}
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveComments}
            disabled={isSavingComments}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed shadow-md active:scale-[0.98]"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSavingComments ? "Saving..." : "Save Comments"}</span>
          </button>
        </div>
      </section>

      {/* Global Term Settings */}
      <section className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center gap-2 px-1">
          <Calendar className="h-4 w-4 text-slate-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Term Logistics
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-900 ml-1">Resumption</span>
            <input
              type="date"
              value={defaultNextTermBegins}
              onChange={(event) => setDefaultNextTermBegins(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-[13px] font-medium text-slate-900 outline-none transition focus:border-slate-400"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-900 ml-1">Times Opened</span>
            <input
              type="number"
              value={defaultTimesOpened}
              onChange={(event) => setDefaultTimesOpened(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-[13px] font-medium text-slate-900 outline-none transition focus:border-slate-400"
              placeholder="Total days"
            />
          </div>
        </div>

        {(termDefaultsError || termDefaultsSuccess) && (
          <div className={`text-[11px] font-bold px-1 animate-in fade-in slide-in-from-top-1 ${termDefaultsError ? "text-rose-500" : "text-emerald-500"}`}>
            {termDefaultsError || termDefaultsSuccess}
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveTermDefaults}
          disabled={isSavingTermDefaults || !termSettingsReady}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50 disabled:opacity-30 shadow-sm active:scale-[0.98]"
        >
          <Save className="h-3.5 w-3.5 opacity-40" />
          <span>Save Defaults</span>
        </button>
      </section>

      {/* Class Overrides / Groups */}
      <section className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Class Groups
            </h3>
          </div>
          <button onClick={resetGroupEditor} className="p-1 hover:bg-slate-100 rounded-lg transition-colors group">
            <Plus className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-900" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {(termSettings?.groups ?? []).map((group) => (
            <button
              key={group._id}
              type="button"
              onClick={() => setSelectedGroupId(group._id)}
              className={`flex-none px-4 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                selectedGroupId === group._id
                  ? "bg-slate-950 border-slate-950 text-white shadow-lg shadow-slate-950/20"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {group.name}
            </button>
          ))}
          {(termSettings?.groups ?? []).length === 0 && (
            <div className="text-[11px] font-medium text-slate-300 px-1 py-1 italic">No overrides set.</div>
          )}
        </div>

        {(selectedGroupId || groupName) && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-slate-100 bg-slate-50/30 p-3">
             <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-900 ml-1">Group Name</span>
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-900 outline-none transition focus:border-slate-400"
                placeholder="e.g. Preschool"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-900 ml-1">Included Classes</span>
              <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                {(classes ?? []).map((classOption) => (
                  <label key={classOption.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupClassIds.includes(classOption.id)}
                      onChange={(event) => {
                        setGroupClassIds(cur => 
                          event.target.checked ? [...cur, classOption.id] : cur.filter(id => id !== classOption.id)
                        );
                      }}
                      className="rounded border-slate-300 text-slate-950 focus:ring-slate-950"
                    />
                    <span className="text-[12px] font-medium text-slate-600">{classOption.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-900 ml-1">Resumption</span>
                <input
                  type="date"
                  value={groupNextTermBegins}
                  onChange={(event) => setGroupNextTermBegins(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-900 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-900 ml-1">Opened</span>
                <input
                  type="number"
                  value={groupTimesOpened}
                  onChange={(event) => setGroupTimesOpened(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-900 outline-none"
                  placeholder="Days"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveGroup}
                disabled={isSavingGroup}
                className="flex-1 h-9 flex items-center justify-center rounded-lg bg-slate-950 text-[10px] font-black uppercase tracking-widest text-white shadow-sm"
              >
                {isSavingGroup ? "Saving..." : "Save Group"}
              </button>
              {groupId && (
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={isDeletingGroup}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {(groupError || groupSuccess) && (
              <p className={`text-[10px] font-bold text-center ${groupError ? "text-rose-500" : "text-emerald-500"}`}>
                {groupError || groupSuccess}
              </p>
            )}
          </div>
        )}
      </section>

      {/* School Setup */}
      <section className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center gap-2 px-1">
          <ImageIcon className="h-4 w-4 text-slate-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Branding
          </h3>
        </div>
        <SchoolLogoManagerCard
          schoolName={reportCard.schoolName}
          schoolLogoUrl={reportCard.schoolLogoUrl}
        />
      </section>
    </div>
  );
}
