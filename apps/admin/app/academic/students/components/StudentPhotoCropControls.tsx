"use client";

import type { StudentPhotoCrop } from "./studentPhotoCrop";

interface StudentPhotoCropControlsProps {
  crop: StudentPhotoCrop;
  onCropChange: (crop: StudentPhotoCrop) => void;
}

export function StudentPhotoCropControls({
  crop,
  onCropChange,
}: StudentPhotoCropControlsProps) {
  return (
    <div className="space-y-3 rounded-xl border border-indigo-100 bg-white p-3">
      <RangeControl
        label="Zoom"
        min={1}
        max={2.5}
        step={0.05}
        value={crop.zoom}
        onChange={(value) => onCropChange({ ...crop, zoom: value })}
      />
      <RangeControl
        label="Horizontal crop"
        min={0}
        max={100}
        step={1}
        value={crop.x}
        onChange={(value) => onCropChange({ ...crop, x: value })}
      />
      <RangeControl
        label="Vertical crop"
        min={0}
        max={100}
        step={1}
        value={crop.y}
        onChange={(value) => onCropChange({ ...crop, y: value })}
      />
      <p className="text-[10px] font-medium text-slate-500">
        Adjust the crop before saving. The uploaded image is stored as a passport-style 3:4 photo.
      </p>
    </div>
  );
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-indigo-600"
      />
    </label>
  );
}
