"use client";

import { UsersRound, RefreshCw } from "lucide-react";

interface EmptyRosterProps {
  message?: string;
  subtext?: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export function EmptyRoster({
  message = "No Students Selected",
  subtext = "Please choose a Session, Term, Class, and Subject above to load the student roster and begin recording scores.",
  onRetry,
  showRetry = false,
}: EmptyRosterProps) {
  return (
    <div className="bg-white border border-dashed border-obsidian-300 rounded-3xl flex flex-col items-center justify-center py-20 px-8 text-center gap-6 shadow-xs">
      {/* Exact match from states mockup: w-20 h-20, text-obsidian-300 */}
      <div className="w-20 h-20 bg-obsidian-50 rounded-full flex items-center justify-center text-obsidian-300">
        <UsersRound className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h3 className="text-2xl font-bold text-obsidian-950">{message}</h3>
        <p className="text-obsidian-500 max-w-sm mx-auto">{subtext}</p>
      </div>
      {showRetry && onRetry && (
        <button
          onClick={onRetry}
          className="bg-obsidian-950 text-white font-bold h-12 px-8 rounded-xl flex items-center gap-2 hover:bg-indigo-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Loader
        </button>
      )}
    </div>
  );
}
