import { Check, Minus } from "lucide-react";
import type { ReadinessRow, ReadinessStatus } from "./types";

const columns: Array<{ key: keyof ReadinessRow; label: string }> = [
  { key: "sourceStatus", label: "Source" },
  { key: "lessonPlanStatus", label: "Plan" },
  { key: "studentNoteStatus", label: "Note" },
  { key: "assignmentStatus", label: "Task" },
  { key: "assessmentStatus", label: "Assessment" },
  { key: "studentPublicationStatus", label: "Published" },
];

function hasEvidence(status: ReadinessStatus) {
  return !status.startsWith("no_");
}

function EvidenceCell({ status }: { status: ReadinessStatus }) {
  const prepared = hasEvidence(status);
  return (
    <span
      aria-label={prepared ? "Preparation evidence recorded" : "No preparation evidence recorded"}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${prepared ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
    >
      {prepared ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Minus className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}

export function ReadinessEvidenceTable({ rows }: { rows: ReadinessRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="font-display text-base font-bold text-slate-950">Topic evidence</h2>
        <p className="mt-0.5 text-xs text-slate-500">Each mark reflects an existing preparation record.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-left">
          <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
            <tr><th className="px-4 py-3">Topic</th>{columns.map((column) => <th key={column.key} className="px-3 py-3 text-center">{column.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.topicId} className="hover:bg-slate-50/70">
                <th scope="row" className="max-w-[280px] px-4 py-3 text-sm font-bold text-slate-800">{row.title}</th>
                {columns.map((column) => <td key={column.key} className="px-3 py-3 text-center"><EvidenceCell status={row[column.key] as ReadinessStatus} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
