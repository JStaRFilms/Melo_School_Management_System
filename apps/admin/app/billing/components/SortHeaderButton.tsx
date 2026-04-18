import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDirection } from "../types";

interface SortHeaderButtonProps {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}

export function SortHeaderButton({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: SortHeaderButtonProps) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 uppercase tracking-widest transition-colors hover:text-slate-700 ${
        align === "right" ? "ml-auto justify-end" : "justify-start"
      }`}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
