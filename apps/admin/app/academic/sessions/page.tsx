"use client";

import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";
import {
  CalendarDays,
  Sparkles,
  Layers,
  X,
  Hash,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { SessionCreationForm } from "./components/SessionCreationForm";
import { TermCreationForm } from "./components/TermCreationForm";
import { SessionDirectory } from "./components/SessionDirectory";

type SessionRecord = {
  _id: string;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  createdAt: number;
};

type SubjectRecord = {
  _id: string;
  name: string;
  code: string;
};

export default function SessionsPage() {
  const sessions = useQuery(
    "functions/academic/academicSetup:listSessions" as never
  ) as SessionRecord[] | undefined;
  
  const subjects = useQuery(
    "functions/academic/academicSetup:listSubjects" as never
  ) as SubjectRecord[] | undefined;

  const updateSession = useMutation(
    "functions/academic/academicSetup:updateSession" as never
  );
  const archiveSession = useMutation(
    "functions/academic/academicSetup:archiveSession" as never
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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

  // Handle auto-scroll to selected session on mobile
  useEffect(() => {
    if (selectedSessionId && typeof window !== "undefined" && window.innerWidth < 1024) {
      const scrollTimer = setTimeout(() => {
        const element = document.getElementById(`session-${selectedSessionId}`);
        if (element) {
          const yOffset = -120; // Positions the card comfortably above the fold
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 100);
      return () => clearTimeout(scrollTimer);
    }
  }, [selectedSessionId]);

  const activeSession = useMemo(
    () => sessions?.find((s) => s.isActive) ?? null,
    [sessions]
  );

  const selectedSession = useMemo(
    () => sessions?.find((s) => s._id === selectedSessionId) ?? activeSession ?? null,
    [selectedSessionId, sessions, activeSession]
  );

  const handleMakeActive = async (sessionId: string) => {
    setNotice(null);
    try {
      await updateSession({ sessionId, isActive: true } as never);
      setNotice({ tone: "success", title: "Activation Successful", message: "Academic session is now active." });
    } catch (err) {
      setNotice({ tone: "error", title: "Activation Failed", message: getUserFacingErrorMessage(err, "Failed to activate session") });
    }
  };

  const handleArchive = async (sessionId: string) => {
    if (!window.confirm("Archive this session? History is preserved, but it will be removed from setup lists.")) return;
    setNotice(null);
    try {
      await archiveSession({ sessionId } as never);
      if (selectedSessionId === sessionId) setSelectedSessionId(null);
      setNotice({ tone: "success", title: "Archive Successful", message: "Session moved to history." });
    } catch (err) {
      setNotice({ tone: "error", title: "Archive Failed", message: getUserFacingErrorMessage(err, "Failed to archive session") });
    }
  };

  if (sessions === undefined || subjects === undefined) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-8 md:py-10">
        <div className="animate-pulse space-y-12">
          <div className="h-10 w-48 rounded-lg bg-slate-100" />
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-12">
              <div className="h-64 rounded-xl bg-slate-50" />
            </div>
            <div className="space-y-10">
              <div className="h-48 rounded-xl bg-slate-50" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-[#f8fafc] pointer-events-none" />
      
      <div className="relative mx-auto max-w-[1600px] space-y-4 px-3 py-4 md:space-y-6 md:px-8 md:py-10">
        <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
          <aside className="w-full lg:w-80 lg:shrink-0 space-y-4 md:space-y-6 lg:sticky lg:top-8 h-fit">
            <SessionCreationForm
              onSuccess={(msg) => setNotice({ tone: "success", title: "Success", message: msg })}
              onError={(title, msg) => setNotice({ tone: "error", title, message: msg })}
            />

            <TermCreationForm
              selectedSessionId={selectedSession?._id ?? null}
              selectedSessionName={selectedSession?.name ?? null}
              onSuccess={(msg) => setNotice({ tone: "success", title: "Success", message: msg })}
              onError={(title, msg) => setNotice({ tone: "error", title, message: msg })}
            />

            <div className="pt-4 border-t border-slate-200/60 p-1">
              <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Setup Protocol
              </h4>
              <p className="mt-1 text-[10px] leading-relaxed font-medium text-slate-400">
                Academic records are immutable and pinned to their creation session.
              </p>
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-6 md:space-y-8">
            <AdminHeader
              title="Sessions"
              actions={
                <StatGroup
                  stats={[
                    {
                      label: "Sessions",
                      value: sessions.length,
                      icon: <CalendarDays />,
                    },
                    {
                      label: "Current",
                      value: activeSession?.name.split(" ")[0] ?? "None",
                      icon: <Sparkles />,
                    },
                    {
                      label: "Subjects",
                      value: subjects.length,
                      icon: <Layers />,
                    },
                  ]}
                />
              }
            />

            {notice && (
              <div className={`group relative overflow-hidden rounded-xl border-l-4 p-4 shadow-sm transition-all duration-500 bg-white ${
                notice.tone === "success" ? "border-emerald-500" : "border-rose-500"
              }`}>
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">
                      {notice.title}
                    </p>
                    <p className="text-xs font-bold tracking-tight">{notice.message}</p>
                  </div>
                  <button
                    onClick={() => setNotice(null)}
                    className="rounded-full p-1.5 hover:bg-slate-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100" />
                  </button>
                </div>
              </div>
            )}

            <SessionDirectory
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              onSelectSession={setSelectedSessionId}
              onMakeActive={handleMakeActive}
              onArchive={handleArchive}
            />

            <div className="pt-12 border-t border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Subject Catalog
                  </h4>
                </div>
                <Link
                  href="/academic/subjects"
                  className="group flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  Manage All <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {subjects.slice(0, 9).map((subject, index) => (
                  <AdminSurface 
                    key={subject._id} 
                    intensity="low" 
                    className={`p-4 space-y-3 ${index >= 4 ? "hidden md:block" : ""}`}
                  >
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                      {subject.code.slice(0, 2)}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 leading-tight">
                        {subject.name}
                      </h5>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">
                        {subject.code}
                      </span>
                    </div>
                  </AdminSurface>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
