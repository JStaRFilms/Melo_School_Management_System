"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { ReportCardSheetData } from "@school/shared";
import { 
  MessageSquare, 
  Calendar, 
  Users, 
  Image as ImageIcon, 
  Save, 
  Trash2, 
  Plus,
  AlertTriangle,
  X,
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

function formatDayAfterInputValue(value: number | null) {
  if (!value) return undefined;

  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return formatDateInputValue(date.getTime());
}

function formatDisplayDate(value: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value)
  );
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
        termEndDate: number;
        nextTermBegins: number | null;
        linkedNextTermName: string | null;
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
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
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
      if (!isCreatingGroup) {
        setGroupId(null);
        setGroupName("");
        setGroupClassIds([]);
        setGroupNextTermBegins("");
        setGroupTimesOpened("");
      }
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
  }, [selectedGroup, isCreatingGroup]);

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
      const nextTermBegins = parseDateInputValue(defaultNextTermBegins);
      if (
        nextTermBegins !== null &&
        termSettings &&
        nextTermBegins <= termSettings.termEndDate
      ) {
        throw new Error(
          `Resumption must be after this term ends on ${formatDisplayDate(termSettings.termEndDate)}.`
        );
      }

      await saveTermDefaults({
        termId,
        nextTermBegins,
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
      const nextTermBegins = parseDateInputValue(groupNextTermBegins);
      if (
        nextTermBegins !== null &&
        termSettings &&
        nextTermBegins <= termSettings.termEndDate
      ) {
        throw new Error(
          `Resumption must be after this term ends on ${formatDisplayDate(termSettings.termEndDate)}.`
        );
      }

      const nextGroupId = (await saveTermGroup({
        groupId,
        termId,
        name: groupName,
        classIds: groupClassIds,
        nextTermBegins,
        timesSchoolOpened: parseIntegerInputValue(groupTimesOpened),
      } as never)) as string;
      setSelectedGroupId(nextGroupId);
      setIsCreatingGroup(false);
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
      setIsCreatingGroup(false);
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

  const handleStartCreateGroup = () => {
    setSelectedGroupId(null);
    setGroupId(null);
    setGroupName("");
    setGroupClassIds([]);
    setGroupNextTermBegins("");
    setGroupTimesOpened("");
    setGroupError(null);
    setGroupSuccess(null);
    setIsCreatingGroup(true);
  };

  const handleCancelGroupEditor = () => {
    setSelectedGroupId(null);
    setIsCreatingGroup(false);
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
                Printing stays blocked until the totals are backfilled or an audited manual calculation is approved.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/assessments/report-cards/manual-adjustments?sessionId=${sessionId}&termId=${termId}&classId=${reportCard.classId}&studentId=${studentId}`}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-rose-950 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-rose-800"
                >
                  Open manual adjustments
                </Link>
                <Link
                  href={`/assessments/report-cards/backfill?sessionId=${sessionId}&classId=${reportCard.classId}`}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.18em] text-rose-800 transition hover:bg-rose-100"
                >
                  Historical backfill
                </Link>
              </div>
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
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-900 ml-1">Resumption</span>
              {termSettings?.linkedNextTermName && (
                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                  {termSettings.linkedNextTermName}
                </span>
              )}
            </div>
            <input
              type="date"
              value={defaultNextTermBegins}
              min={formatDayAfterInputValue(termSettings?.termEndDate ?? null)}
              onChange={(event) => {
                setDefaultNextTermBegins(event.target.value);
                setTermDefaultsError(null);
                setTermDefaultsSuccess(null);
              }}
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

        {termSettings?.linkedNextTermName &&
          defaultNextTermBegins &&
          defaultNextTermBegins !==
            formatDateInputValue(termSettings.nextTermBegins) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-[11px] font-medium text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Calendar Sync:</strong> Saving this date will update the start date of{" "}
                <strong>{termSettings.linkedNextTermName}</strong> across your school calendar.
              </span>
            </div>
          )}

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
          <button
            type="button"
            onClick={
              isCreatingGroup || selectedGroupId
                ? handleCancelGroupEditor
                : handleStartCreateGroup
            }
            className="px-2 py-1 hover:bg-slate-100 rounded-lg transition-colors group flex items-center gap-1 text-[11px] font-bold text-slate-500"
            title={
              isCreatingGroup || selectedGroupId
                ? "Close form"
                : "Create new class group override"
            }
          >
            {isCreatingGroup || selectedGroupId ? (
              <>
                <X className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900" />
                <span className="text-[10px] font-semibold">Close</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900" />
                <span className="text-[10px] font-semibold">Add Group</span>
              </>
            )}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {(termSettings?.groups ?? []).map((group) => (
            <button
              key={group._id}
              type="button"
              onClick={() => {
                if (selectedGroupId === group._id) {
                  handleCancelGroupEditor();
                } else {
                  setIsCreatingGroup(false);
                  setSelectedGroupId(group._id);
                }
              }}
              className={`flex-none px-4 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                selectedGroupId === group._id
                  ? "bg-slate-950 border-slate-950 text-white shadow-lg shadow-slate-950/20"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {group.name}
            </button>
          ))}
          {(termSettings?.groups ?? []).length === 0 && !isCreatingGroup && (
            <div className="flex items-center justify-between w-full p-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
              <span className="text-[11px] font-medium text-slate-400 italic">No overrides set</span>
              <button
                type="button"
                onClick={handleStartCreateGroup}
                className="text-[11px] font-bold text-slate-700 hover:text-slate-950 underline underline-offset-2"
              >
                + Create Override
              </button>
            </div>
          )}
        </div>

        {(isCreatingGroup || selectedGroupId !== null) && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                {selectedGroupId
                  ? `Edit "${groupName || "Group"}"`
                  : "New Class Group Override"}
              </h4>
              <button
                type="button"
                onClick={handleCancelGroupEditor}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
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
                  min={formatDayAfterInputValue(termSettings?.termEndDate ?? null)}
                  onChange={(event) => {
                    setGroupNextTermBegins(event.target.value);
                    setGroupError(null);
                    setGroupSuccess(null);
                  }}
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
      <section className="space-y-3 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-slate-400" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              School Branding
            </h3>
          </div>
          <Link
            href="/admin/settings"
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Manage in Settings &rarr;
          </Link>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed px-1">
          School crest, official motto, and brand colors are managed in{" "}
          <Link href="/admin/settings" className="font-semibold text-slate-700 underline">
            School Profile &amp; Branding Settings
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
