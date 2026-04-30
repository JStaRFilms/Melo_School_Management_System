"use client";

import { cn } from "@/lib/utils";
import { Search, CheckCircle2, AlertTriangle, Plus, FileText, ClipboardList } from "lucide-react";
import Link from "next/link";
import { TopicOption, PlanningWorkItem } from "../page";

export function PlanningWorkCard({ 
  item, 
  lessonHref, 
  questionHref 
}: { 
  item: PlanningWorkItem; 
  lessonHref: string | null; 
  questionHref: string | null; 
}) {
  return (
    <article className="group relative flex flex-col gap-4 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:ring-1 hover:ring-slate-950/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-black text-slate-950">{item.topicTitle}</h3>
          </div>
          <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {item.subjectName} • {item.level}
          </p>
        </div>
        <div className="shrink-0 max-w-[100px] truncate rounded-lg bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 border border-slate-100">
          {item.preferredClassName ?? "No class"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 border-y border-slate-50 py-3 sm:gap-2">
        <div className="text-center">
          <p className="text-sm font-black text-slate-950">{item.sourceCount}</p>
          <p className="text-[8px] font-bold uppercase tracking-normal text-slate-400 sm:text-[9px] sm:tracking-widest">Sources</p>
        </div>
        <div className="text-center border-x border-slate-50">
          <p className="text-sm font-black text-slate-950">{item.lessonCount}</p>
          <p className="text-[8px] font-bold uppercase tracking-normal text-slate-400 sm:text-[9px] sm:tracking-widest">Lessons</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-black text-slate-950">{item.questionBankCount}</p>
          <p className="text-[8px] font-bold uppercase tracking-normal text-slate-400 sm:text-[9px] sm:tracking-widest">Questions</p>
        </div>
      </div>

      <div className="flex flex-row gap-2 pt-1">
        <Link
          href={lessonHref ?? "#"}
          className={cn(
            "flex-1 inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
            lessonHref 
              ? "bg-slate-950 text-white hover:bg-slate-800" 
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          )}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Lessons</span>
        </Link>
        <Link
          href={questionHref ?? "#"}
          className={cn(
            "flex-1 inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-wider transition-all",
            questionHref 
              ? "bg-white text-slate-900 hover:bg-slate-50" 
              : "cursor-not-allowed bg-slate-50 text-slate-300"
          )}
        >
          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Practice</span>
        </Link>
      </div>
    </article>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 opacity-80">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300"
        >
          <option value="">{placeholder ?? `Choose ${label.toLowerCase()}`}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 border-l border-slate-100 pl-2">
          <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function CreatableTopicField({
  value,
  inputValue,
  topics,
  disabled,
  isCreating,
  onInputChange,
  onSelectTopic,
  onCreateTopic,
}: {
  value: string;
  inputValue: string;
  topics: TopicOption[];
  disabled?: boolean;
  isCreating?: boolean;
  onInputChange: (value: string) => void;
  onSelectTopic: (topic: TopicOption) => void;
  onCreateTopic: () => void;
}) {
  const normalizedInput = inputValue.trim().replace(/\s+/g, " ");
  const exactMatch = topics.find((topic) => topic.title.trim().toLowerCase() === normalizedInput.toLowerCase());
  const visibleTopics = topics
    .filter((topic) => !normalizedInput || topic.title.toLowerCase().includes(normalizedInput.toLowerCase()))
    .slice(0, 5);
  const canCreate = Boolean(normalizedInput && !exactMatch && !disabled);

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 opacity-80">
        Search or Create Topic
      </label>
      <div className={cn(
        "relative rounded-lg border transition-all",
        disabled ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200 focus-within:border-slate-950 focus-within:ring-4 focus-within:ring-slate-950/5"
      )}>
        <div className="flex items-center gap-2 px-3">
          <Search className="h-4 w-4 text-slate-300" />
          <input
            type="text"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            disabled={disabled}
            placeholder={disabled ? "Select context first..." : "Topic name..."}
            className="h-10 flex-1 bg-transparent text-[13px] font-bold text-slate-900 outline-none placeholder:text-slate-300 disabled:cursor-not-allowed"
          />
          {value ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : null}
        </div>

        {!disabled && visibleTopics.length > 0 && (
          <div className="border-t border-slate-50 p-1.5 space-y-1">
            {visibleTopics.map((topic) => (
              <button
                key={topic._id}
                type="button"
                onClick={() => onSelectTopic(topic)}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] font-bold transition-colors",
                  value === topic._id ? "bg-slate-950 text-white" : "hover:bg-slate-50 text-slate-700"
                )}
              >
                {topic.title}
                {value === topic._id && <CheckCircle2 className="h-3 w-3" />}
              </button>
            ))}
          </div>
        )}

        {canCreate && (
          <button
            type="button"
            onClick={onCreateTopic}
            disabled={isCreating}
            className="w-full flex items-center justify-center gap-2 border-t border-slate-50 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-950 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {isCreating ? "Creating..." : `Create "${normalizedInput}"`}
          </button>
        )}
      </div>
    </div>
  );
}
