import type { ClassSummary, SessionSummary } from "./types";

interface EnrollmentFiltersProps {
  classes: ClassSummary[];
  sessions: SessionSummary[];
  selectedClassId: string | null;
  selectedSessionId: string | null;
  onClassChange: (value: string | null) => void;
  onSessionChange: (value: string | null) => void;
}

export function EnrollmentFilters({
  classes,
  sessions,
  selectedClassId,
  selectedSessionId,
  onClassChange,
  onSessionChange,
}: EnrollmentFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 w-full border-b border-slate-950/5 pb-6">
      <div className="flex-1 space-y-1.5">
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60 px-1">
          Class Context
        </label>
        <div className="relative group">
          <select
            value={selectedClassId ?? ""}
            onChange={(event) => onClassChange(event.target.value || null)}
            className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white/60 backdrop-blur-sm px-3.5 text-xs font-bold text-slate-950 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-slate-950/5 focus:border-slate-300 pr-10"
          >
            <option value="">Select class</option>
            {classes.map((classDoc) => (
              <option key={classDoc._id} value={classDoc._id}>
                {classDoc.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 transition-colors group-focus-within:text-slate-600">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60 px-1">
          Academic Session
        </label>
        <div className="relative group">
          <select
            value={selectedSessionId ?? ""}
            onChange={(event) => onSessionChange(event.target.value || null)}
            className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white/60 backdrop-blur-sm px-3.5 text-xs font-bold text-slate-950 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-slate-950/5 focus:border-slate-300 pr-10"
          >
            <option value="">Select session</option>
            {sessions.map((session) => (
              <option key={session._id} value={session._id}>
                {session.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 transition-colors group-focus-within:text-slate-600">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
}
