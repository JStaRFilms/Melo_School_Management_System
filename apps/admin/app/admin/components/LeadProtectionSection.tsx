"use client";

import { ShieldCheck } from "lucide-react";

interface LeadProtectionSectionProps {
  leadAdmin: {
    name: string;
    email: string;
  } | null;
}

export function LeadProtectionSection({ leadAdmin }: LeadProtectionSectionProps) {
  if (!leadAdmin) return null;

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-full bg-emerald-50 p-1.5 text-emerald-600 ring-1 ring-emerald-500/20">
        <ShieldCheck className="h-3.5 w-3.5" />
      </div>
      <div>
        <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Lead Admin
        </h4>
        <p className="mt-0.5 font-display text-sm font-bold text-slate-950">
          {leadAdmin.name}
        </p>
        <p className="text-[10px] font-medium text-slate-500">
          {leadAdmin.email}
        </p>
      </div>
    </div>
  );
}
