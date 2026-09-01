"use client";

import React, { useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
} from "lucide-react";
import { playTick } from "../../lib/audio-feedback";

export function PinnedScrollytellingLens() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [manualOverride, setManualOverride] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 200vh Runway for pinned scroll scrubbing
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Top-level declared scroll animation transforms
  const rawSliderPos = useTransform(scrollYProgress, [0.08, 0.65], [18, 85]);
  const smoothSliderPos = useSpring(rawSliderPos, {
    stiffness: 140,
    damping: 24,
    restDelta: 0.001,
  });

  const clipPathString = useTransform(
    smoothSliderPos,
    (pos) => `polygon(0 0, ${pos}% 0, ${pos}% 100%, 0 100%)`
  );

  const dividerLeftString = useTransform(
    smoothSliderPos,
    (pos) => `${pos}%`
  );

  const activeClipPath =
    manualOverride !== null
      ? `polygon(0 0, ${manualOverride}% 0, ${manualOverride}% 100%, 0 100%)`
      : clipPathString;

  const activeDividerLeft =
    manualOverride !== null ? `${manualOverride}%` : dividerLeftString;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percentage = (x / rect.width) * 100;
    setManualOverride(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
    const percentage = (x / rect.width) * 100;
    setManualOverride(percentage);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative" }}
      className="relative h-[200vh] w-full"
    >
      {/* Sticky Pin Viewport centered in screen, accommodating top nav bar */}
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center px-4 sm:px-8 pt-16 pb-8">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-1 text-xs font-mono font-medium text-stone-700 mb-2 shadow-sm">
              <ArrowLeftRight className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
              <span>PINNED TRANSFORMATION RUNWAY</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl font-normal text-stone-900 tracking-tight">
              The transformation in one scrub.
            </h2>
            <p className="mt-1 text-stone-600 text-xs sm:text-sm font-light">
              Scroll down to watch the system synchronize, or drag the divider manually:
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                setManualOverride(18);
                playTick("soft");
              }}
              className="px-3 py-1 text-xs font-medium rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Disconnected Status Quo
            </button>
            <button
              onClick={() => {
                setManualOverride(85);
                playTick("soft");
              }}
              className="px-3 py-1 text-xs font-medium rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Unified Melo Engine
            </button>
            {manualOverride !== null && (
              <button
                onClick={() => {
                  setManualOverride(null);
                  playTick("click");
                }}
                className="px-2.5 py-1 text-[11px] font-mono text-stone-500 hover:text-stone-800 underline cursor-pointer"
              >
                Reset to Scroll
              </button>
            )}
          </div>

          {/* Main Interactive Split Stage */}
          <div
            onMouseMove={handleMouseMove}
            onMouseDown={() => {
              setIsDragging(true);
              playTick("soft");
            }}
            onMouseUp={() => setIsDragging(false)}
            onTouchMove={handleTouchMove}
            onTouchStart={() => {
              setIsDragging(true);
              playTick("soft");
            }}
            onTouchEnd={() => setIsDragging(false)}
            className="relative w-full h-[320px] sm:h-[350px] md:h-[370px] rounded-3xl border border-stone-300 bg-white overflow-hidden shadow-2xl cursor-ew-resize select-none"
          >
            {/* RIGHT LAYER: UNIFIED MELO SYSTEM (UNDERNEATH) */}
            <div className="absolute inset-0 p-5 sm:p-7 md:p-8 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/40 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                    M
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-800 font-semibold">
                      Melo Unified Student Record
                    </span>
                    <h4 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
                      Sarah Okon • JSS 2 Silver
                    </h4>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-0.5 text-xs font-mono font-bold text-emerald-900 shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                  <span>100% Synchronized</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-auto">
                <div className="rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-sm">
                  <div className="text-[10px] font-mono text-stone-500">Term Broadsheet Score</div>
                  <div className="font-serif text-xl sm:text-2xl font-bold text-emerald-800 mt-0.5">
                    92.6% (1st)
                  </div>
                  <div className="text-[11px] text-stone-600 mt-0.5">WAEC A1 Distinction Certified</div>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-sm">
                  <div className="text-[10px] font-mono text-stone-500">Bursary Reconciliation</div>
                  <div className="font-serif text-xl sm:text-2xl font-bold text-stone-900 mt-0.5">
                    ₦185,000 Paid
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                    Paystack #4091 Auto-Cleared
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-sm">
                  <div className="text-[10px] font-mono text-stone-500">Parent Portal Delivery</div>
                  <div className="font-serif text-xl sm:text-2xl font-bold text-stone-900 mt-0.5">
                    Delivered
                  </div>
                  <div className="text-[11px] text-stone-600 mt-0.5">Dr. Emeka Okon (Active)</div>
                </div>
              </div>

              <div className="text-[11px] text-emerald-800 font-mono flex items-center justify-between border-t border-emerald-200/80 pt-2.5">
                <span>Result week compilation: 0.4s</span>
                <span>Zero manual paper recalculations</span>
              </div>
            </div>

            {/* LEFT LAYER: DISCONNECTED STATUS QUO (CLIPPED BY SLIDER) */}
            <motion.div
              style={{
                clipPath: activeClipPath,
              }}
              className="absolute inset-0 p-5 sm:p-7 md:p-8 bg-gradient-to-br from-stone-100 via-rose-50/40 to-stone-200 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between border-b border-rose-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                    !
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-rose-800 font-semibold">
                      Disconnected Files & Spreadsheets
                    </span>
                    <h4 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
                      Sarah Okon (Excel File v3_final.xlsx)
                    </h4>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-rose-100 border border-rose-300 px-3 py-0.5 text-xs font-mono font-bold text-rose-900 shadow-sm">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-700" />
                  <span>4 Conflicts Detected</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-auto">
                <div className="rounded-2xl border border-rose-200 bg-white/90 p-3.5 shadow-sm">
                  <div className="text-[10px] font-mono text-rose-700">Teacher's Excel Sheet</div>
                  <div className="font-serif text-xl sm:text-2xl font-bold text-rose-800 mt-0.5">
                    #REF! Error
                  </div>
                  <div className="text-[11px] text-rose-600 mt-0.5">Missing CA3 from Physics</div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-white/90 p-3.5 shadow-sm">
                  <div className="text-[10px] font-mono text-rose-700">Bank Teller Slip</div>
                  <div className="font-serif text-xl sm:text-2xl font-bold text-rose-800 mt-0.5">
                    Unmatched
                  </div>
                  <div className="text-[11px] text-stone-600 mt-0.5">₦100k alert missing ID</div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-white/90 p-3.5 shadow-sm">
                  <div className="text-[10px] font-mono text-rose-700">Parent Phone Line</div>
                  <div className="font-serif text-xl sm:text-2xl font-bold text-rose-800 mt-0.5">
                    5 Missed Calls
                  </div>
                  <div className="text-[11px] text-stone-600 mt-0.5">"Where is the card?"</div>
                </div>
              </div>

              <div className="text-[11px] text-rose-800 font-mono flex items-center justify-between border-t border-rose-200 pt-2.5">
                <span>Result week latency: 3 days of manual calculation</span>
                <span>High risk of errors</span>
              </div>
            </motion.div>

            {/* DRAGGABLE SLIDER DIVIDER LINE & HANDLE */}
            <motion.div
              style={{
                left: activeDividerLeft,
              }}
              className="absolute top-0 bottom-0 w-1 bg-stone-900 z-30 shadow-[0_0_20px_rgba(0,0,0,0.35)] pointer-events-none"
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-10 rounded-2xl bg-stone-900 border-2 border-white text-white flex items-center justify-center shadow-2xl">
                <ArrowLeftRight className="h-4 w-4 text-amber-400" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
