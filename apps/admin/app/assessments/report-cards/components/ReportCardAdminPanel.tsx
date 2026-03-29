"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { ReportCardSheetData } from "@school/shared";
import { SchoolLogoManagerCard } from "./SchoolLogoManagerCard";

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
      setCommentSuccess("Comments saved for this student.");
    } catch (error) {
      setCommentError(
        error instanceof Error
          ? error.message
          : "Unable to save comments right now."
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
      } as never);
      setTermDefaultsSuccess("Shared term defaults saved.");
    } catch (error) {
      setTermDefaultsError(
        error instanceof Error
          ? error.message
          : "Unable to save the shared term defaults."
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
      setGroupSuccess("Shared class group saved.");
    } catch (error) {
      setGroupError(
        error instanceof Error
          ? error.message
          : "Unable to save the shared class group."
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
      setGroupSuccess("Shared class group removed.");
    } catch (error) {
      setGroupError(
        error instanceof Error
          ? error.message
          : "Unable to delete the shared class group."
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

  return (
    <div
      className="rc-no-print mx-auto mb-5 px-4 pt-6 md:px-6"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif", maxWidth: '210mm' }}
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
              Report Card Controls
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900">
              Update Comments And Shared Term Settings
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              These controls stay in the admin panel only. Teacher and head
              teacher comments are saved per student, while term defaults and
              class groups control shared report-card dates and attendance totals.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="font-bold text-slate-900">{reportCard.student.name}</div>
            <div>{reportCard.className}</div>
            <div>
              {reportCard.sessionName} • {reportCard.termName}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-700">
                Student Comments
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Save the comments exactly as you want them to appear on this
                student&apos;s report card.
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">
                Class Teacher&apos;s Comment
              </span>
              <textarea
                value={classTeacherComment}
                onChange={(event) => {
                  setClassTeacherComment(event.target.value);
                  setCommentError(null);
                  setCommentSuccess(null);
                }}
                rows={4}
                maxLength={1000}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Enter the class teacher's comment for this student"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">
                Head Teacher&apos;s Comment
              </span>
              <textarea
                value={headTeacherComment}
                onChange={(event) => {
                  setHeadTeacherComment(event.target.value);
                  setCommentError(null);
                  setCommentSuccess(null);
                }}
                rows={4}
                maxLength={1000}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Enter the head teacher's comment for this student"
              />
            </label>

            {commentError ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {commentError}
              </div>
            ) : null}
            {commentSuccess ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {commentSuccess}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveComments}
                disabled={isSavingComments}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingComments ? "Saving comments..." : "Save comments"}
              </button>
            </div>
          </section>

          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-700">
                  Shared Term Defaults
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  These defaults apply to every class in the selected term unless
                  a class-group override replaces them.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Default next-term start date
                </span>
                <input
                  type="date"
                  value={defaultNextTermBegins}
                  onChange={(event) => {
                    setDefaultNextTermBegins(event.target.value);
                    setTermDefaultsError(null);
                    setTermDefaultsSuccess(null);
                  }}
                  className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Default number of times opened
                </span>
                <input
                  type="number"
                  min={0}
                  value={defaultTimesOpened}
                  onChange={(event) => {
                    setDefaultTimesOpened(event.target.value);
                    setTermDefaultsError(null);
                    setTermDefaultsSuccess(null);
                  }}
                  className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="Leave blank if not set"
                />
              </label>

              <p className="mt-3 text-xs text-slate-500">
                Leave any field empty if you want classes without overrides to
                fall back to a dash for now.
              </p>

              {termDefaultsError ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {termDefaultsError}
                </div>
              ) : null}
              {termDefaultsSuccess ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {termDefaultsSuccess}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveTermDefaults}
                  disabled={isSavingTermDefaults || !termSettingsReady}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingTermDefaults ? "Saving defaults..." : "Save defaults"}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-700">
                  Shared Class Groups
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Group classes that share the same dates or number of times opened.
                  A class can belong to only one group in this term.
                </p>
              </div>

              <div className="space-y-2">
                {(termSettings?.groups ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                    No shared groups yet.
                  </div>
                ) : (
                  termSettings?.groups.map((group) => (
                    <button
                      key={group._id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(group._id);
                        setGroupError(null);
                        setGroupSuccess(null);
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        selectedGroupId === group._id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold">{group.name}</div>
                      <div className={`mt-1 text-xs ${selectedGroupId === group._id ? "text-slate-200" : "text-slate-500"}`}>
                        {group.classIds.length} class{group.classIds.length === 1 ? "" : "es"} selected
                        {group.timesSchoolOpened !== null ? ` • Opened: ${group.timesSchoolOpened}` : ""}
                        {group.nextTermBegins !== null ? ` • Date set` : ""}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    {groupId ? "Edit shared group" : "Create shared group"}
                  </h4>
                  <button
                    type="button"
                    onClick={resetGroupEditor}
                    className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500"
                  >
                    New group
                  </button>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">
                    Group name
                  </span>
                  <input
                    value={groupName}
                    onChange={(event) => {
                      setGroupName(event.target.value);
                      setGroupError(null);
                      setGroupSuccess(null);
                    }}
                    className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    placeholder="Primary classes on the same calendar"
                  />
                </label>

                <div>
                  <span className="mb-2 block text-sm font-semibold text-slate-800">
                    Classes in this group
                  </span>
                  <div className="grid max-h-44 gap-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    {(classes ?? []).map((classOption) => {
                      const checked = groupClassIds.includes(classOption.id);
                      return (
                        <label key={classOption.id} className="flex items-center gap-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setGroupClassIds((current) =>
                                event.target.checked
                                  ? [...current, classOption.id]
                                  : current.filter((id) => id !== classOption.id)
                              );
                              setGroupError(null);
                              setGroupSuccess(null);
                            }}
                          />
                          <span>{classOption.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">
                    Group next-term start date
                  </span>
                  <input
                    type="date"
                    value={groupNextTermBegins}
                    onChange={(event) => {
                      setGroupNextTermBegins(event.target.value);
                      setGroupError(null);
                      setGroupSuccess(null);
                    }}
                    className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-800">
                    Group number of times opened
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={groupTimesOpened}
                    onChange={(event) => {
                      setGroupTimesOpened(event.target.value);
                      setGroupError(null);
                      setGroupSuccess(null);
                    }}
                    className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    placeholder="Leave blank if this group only overrides the date"
                  />
                </label>

                {groupError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {groupError}
                  </div>
                ) : null}
                {groupSuccess ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {groupSuccess}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3">
                  {groupId ? (
                    <button
                      type="button"
                      onClick={handleDeleteGroup}
                      disabled={isDeletingGroup}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-white px-5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeletingGroup ? "Deleting..." : "Delete group"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSaveGroup}
                    disabled={isSavingGroup}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingGroup ? "Saving group..." : "Save group"}
                  </button>
                </div>
              </div>
            </section>

            <SchoolLogoManagerCard
              schoolName={reportCard.schoolName}
              schoolLogoUrl={reportCard.schoolLogoUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
