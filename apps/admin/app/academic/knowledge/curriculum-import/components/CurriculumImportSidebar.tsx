"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, CheckCircle2, Clock, LoaderCircle, Search } from "lucide-react";
import type { CurriculumImportForm, CurriculumImportSummary } from "./types";

interface Source { _id: string; title: string; level: string; subjectId?: string; createdAt: number; }
type SourceSort = "newest" | "oldest" | "title-asc" | "title-desc";
interface Subject { _id: string; name: string; }
interface Term { _id: string; name: string; isActive: boolean; }
const INPUT_CLASS = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all";

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
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceSort, setSourceSort] = useState<SourceSort>("newest");
  const update = (values: Partial<CurriculumImportForm>) => props.onFormChange({ ...form, ...values });
  const visibleSources = useMemo(() => {
    const query = sourceQuery.trim().toLocaleLowerCase();
    return sources
      .filter((source) => !query || `${source.title} ${source.level}`.toLocaleLowerCase().includes(query))
      .sort((left, right) => {
        if (sourceSort === "newest") return right.createdAt - left.createdAt;
        if (sourceSort === "oldest") return left.createdAt - right.createdAt;
        const titleOrder = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
        return sourceSort === "title-asc" ? titleOrder : -titleOrder;
      });
  }, [sourceQuery, sourceSort, sources]);

  return (
    <aside className="border-r border-slate-200/80 bg-slate-50/50 lg:h-full lg:overflow-y-auto custom-scrollbar flex flex-col">
      <form onSubmit={(event) => { event.preventDefault(); props.onSubmit(); }} className="space-y-3.5 border-b border-slate-200/80 p-5 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">New Proposal</p>
          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Scheme of Work</span>
        </div>

        <Field label="Ready curriculum source">
          <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={sourceQuery}
                onChange={(event) => setSourceQuery(event.target.value)}
                placeholder="Search references"
                aria-label="Search curriculum references"
                className={`${INPUT_CLASS} pl-9 font-semibold`}
              />
            </div>
            <div className="relative">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={sourceSort}
                onChange={(event) => setSourceSort(event.target.value as SourceSort)}
                aria-label="Sort curriculum references"
                className={`${INPUT_CLASS} pl-8 pr-2 font-semibold`}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="title-asc">A–Z</option>
                <option value="title-desc">Z–A</option>
              </select>
            </div>
          </div>
          <select
            required
            value={form.materialId}
            onChange={(event) => {
              const source = sources.find((item) => item._id === event.target.value);
              update({
                materialId: event.target.value,
                level: source?.level || form.level,
                subjectId: source?.subjectId || form.subjectId,
              });
              if (event.target.value) setSourceQuery("");
            }}
            className={INPUT_CLASS}
          >
            <option value="">{visibleSources.length === 0 && sourceQuery ? "No matching references" : "Choose source document"}</option>
            {visibleSources.map((source) => (
              <option key={source._id} value={source._id}>
                {source.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Subject">
          <select
            required
            value={form.subjectId}
            onChange={(event) => update({ subjectId: event.target.value })}
            className={INPUT_CLASS}
          >
            <option value="">Choose subject</option>
            {subjects.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Level">
            <input
              required
              placeholder="e.g. Primary 5"
              value={form.level}
              onChange={(event) => update({ level: event.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Term">
            <select
              required
              value={form.termId}
              onChange={(event) => update({ termId: event.target.value })}
              className={INPUT_CLASS}
            >
              <option value="">Choose term</option>
              {terms.map((term) => (
                <option key={term._id} value={term._id}>
                  {term.name}{term.isActive ? " (active)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <button
          disabled={busy || !form.materialId || !form.subjectId || !form.level.trim() || !form.termId}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 transition-all shadow-xs active:scale-98 disabled:opacity-40 cursor-pointer"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          <span>Extract Proposal</span>
        </button>
        <p className="text-[10px] leading-4 text-slate-400 text-center">
          Nothing becomes a school topic until an administrator approves it.
        </p>
      </form>

      <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 px-5 py-3 text-[10px] font-black uppercase tracking-[.18em] text-slate-400 backdrop-blur">
        Recent Proposals ({imports.length})
      </div>

      <div className="p-3 space-y-2 flex-1">
        {imports.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-500 font-medium">No curriculum imports yet.</p>
        ) : (
          imports.map((item) => {
            const isSelected = selectedImportId === item._id;
            const isAllApproved = item.proposedUnitCount > 0 && item.approvedUnitCount === item.proposedUnitCount;
            return (
              <button
                key={item._id}
                onClick={() => props.onSelectImport(item._id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-indigo-500 bg-white shadow-xs ring-2 ring-indigo-500/20"
                    : "border-slate-200/70 bg-white hover:border-slate-300 hover:shadow-2xs"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <b className="block text-xs font-black text-slate-900 line-clamp-1">
                    {item.sourceLabel}
                  </b>
                  {isAllApproved ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="w-2.5 h-2.5" /> All Done
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      <Clock className="w-2.5 h-2.5" /> {item.approvedUnitCount}/{item.proposedUnitCount}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500">
                  <span>{item.subjectLabel} · {item.level}</span>
                  <span className="text-slate-400">{item.termLabel}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 space-y-1.5">
      <span className="block">{label}</span>
      {children}
    </label>
  );
}
