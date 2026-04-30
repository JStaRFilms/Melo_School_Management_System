"use client";

import { X } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";

interface TeacherSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function TeacherSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
}: TeacherSheetProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevOverflowRef = useRef("");

  useEffect(() => {
    if (isOpen) {
      if (typeof document !== "undefined") {
        prevOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }
      setShouldRender(true);
      const timer = setTimeout(() => setIsAnimating(true), 20);
      return () => clearTimeout(timer);
    }

    setIsAnimating(false);
    const timer = setTimeout(() => {
      setShouldRender(false);
      if (typeof document !== "undefined") {
        document.body.style.overflow = prevOverflowRef.current;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = prevOverflowRef.current;
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldRender) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, shouldRender]);

  if (!shouldRender) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-sheet-title"
      aria-describedby={description ? "teacher-sheet-description" : undefined}
      className={`fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 transition-all duration-400 ${isAnimating ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-slate-950/60 backdrop-blur-[4px] transition-opacity duration-400 ${isAnimating ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div
        className={`relative flex w-full flex-col bg-white shadow-2xl ring-1 ring-slate-950/10
          rounded-t-[1.5rem] sm:rounded-xl sm:max-w-lg
          transition-all
          ${isAnimating 
            ? "translate-y-0 sm:translate-y-0 sm:scale-100 opacity-100 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" 
            : "translate-y-full sm:translate-y-8 sm:scale-[0.97] opacity-0 duration-300 ease-[cubic-bezier(0.4,0,1,1)]"
          }
        `}
      >
        {/* Handle for mobile swipe feel */}
        <div className="flex justify-center py-3 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-slate-200/80" />
        </div>

        <div className="flex items-start justify-between px-6 pb-4 pt-1 sm:pt-6 border-b border-slate-100/80">
          <div className="space-y-1">
            <h2 id="teacher-sheet-title" className="font-display text-lg font-bold tracking-tight text-slate-950 uppercase">{title}</h2>
            {description && (
              <p id="teacher-sheet-description" className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{description}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close sheet"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 pb-8 pt-5 sm:pb-6 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
