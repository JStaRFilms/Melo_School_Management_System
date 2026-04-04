"use client";

import { useEffect, useMemo, useState } from "react";
import { Timer, Clock, Lock, Unlock } from "lucide-react";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "UNDEFINED";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "INVALID";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

interface ProtocolTimelineProps {
  startsAt: string | null;
  endsAt: string | null;
  isEnabled: boolean;
}

export function ProtocolTimeline({ startsAt, endsAt, isEnabled }: ProtocolTimelineProps) {
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const progressPercent = useMemo(() => {
    if (!isEnabled) return 0;

    const start = startsAt ? new Date(startsAt) : null;
    const end = endsAt ? new Date(endsAt) : null;
    const validStart = start && !isNaN(start.getTime()) ? start.getTime() : null;
    const validEnd = end && !isNaN(end.getTime()) ? end.getTime() : null;

    if (validStart === null || validEnd === null || validEnd <= validStart) {
      return 0;
    }

    const progress = ((nowTick - validStart) / (validEnd - validStart)) * 100;
    return Math.min(100, Math.max(0, progress));
  }, [endsAt, isEnabled, nowTick, startsAt]);

  const status = useMemo(() => {
    if (!isEnabled) return { label: "Restrictions Disabled", color: "text-slate-400", bg: "bg-slate-100", icon: <Unlock size={14} /> };
    
    const now = new Date(nowTick);
    const start = startsAt ? new Date(startsAt) : null;
    const end = endsAt ? new Date(endsAt) : null;

    if (!start && !end) return { label: "No Window Defined", color: "text-amber-500", bg: "bg-amber-50", icon: <Timer size={14} /> };
    
    const validStart = start && !isNaN(start.getTime()) ? start : new Date(0);
    const validEnd = end && !isNaN(end.getTime()) ? end : new Date(8640000000000000);

    const active = now >= validStart && now <= validEnd;
    
    if (active) return { label: "Window Active", color: "text-emerald-500", bg: "bg-emerald-50/50", icon: <Clock size={14} /> };
    if (now < validStart) return { label: "Opening Soon", color: "text-blue-500", bg: "bg-blue-50/50", icon: <Timer size={14} /> };
    return { label: "Terminal Locked", color: "text-rose-500", bg: "bg-rose-50/50", icon: <Lock size={14} /> };
  }, [startsAt, endsAt, isEnabled, nowTick]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
         <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            <Timer size={10} />
            Temporal Scope
          </div>
          <h3 className="text-xs lg:text-sm font-bold text-slate-900 tracking-tight">Window Metadata</h3>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${status.bg} border-current/10 ${status.color}`}>
          {status.icon}
          <span className="text-[10px] font-bold uppercase tracking-wider">{status.label}</span>
        </div>
      </div>

      <div className="relative h-24 w-full bg-white border border-slate-200 rounded-2xl overflow-hidden flex items-center px-8 gap-8">
        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            <span>Entry Open</span>
            <span>Entry Close</span>
          </div>
          <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
             {/* Progress Bar Mockup */}
            <div
              className={`absolute top-0 bottom-0 left-0 transition-all duration-1000 ${isEnabled ? "bg-blue-600" : "bg-slate-300"}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[11px] font-black text-slate-900">
            <span>{startsAt ? formatDate(startsAt) : "IMMEDIATE"}</span>
            <span>{endsAt ? formatDate(endsAt) : "UNDEFINED"}</span>
          </div>
        </div>
        
        <div className="h-12 w-px bg-slate-100 hidden md:block" />
        
        <div className="hidden md:block space-y-1">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Current Status</p>
          <p className={`text-sm font-black tracking-tight ${status.color}`}>{status.label}</p>
        </div>
      </div>
    </div>
  );
}
