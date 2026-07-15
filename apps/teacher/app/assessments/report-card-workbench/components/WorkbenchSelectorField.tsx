"use client";

import type { SelectorOption } from "./types";

export function WorkbenchSelectorField({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  options: SelectorOption[];
  placeholder: string;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="relative block rounded-xl border border-slate-200 bg-white transition-all focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900">
      <span className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
        className="w-full cursor-pointer appearance-none bg-transparent px-4 pb-2 pt-6 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
