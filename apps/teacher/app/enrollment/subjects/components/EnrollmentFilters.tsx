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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      <div className="space-y-1.5">
        <label className="block px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-70">
          Teaching Class
        </label>
        <div className="group relative">
          <select
            value={selectedClassId ?? ""}
            onChange={(event) => onClassChange(event.target.value || null)}
            className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-400 focus:ring-4 focus:ring-slate-950/5"
          >
            <option value="">Select class</option>
            {classes.map((classDoc) => (
              <option key={classDoc._id} value={classDoc._id}>
                {classDoc.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-600">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-70">
          Active Session
        </label>
        <div className="group relative">
          <select
            value={selectedSessionId ?? ""}
            onChange={(event) => onSessionChange(event.target.value || null)}
            className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-400 focus:ring-4 focus:ring-slate-950/5"
          >
            <option value="">Select session</option>
            {sessions.map((session) => (
              <option key={session._id} value={session._id}>
                {session.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-600">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
