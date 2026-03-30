import { ReactNode, HTMLAttributes } from "react";

interface AdminSurfaceProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  intensity?: "none" | "low" | "medium" | "high";
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
  as?: "div" | "article" | "section" | "header" | "footer";
}

export function AdminSurface({
  children,
  intensity = "medium",
  rounded = "xl",
  className = "",
  as: Tag = "div",
  ...props
}: AdminSurfaceProps) {
  const intensityStyles = {
    none: "bg-transparent border-transparent",
    low: "bg-surface-200 border-slate-200/40 shadow-none",
    medium: "bg-white border-slate-200/60 shadow-sm shadow-slate-200/30",
    high: "bg-white border-slate-200 shadow-soft ring-1 ring-slate-900/5",
  };

  const roundedStyles = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  };

  return (
    <Tag
      {...props}
      className={`
        border transition-all duration-300
        ${intensityStyles[intensity]}
        ${roundedStyles[rounded]}
        ${className}
      `}
    >
      {children}
    </Tag>
  );
}
