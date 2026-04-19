import React, { ReactNode } from "react";
import { ChevronRight, ShieldCheck, LayoutDashboard, GraduationCap, Landmark, ClipboardCheck, ChevronDown } from "lucide-react";

export function PlatformMockShell({
  children,
  activeSection = "Overview",
  activeGroup = "management",
  userName = "Director",
  workspaceLabel = "Admin Portal",
  hideSidebar = false,
}: {
  children: ReactNode;
  activeSection?: string;
  activeGroup?: string;
  userName?: string;
  workspaceLabel?: string;
  hideSidebar?: boolean;
}) {
  const groups = [
    {
      id: "management",
      label: "Management",
      links: ["School Overview", "Staff Directory"],
    },
    {
      id: "academic",
      label: "Academic Operations",
      links: ["Classes", "Students", "Attendance", "Schedules"],
    },
    {
      id: "finance",
      label: "Finance",
      links: ["Billing Dashboard", "Transactions"],
    },
    {
      id: "assessments",
      label: "Assessments & Exams",
      links: ["Report Cards", "Exams"],
    },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 font-sans text-slate-900 border-none">
      {!hideSidebar && (
        <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white shrink-0 z-30">
          <div className="flex h-16 items-center gap-4 px-6 border-b border-slate-100/60">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-[10px] font-black tracking-tighter text-white shadow-lg shadow-slate-950/20">
              OS
            </div>
            <div>
              <h1 className="font-display text-sm font-bold tracking-tight text-slate-950 leading-none">
                {workspaceLabel}
              </h1>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 mt-1 leading-none">
                Academic Engine
              </p>
            </div>
          </div>
          <nav className="flex-1 px-4 py-3">
            <div className="space-y-7 py-3">
              {groups.map((group) => (
                <div key={group.id} className="space-y-2.5">
                  <h3 className="sticky top-0 z-10 -mx-1 bg-white/95 backdrop-blur-sm px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    {group.label}
                  </h3>
                  <div className="grid gap-0.5">
                    {group.links.map((link) => {
                      const isActive = activeSection === link && group.id === activeGroup;
                      return (
                        <div
                          key={link}
                          className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all duration-200 ${
                            isActive
                              ? "bg-slate-950 text-white shadow-md shadow-slate-950/10"
                              : "text-slate-600 bg-transparent"
                          }`}
                        >
                          {link}
                          <ChevronRight
                            className={`h-3.5 w-3.5 ${isActive ? "text-blue-400" : "opacity-0"}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>
          <div className="p-4 border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-sm text-slate-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Node Status</p>
                <p className="text-[11px] font-bold text-slate-900 mt-0.5">Production Core</p>
              </div>
            </div>
          </div>
        </aside>
      )}

      <div className="flex flex-col flex-1 min-w-0 relative bg-slate-50">
        <header className="sticky top-0 flex h-16 w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                {workspaceLabel}
              </span>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <h2 className="font-display text-sm font-bold tracking-tight text-slate-950">
                {activeSection}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950 text-[10px] font-bold text-white">
                D
              </div>
              <div className="text-left leading-none">
                <p className="text-xs font-bold text-slate-900">{userName}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">Session</p>
              </div>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </div>
          </div>
        </header>
        <main className="flex-1 w-full relative p-8 pb-10">
          <div className="mx-auto max-w-[1400px] h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
