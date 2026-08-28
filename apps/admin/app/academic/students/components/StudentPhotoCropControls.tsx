"use client";

import type { StudentPhotoCrop } from "./studentPhotoCrop";
import { RotateCcw } from "lucide-react";

interface StudentPhotoCropControlsProps {
  crop: StudentPhotoCrop;
  onCropChange: (crop: StudentPhotoCrop) => void;
  onReset?: () => void;
}

export function StudentPhotoCropControls({
  crop,
  onCropChange,
  onReset,
}: StudentPhotoCropControlsProps) {
  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 animate-in fade-in slide-in-from-top-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 font-display">
          Crop & Framing
        </span>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        <RangeControl
          label="Zoom"
          min={1}
          max={2.5}
          step={0.05}
          value={crop.zoom}
          displayValue={`${Math.round(crop.zoom * 100)}%`}
          onChange={(value) => onCropChange({ ...crop, zoom: value })}
        />
        <RangeControl
          label="Horizontal"
          min={0}
          max={100}
          step={1}
          value={crop.x}
          displayValue={`${crop.x}%`}
          onChange={(value) => onCropChange({ ...crop, x: value })}
        />
        <RangeControl
          label="Vertical"
          min={0}
          max={100}
          step={1}
          value={crop.y}
          displayValue={`${crop.y}%`}
          onChange={(value) => onCropChange({ ...crop, y: value })}
        />
      </div>
    </div>
  );
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  displayValue,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  displayValue: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
        <span className="uppercase tracking-wider">{label}</span>
        <span className="font-mono text-slate-700">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-900 focus:outline-none"
      />
    </div>
  );
}
