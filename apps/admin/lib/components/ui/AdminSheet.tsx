"use client";

import { useEffect, useState, ReactNode } from "react";
import { X } from "lucide-react";
import { AdminSurface } from "./AdminSurface";

interface AdminSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function AdminSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
}: AdminSheetProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsAnimating(true), 20);
      document.body.style.overflow = "hidden";
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = "auto";
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 transition-all duration-500 ease-out ${isAnimating ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-slate-950/60 backdrop-blur-[4px] transition-opacity duration-500 ease-out ${isAnimating ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div
        className={`relative flex w-full flex-col bg-white shadow-2xl ring-1 ring-slate-950/10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          rounded-t-[3rem] sm:rounded-2xl sm:max-w-lg
          ${isAnimating ? "translate-y-0" : "translate-y-full sm:translate-y-12 sm:scale-95"}
        `}
      >
        {/* Handle for mobile swipe feel */}
        <div className="flex justify-center py-4 sm:hidden">
          <div className="h-1.5 w-14 rounded-full bg-slate-100" />
        </div>

        <div className="flex items-start justify-between px-6 pb-4 pt-2 sm:pt-6 border-b border-slate-50">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold tracking-tight text-slate-950 uppercase">{title}</h2>
            {description && (
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-50 transition-colors"
          >
            <X className="h-5 w-5 text-slate-300" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 pb-10 pt-4 sm:pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
