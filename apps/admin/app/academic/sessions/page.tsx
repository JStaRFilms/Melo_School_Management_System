"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Hash, Plus, PlusSquare } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { humanNameFinal, humanNameTyping } from "@/human-name";

type SessionRecord = {
  _id: string;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  createdAt: number;
};

type TermRecord = {
  _id: string;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  createdAt: number;
};

function toDateInput(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export default function SessionsPage() {
  const sessions = useQuery(
    "functions/academic/academicSetup:listSessions" as never
  ) as SessionRecord[] | undefined;
  const subjects = useQuery(
    "functions/academic/academicSetup:listSubjects" as never
  ) as Array<{ _id: string; name: string; code: string }> | undefined;
  const createSession = useMutation(
    "functions/academic/academicSetup:createSession" as never
  );
  const createTerm = useMutation(
    "functions/academic/academicSetup:createTerm" as never
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [sessionStartDate, setSessionStartDate] = useState("");
  const [sessionEndDate, setSessionEndDate] = useState("");
  const [activateSession, setActivateSession] = useState(true);
  const [termName, setTermName] = useState("First Term");
  const [termStartDate, setTermStartDate] = useState("");
  const [termEndDate, setTermEndDate] = useState("");
  const [activateTerm, setActivateTerm] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isSavingTerm, setIsSavingTerm] = useState(false);

  useEffect(() => {
    if (!sessions || sessions.length === 0) {
      return;
    }

    const activeSession = sessions.find((session) => session.isActive);
    setSelectedSessionId((current) => current ?? activeSession?._id ?? sessions[0]._id);
  }, [sessions]);

  const selectedSession = useMemo(
    () => sessions?.find((session) => session._id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const terms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    selectedSessionId ? ({ sessionId: selectedSessionId } as never) : ("skip" as never)
  ) as TermRecord[] | undefined;

  const handleCreateSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedSessionName = humanNameFinal(sessionName);
    if (!normalizedSessionName || !sessionStartDate || !sessionEndDate) {
      return;
    }

    setIsSavingSession(true);
    setError(null);

    try {
      await createSession({
        name: normalizedSessionName,
        startDate: new Date(sessionStartDate).getTime(),
        endDate: new Date(sessionEndDate).getTime(),
        isActive: activateSession,
      } as never);
      setSessionName("");
      setSessionStartDate("");
      setSessionEndDate("");
      setActivateSession(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setIsSavingSession(false);
    }
  };

  const handleCreateTerm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTermName = humanNameFinal(termName);
    if (!selectedSessionId || !normalizedTermName || !termStartDate || !termEndDate) {
      return;
    }

    setIsSavingTerm(true);
    setError(null);

    try {
      await createTerm({
        sessionId: selectedSessionId,
        name: normalizedTermName,
        startDate: new Date(termStartDate).getTime(),
        endDate: new Date(termEndDate).getTime(),
        isActive: activateTerm,
      } as never);
      setTermName("First Term");
      setTermStartDate("");
      setTermEndDate("");
      setActivateTerm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create term");
    } finally {
      setIsSavingTerm(false);
    }
  };

  if (sessions === undefined || subjects === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
        <div className="text-[#64748b]">Loading academic config...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-8 pb-28">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-[0.15em]">
              1. Academic Calendar
            </h2>
            <p className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-tight mt-0.5">
              Define your sessions and terms
            </p>
          </div>
          <div className="h-11 px-5 rounded-xl bg-[#4f46e5] text-white shadow-lg shadow-[#4f46e5]/10 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.025em]">
            <Plus className="w-4 h-4 text-white/50" />
            Add Session
          </div>
        </div>

        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="bg-white border border-dashed border-[#e2e8f0] rounded-2xl p-8 text-center text-[#94a3b8]">
              No academic sessions yet.
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session._id}
                type="button"
                onClick={() => setSelectedSessionId(session._id)}
                className={`w-full text-left rounded-2xl overflow-hidden transition-all ${
                  session._id === selectedSessionId
                    ? "bg-white border-2 border-[#4f46e5]/30 shadow-sm"
                    : "bg-white border border-[#e2e8f0]"
                }`}
              >
                <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#f1f5f9]">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        session.isActive ? "bg-emerald-500" : "bg-[#cbd5e1]"
                      }`}
                    />
                    <h3 className="font-bold text-[#0f172a] tracking-tight">
                      {session.name}
                    </h3>
                    <span
                      className={`text-[8px] font-extrabold uppercase px-2 py-1 rounded-full tracking-[0.05em] border ${
                        session.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]"
                      }`}
                    >
                      {session.isActive ? "Active" : "Archived"}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-[#94a3b8]">
                    {toDateInput(session.startDate)} - {toDateInput(session.endDate)}
                  </span>
                </div>

                {session._id === selectedSessionId ? (
                  <div className="bg-[#f8fafc] p-4 sm:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {(terms ?? []).map((term) => (
                        <div
                          key={term._id}
                          className={`p-3 bg-white rounded-lg flex items-center justify-between ${
                            term.isActive
                              ? "border-2 border-[#4f46e5]"
                              : "border border-[#e2e8f0]"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <span
                              className={`text-[9px] font-bold uppercase tracking-[0.05em] block ${
                                term.isActive ? "text-[#4f46e5]" : "text-[#64748b]"
                              }`}
                            >
                              {term.name}
                            </span>
                            <span className="text-xs font-bold text-[#0f172a]">
                              {toDateInput(term.startDate)} - {toDateInput(term.endDate)}
                            </span>
                          </div>
                          <span
                            className={`text-[8px] font-extrabold uppercase px-2 py-1 rounded-full tracking-[0.05em] ${
                              term.isActive
                                ? "bg-[#4f46e5] text-white"
                                : "bg-[#f1f5f9] text-[#64748b]"
                            }`}
                          >
                            {term.isActive ? "Current" : "Saved"}
                          </span>
                        </div>
                      ))}
                      <div className="p-3 bg-white border border-dashed border-[#e2e8f0] rounded-lg flex items-center justify-center">
                        <div className="flex flex-col items-center gap-1">
                          <Plus className="w-3 h-3 text-[#cbd5e1]" />
                          <span className="text-[9px] font-bold text-[#94a3b8] uppercase">
                            Add Term
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <form
            onSubmit={handleCreateSession}
            className="bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-5 space-y-3"
          >
            <div>
              <h3 className="text-xs font-extrabold text-[#0f172a] uppercase tracking-[0.15em]">
                Create Session
              </h3>
              <p className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-tight mt-0.5">
                Bootstrap the school year first
              </p>
            </div>
            <div>
              <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] block mb-1.5">
                Session Label
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(event) => setSessionName(humanNameTyping(event.target.value))}
                onBlur={(event) => setSessionName(humanNameFinal(event.target.value))}
                className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                placeholder="2026/2027 Academic Session"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] block mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={sessionStartDate}
                  onChange={(event) => setSessionStartDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] block mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={sessionEndDate}
                  onChange={(event) => setSessionEndDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-[#475569]">
              <input
                type="checkbox"
                checked={activateSession}
                onChange={(event) => setActivateSession(event.target.checked)}
                className="rounded border-[#cbd5e1]"
              />
              Set as active session
            </label>
            <button
              type="submit"
              disabled={isSavingSession}
              className="h-11 w-full rounded-xl bg-[#4f46e5] text-white font-bold text-xs uppercase tracking-[0.025em] flex items-center justify-center gap-2 shadow-lg shadow-[#4f46e5]/10 disabled:opacity-50"
            >
              <CalendarPlus className="w-4 h-4 text-white/50" />
              {isSavingSession ? "Saving Session" : "Save Session"}
            </button>
          </form>

          <form
            onSubmit={handleCreateTerm}
            className="bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-5 space-y-3"
          >
            <div>
              <h3 className="text-xs font-extrabold text-[#0f172a] uppercase tracking-[0.15em]">
                Add Term To Active Session
              </h3>
              <p className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-tight mt-0.5">
                Terms sit inside one school session
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] block mb-1.5">
                  Session
                </label>
                <div className="h-11 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a] flex items-center">
                  {selectedSession?.name ?? "Select a session"}
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] block mb-1.5">
                  Term Name
                </label>
                <input
                  type="text"
                  value={termName}
                  onChange={(event) => setTermName(humanNameTyping(event.target.value))}
                  onBlur={(event) => setTermName(humanNameFinal(event.target.value))}
                  className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                  <input
                    type="checkbox"
                    checked={activateTerm}
                    onChange={(event) => setActivateTerm(event.target.checked)}
                    className="rounded border-[#cbd5e1]"
                  />
                  Set active
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] block mb-1.5">
                  Start
                </label>
                <input
                  type="date"
                  value={termStartDate}
                  onChange={(event) => setTermStartDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] block mb-1.5">
                  End
                </label>
                <input
                  type="date"
                  value={termEndDate}
                  onChange={(event) => setTermEndDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSavingTerm || !selectedSessionId}
              className="h-11 w-full rounded-xl bg-[#0f172a] text-white font-bold text-xs uppercase tracking-[0.025em] flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
            >
              <PlusSquare className="w-4 h-4 text-white/50" />
              {isSavingTerm ? "Adding Term" : "Add Term"}
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-4 border-t border-[#f1f5f9] pt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-[0.15em]">
              2. Subject Catalog
            </h2>
            <p className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-tight mt-0.5">
              Manage master list of subjects
            </p>
          </div>
          <Link
            href="/academic/subjects"
            className="h-11 px-5 rounded-xl bg-[#0f172a] text-white shadow-xl flex items-center gap-2 text-xs font-bold uppercase tracking-[0.025em]"
          >
            <Hash className="w-4 h-4 text-white/40" />
            Manage Subjects
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {subjects.slice(0, 5).map((subject) => (
            <div
              key={subject._id}
              className="p-4 bg-white border border-[#e2e8f0] rounded-xl flex flex-col gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-[#4f46e5]/10 text-[#4f46e5] flex items-center justify-center font-bold text-xs">
                {subject.code.slice(0, 2)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0f172a] leading-tight">
                  {subject.name}
                </h4>
                <p className="text-[9px] font-bold text-[#94a3b8] uppercase tracking-[0.15em] mt-0.5">
                  Code: {subject.code}
                </p>
              </div>
            </div>
          ))}
          <Link
            href="/academic/subjects"
            className="p-4 bg-[#f8fafc] border border-dashed border-[#e2e8f0] rounded-xl flex flex-col gap-3 items-center justify-center min-h-[110px]"
          >
            <Plus className="w-5 h-5 text-[#cbd5e1]" />
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-[0.15em]">
              Add Entry
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
