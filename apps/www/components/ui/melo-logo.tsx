"use client";

import React from "react";

interface MeloLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

export function MeloLogo({ className = "", size = 32, showWordmark = true }: MeloLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Precision Vector Woven Monogram Mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 group-hover:scale-105"
      >
        <rect width="48" height="48" rx="14" fill="#0A0A0A" />
        {/* Subtle inner border */}
        <rect x="0.5" y="0.5" width="47" height="47" rx="13.5" stroke="#CA8A04" strokeOpacity="0.3" />
        
        {/* Geometric Woven "M" Architecture */}
        <path
          d="M12 34V14L24 26L36 14V34"
          stroke="#CA8A04"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 34V22L24 28L30 22V34"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.85"
        />
        {/* Modern Accent Pivot Dot */}
        <circle cx="24" cy="14" r="2.2" fill="#CA8A04" />
      </svg>

      {showWordmark && (
        <span className="font-serif text-2xl font-bold tracking-tight text-stone-900 leading-none">
          Melo
        </span>
      )}
    </div>
  );
}
