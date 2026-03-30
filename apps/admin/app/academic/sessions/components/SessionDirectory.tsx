"use client";

import { useQuery } from "convex/react";
import { Plus, CheckCircle2, History, Calendar, Trash2 } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";

type SessionRecord = {
  _id: string;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
};

type TermRecord = {
  _id: string;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
};

interface SessionDirectoryProps {
  sessions: SessionRecord[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onMakeActive: (id: string) => void;
  onArchive: (id: string) => void;
}

function TermBadge({ term }: { term: TermRecord }) {
  const dateStr = `${new Date(term.startDate).toLocaleDateString()} - ${new Date(term.endDate).toLocaleDateString()}`;
  return (
    <div
      className={`group flex items-center justify-between rounded-lg border px-3 py-2 transition-all ${
        term.isActive
          ? "border-indigo-100 bg-indigo-50/50"
          : "border-slate-100 bg-white"
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <span className={`text-[9px] font-bold uppercase tracking-wider ${
          term.isActive ? "text-indigo-600" : "text-slate-400"
        }`}>
          {term.name}
        </span>
        <span className="text-[10px] font-medium text-slate-600 tracking-tight">
          {dateStr}
        </span>
      </div>
      {term.isActive && (
        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
          Active
        </span>
      )}
    </div>
  );
}

export function SessionDirectory({
  sessions,
  selectedSessionId,
  onSelectSession,
  onMakeActive,
  onArchive,
}: SessionDirectoryProps) {
  const terms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    selectedSessionId ? ({ sessionId: selectedSessionId } as never) : ("skip" as never)
  ) as TermRecord[] | undefined;

  return (
    <div className="space-y-4">
      <div className="space-y-1 px-1">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Academic Timeline
        </h4>
      </div>

      <div className="grid gap-3">
        {sessions.map((session) => {
          const isSelected = session._id === selectedSessionId;
          const startDate = new Date(session.startDate).toLocaleDateString();
          const endDate = new Date(session.endDate).toLocaleDateString();

          return (
            <div key={session._id} className="group relative">
              <AdminSurface
                intensity={isSelected ? "high" : "medium"}
                className={`overflow-hidden transition-all duration-500 ${
                  isSelected ? "ring-2 ring-indigo-500/20" : "hover:border-slate-300"
                }`}
              >
                <div
                  onClick={() => onSelectSession(session._id)}
                  className="flex cursor-pointer items-center justify-between p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      session.isActive ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"
                    }`}>
                      {session.isActive ? <CheckCircle2 size={20} /> : <History size={20} />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {session.name}
                        </h3>
                        {session.isActive && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-medium text-slate-500">
                        {startDate} — {endDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    {!session.isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMakeActive(session._id);
                        }}
                        className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-100"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive(session._id);
                      }}
                      className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="border-t border-slate-100 bg-slate-50/30 p-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid gap-2 mb-4">
                      {terms ? (
                        terms.length > 0 ? (
                          terms.map((term) => <TermBadge key={term._id} term={term} />)
                        ) : (
                          <div className="py-6 text-center">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                              No terms defined yet.
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="h-20 w-full animate-pulse rounded-lg bg-slate-100" />
                      )}
                    </div>
                  </div>
                )}
              </AdminSurface>
            </div>
          );
        })}

        {sessions.length === 0 && (
          <AdminSurface intensity="low" className="p-12 text-center">
            <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-3" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Zero sessions found.
            </p>
          </AdminSurface>
        )}
      </div>
    </div>
  );
}
