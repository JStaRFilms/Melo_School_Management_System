"use client";

import type { ReactNode } from "react";
import { SheetBase } from "@school/shared/components/SheetBase";

interface TeacherSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** Teacher sheet: shared behavior (portal + SSR-safe mount guard) with teacher chrome/timing (300ms exit). */
export function TeacherSheet({ isOpen, onClose, title, description, children }: TeacherSheetProps) {
  return (
    <SheetBase
      open={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      exitMs={300}
      closeLabel="Close sheet"
      frameClass="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4 transition-all duration-400"
      overlayClass="absolute inset-0 bg-slate-950/60 backdrop-blur-[4px] transition-opacity duration-400"
      panelClass="relative flex w-full flex-col bg-white shadow-2xl ring-1 ring-slate-950/10 rounded-t-[1.5rem] sm:rounded-xl transition-all"
      openPanelClass="translate-y-0 sm:translate-y-0 sm:scale-100 opacity-100 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      closedPanelClass="translate-y-full sm:translate-y-8 sm:scale-[0.97] opacity-0 duration-300 ease-[cubic-bezier(0.4,0,1,1)]"
      handleClass="flex justify-center py-3 sm:hidden"
      handleDotClass="h-1.5 w-10 rounded-full bg-slate-200/80"
      headerClass="flex items-start justify-between px-6 pb-4 pt-1 sm:pt-6 border-b border-slate-100/80"
      bodyClass="max-h-[80vh] overflow-y-auto px-6 pb-8 pt-5 sm:pb-6 custom-scrollbar"
      closeButtonClass="rounded-full p-2 hover:bg-slate-100 active:bg-slate-200 transition-colors"
      closeIconClass="h-5 w-5 text-slate-400"
    >
      {children}
    </SheetBase>
  );
}
