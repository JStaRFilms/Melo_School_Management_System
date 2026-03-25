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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-950">
          Teaching Scope
        </h2>
        <p className="text-sm text-slate-500">
          Select your session and class. Subject changes save immediately after
          each tick.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Session
          </label>
          <select
            value={selectedSessionId ?? ""}
            onChange={(event) => onSessionChange(event.target.value || null)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-indigo-600"
          >
            <option value="">Select session</option>
            {sessions.map((session) => (
              <option key={session._id} value={session._id}>
                {session.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Class
          </label>
          <select
            value={selectedClassId ?? ""}
            onChange={(event) => onClassChange(event.target.value || null)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-indigo-600"
          >
            <option value="">Select class</option>
            {classes.map((classDoc) => (
              <option key={classDoc._id} value={classDoc._id}>
                {classDoc.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
