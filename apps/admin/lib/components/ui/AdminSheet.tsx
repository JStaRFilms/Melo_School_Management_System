"use client";

import type { ReactNode } from "react";
import { SheetBase } from "@school/shared/components/SheetBase";

interface AdminSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** Admin sheet: shared behavior with admin chrome/timing (500ms exit). */
export function AdminSheet({ isOpen, onClose, title, description, children }: AdminSheetProps) {
  return (
    <SheetBase open={isOpen} onClose={onClose} title={title} description={description} exitMs={500}>
      {children}
    </SheetBase>
  );
}
