import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export default function ExamLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbfbfc]">
      {/* Compact Top Nav - exact match from mockup */}
      <nav className="compact-nav sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-obsidian-950 rounded flex items-center justify-center text-white text-[10px] font-black italic">
              OS
            </div>
            <span className="text-sm font-bold tracking-tight">OS/SCHOOL</span>
          </div>
          <div className="h-4 w-[1px] bg-obsidian-200" />
          <div className="hidden md:flex items-center gap-2 text-[10px] font-bold editorial-spacing text-obsidian-400">
            <span className="hover:text-indigo-600 cursor-pointer">Teacher</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-obsidian-900">Exam Recording</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold editorial-spacing text-obsidian-400 leading-none">
              Mathematics
            </p>
            <p className="text-xs font-bold text-obsidian-900 leading-none mt-1">
              Primary 4A
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-obsidian-100 flex items-center justify-center font-bold text-xs">
            BA
          </div>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto p-4 md:p-10">{children}</main>
    </div>
  );
}
