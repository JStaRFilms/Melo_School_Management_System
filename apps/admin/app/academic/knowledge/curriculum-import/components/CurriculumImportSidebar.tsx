"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import type { CurriculumImportForm, CurriculumImportSummary } from "./types";

interface Source { _id: string; title: string; level: string; subjectId?: string; }
interface Subject { _id: string; name: string; }
interface Term { _id: string; name: string; isActive: boolean; }
const INPUT_CLASS = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-blue-400";

interface Props {
  sources: Source[];
  subjects: Subject[];
  terms: Term[];
  imports: CurriculumImportSummary[];
  form: CurriculumImportForm;
  busy: boolean;
  selectedImportId: string | null;
  onFormChange: (form: CurriculumImportForm) => void;
  onSelectImport: (importId: string) => void;
  onSubmit: () => void;
}

export function CurriculumImportSidebar(props: Props) {
  const { sources, subjects, terms, imports, form, busy, selectedImportId } = props;
  const update = (values: Partial<CurriculumImportForm>) => props.onFormChange({ ...form, ...values });
  return (
    <aside className="border-r border-slate-200/70 bg-white/70 lg:h-full lg:overflow-y-auto custom-scrollbar">
      <form onSubmit={(event) => { event.preventDefault(); props.onSubmit(); }} className="space-y-3 border-b border-slate-200/70 p-5">
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">New proposal</p>
        <Field label="Ready curriculum source">
          <select required value={form.materialId} onChange={(event) => {
            const source = sources.find((item) => item._id === event.target.value);
            update({ materialId: event.target.value, level: source?.level || form.level, subjectId: source?.subjectId || form.subjectId });
          }} className={INPUT_CLASS}>
            <option value="">Choose source</option>
            {sources.map((source) => <option key={source._id} value={source._id}>{source.title}</option>)}
          </select>
        </Field>
        <Field label="Subject">
          <select required value={form.subjectId} onChange={(event) => update({ subjectId: event.target.value })} className={INPUT_CLASS}>
            <option value="">Choose subject</option>
            {subjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Level"><input required value={form.level} onChange={(event) => update({ level: event.target.value })} className={INPUT_CLASS} /></Field>
          <Field label="Term"><select required value={form.termId} onChange={(event) => update({ termId: event.target.value })} className={INPUT_CLASS}><option value="">Choose term</option>{terms.map((term) => <option key={term._id} value={term._id}>{term.name}{term.isActive ? " (active)" : ""}</option>)}</select></Field>
        </div>
        <button disabled={busy} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50">
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Extract proposal
        </button>
        <p className="text-[10px] leading-4 text-slate-500">Nothing becomes a school topic until an administrator approves it.</p>
      </form>
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-3 text-[10px] font-black uppercase tracking-[.18em] text-slate-500 backdrop-blur">Recent imports</div>
      {imports.length === 0 ? <p className="p-5 text-xs text-slate-500">No curriculum imports yet.</p> : imports.map((item) => (
        <button key={item._id} onClick={() => props.onSelectImport(item._id)} className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-left ${selectedImportId === item._id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
          <span className="min-w-0"><b className="block truncate text-xs text-slate-900">{item.sourceLabel}</b><span className="text-[10px] text-slate-500">{item.subjectLabel} · {item.termLabel} · {item.level}</span></span>
          <span className="shrink-0 text-right text-[8px] font-black uppercase tracking-wider text-slate-500">{item.status.replaceAll("_", " ")}<br />{item.approvedUnitCount}/{item.proposedUnitCount} approved</span>
        </button>
      ))}
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500"><span className="mb-1.5 block">{label}</span>{children}</label>;
}
