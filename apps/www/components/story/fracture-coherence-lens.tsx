"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Check,
  CheckCircle2,
  Coins,
  FileSpreadsheet,
  FileText,
  Phone,
  Receipt,
  Sparkles,
  User,
} from "lucide-react";
import React, { useState } from "react";

export function FractureCoherenceLens() {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage 0 to 100
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    setSliderPosition((x / rect.width) * 100);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
    setSliderPosition((x / rect.width) * 100);
  };

  return (
    <div className="w-full max-w-5xl mx-auto my-12">
      {/* Preset Action Bar */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
          <ArrowLeftRight className="h-3.5 w-3.5 text-amber-600" />
          <span>DRAG SLIDER TO REVEAL SYSTEM TRANSFORMATION</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSliderPosition(15)}
            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              sliderPosition < 40
                ? "bg-rose-100 border-rose-300 text-rose-900"
                : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            Disconnected Status Quo
          </button>
          <button
            onClick={() => setSliderPosition(85)}
            className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              sliderPosition > 60
                ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            Unified Melo Engine
          </button>
        </div>
      </div>

      {/* Main Interactive Split Stage */}
      <div
        onMouseMove={handleMouseMove}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onTouchMove={handleTouchMove}
        className="relative w-full h-[400px] sm:h-[440px] rounded-3xl border border-stone-300 bg-white overflow-hidden shadow-xl cursor-ew-resize select-none"
      >
        {/* RIGHT LAYER: UNIFIED MELO SYSTEM (UNDERNEATH) */}
        <div className="absolute inset-0 p-6 sm:p-10 bg-gradient-to-br from-emerald-50/50 via-white to-amber-50/30 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-emerald-200/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                M
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-800 font-semibold">
                  Melo Unified Student Record
                </span>
                <h4 className="font-serif text-2xl font-bold text-stone-900">
                  Sarah Okon • JSS 2 Silver
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-mono font-bold text-emerald-900">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
              <span>100% Synchronized</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-auto">
            <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-mono text-stone-500">Term Broadsheet Score</div>
              <div className="font-serif text-2xl font-bold text-emerald-800 mt-1">
                92.6% (1st)
              </div>
              <div className="text-xs text-stone-600 mt-1">WAEC A1 Distinction Certified</div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-mono text-stone-500">Bursary Reconciliation</div>
              <div className="font-serif text-2xl font-bold text-stone-900 mt-1">
                ₦185,000 Paid
              </div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">
                Paystack #4091 Auto-Cleared
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-mono text-stone-500">Parent Portal Delivery</div>
              <div className="font-serif text-2xl font-bold text-stone-900 mt-1">
                Delivered
              </div>
              <div className="text-xs text-stone-600 mt-1">Dr. Emeka Okon (Active)</div>
            </div>
          </div>

          <div className="text-xs text-emerald-800 font-mono flex items-center justify-between border-t border-emerald-200/80 pt-3">
            <span>Result week latency: 0.4s</span>
            <span>Zero manual paper recalculations</span>
          </div>
        </div>

        {/* LEFT LAYER: DISCONNECTED STATUS QUO (CLIPPED BY SLIDER) */}
        <div
          style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
          className="absolute inset-0 p-6 sm:p-10 bg-gradient-to-br from-stone-100 via-rose-50/40 to-stone-200 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between border-b border-rose-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-sm">
                !
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-800 font-semibold">
                  Disconnected Files & Spreadsheets
                </span>
                <h4 className="font-serif text-2xl font-bold text-stone-900">
                  Sarah Okon (Excel File v3_final.xlsx)
                </h4>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-rose-100 border border-rose-300 px-3 py-1 text-xs font-mono font-bold text-rose-900">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-700" />
              <span>4 Data Conflicts Detected</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-auto">
            <div className="rounded-xl border border-rose-200 bg-white/90 p-4 shadow-sm">
              <div className="text-[11px] font-mono text-rose-700">Teacher's Excel Sheet</div>
              <div className="font-serif text-2xl font-bold text-rose-800 mt-1">
                #REF! Error
              </div>
              <div className="text-xs text-rose-600 mt-1">Missing CA3 from Physics teacher</div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-white/90 p-4 shadow-sm">
              <div className="text-[11px] font-mono text-rose-700">Bank Teller Slip</div>
              <div className="font-serif text-2xl font-bold text-rose-800 mt-1">
                Unmatched
              </div>
              <div className="text-xs text-stone-600 mt-1">₦100,000 alert missing student ID</div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-white/90 p-4 shadow-sm">
              <div className="text-[11px] font-mono text-rose-700">Parent Phone Line</div>
              <div className="font-serif text-2xl font-bold text-rose-800 mt-1">
                5 Missed Calls
              </div>
              <div className="text-xs text-stone-600 mt-1">"Why hasn't the card arrived?"</div>
            </div>
          </div>

          <div className="text-xs text-rose-800 font-mono flex items-center justify-between border-t border-rose-200 pt-3">
            <span>Result week latency: 3 days of manual calculation</span>
            <span>High risk of grade calculation errors</span>
          </div>
        </div>

        {/* DRAGGABLE SLIDER DIVIDER LINE & HANDLE */}
        <div
          style={{ left: `${sliderPosition}%` }}
          className="absolute top-0 bottom-0 w-1 bg-stone-900 z-30 shadow-[0_0_15px_rgba(0,0,0,0.3)] pointer-events-none"
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-10 rounded-xl bg-stone-900 border-2 border-white text-white flex items-center justify-center shadow-2xl">
            <ArrowLeftRight className="h-4 w-4 text-amber-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
