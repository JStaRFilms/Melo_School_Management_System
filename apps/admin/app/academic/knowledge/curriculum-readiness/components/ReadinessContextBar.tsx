import type { SelectOption } from "./types";

interface ReadinessContextBarProps {
  subjects: SelectOption[];
  levels: SelectOption[];
  terms: SelectOption[];
  subjectId: string;
  level: string;
  termId: string;
  onSubjectChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onTermChange: (value: string) => void;
}

function ContextSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5 shadow-2xs"
      >
        <option value="">Choose {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ReadinessContextBar({
  subjects,
  levels,
  terms,
  subjectId,
  level,
  termId,
  onSubjectChange,
  onLevelChange,
  onTermChange,
}: ReadinessContextBarProps) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ContextSelect label="Subject" value={subjectId} options={subjects} onChange={onSubjectChange} />
        <ContextSelect label="Class / Grade Level" value={level} options={levels} onChange={onLevelChange} />
        <ContextSelect label="Academic Term" value={termId} options={terms} onChange={onTermChange} />
      </div>
    </section>
  );
}
