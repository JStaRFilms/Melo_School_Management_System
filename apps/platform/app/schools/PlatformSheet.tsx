"use client";

import type { ReactNode } from "react";
import { SheetBase } from "@school/shared/components/SheetBase";

type SheetWidth = "md" | "lg" | "xl";

const widthClasses: Record<SheetWidth, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-3xl",
};

/** Platform sheet: shared behavior (portal) with platform chrome and dialog contract. */
export function PlatformSheet({
  labelledBy,
  describedBy,
  title,
  subtitle,
  icon,
  onClose,
  dismissDisabled = false,
  children,
  footer,
  maxWidth = "md",
  closeLabel = "Close dialog",
}: {
  labelledBy: string;
  describedBy?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  dismissDisabled?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: SheetWidth;
  closeLabel?: string;
}) {
  return (
    <SheetBase
      open
      onClose={onClose}
      title={title}
      description={subtitle}
      labelledBy={labelledBy}
      describedBy={describedBy}
      icon={icon}
      footer={footer}
      dismissDisabled={dismissDisabled}
      closeLabel={closeLabel}
      maxWidthClass={widthClasses[maxWidth]}
      frameClass="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      overlayClass="absolute inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-300"
      panelClass="flex max-h-[96dvh] w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl rounded-t-3xl sm:rounded-2xl transition-all duration-300 ease-out"
      openPanelClass="translate-y-0 opacity-100 sm:scale-100"
      closedPanelClass="translate-y-full sm:translate-y-4 sm:scale-95 sm:opacity-0"
      handleClass="flex shrink-0 justify-center pt-3 sm:hidden"
      handleDotClass="h-1.5 w-12 rounded-full bg-slate-200"
      headerClass="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"
      titleBlockClass="min-w-0"
      titleClass="truncate text-base font-bold text-slate-900"
      descriptionClass="mt-0.5 truncate text-xs text-slate-500"
      bodyClass="min-h-0 flex-1 overflow-y-auto px-5 py-5"
      footerClass="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
      closeButtonClass="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
      closeIconClass="h-5 w-5"
    >
      {children}
    </SheetBase>
  );
}

export function SheetFooterButtons({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      {children}
    </div>
  );
}

export const sheetPrimaryButton =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5";

export const sheetSecondaryButton =
  "inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 sm:w-auto sm:py-2.5";
