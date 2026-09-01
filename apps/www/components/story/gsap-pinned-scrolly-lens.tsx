"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
} from "lucide-react";
import { playTick } from "../../lib/audio-feedback";

export function GsapPinnedScrollyLens() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardStageRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const clipLayerRef = useRef<HTMLDivElement>(null);
  const [manualOverride, setManualOverride] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const container = containerRef.current;
    const divider = dividerRef.current;
    const clipLayer = clipLayerRef.current;

    if (!container || !divider || !clipLayer) return;

    // Set initial layout values
    gsap.set(divider, { left: "18%" });
    gsap.set(clipLayer, { clipPath: "polygon(0 0, 18% 0, 18% 100%, 0 100%)" });

    const mm = gsap.matchMedia();

    mm.add(
      {
        isDesktop: "(min-width: 769px)",
        isMobile: "(max-width: 768px)",
      },
      (context) => {
        const { isDesktop } = context.conditions as { isDesktop: boolean; isMobile: boolean };

        ScrollTrigger.create({
          trigger: container,
          start: isDesktop ? "top top" : "top 10%",
          end: isDesktop ? "+=1800" : "+=1200",
          pin: true,
          pinSpacing: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (manualOverride !== null) return;

            const progress = self.progress;
            const mappedProgress = gsap.utils.clamp(
              15,
              88,
              gsap.utils.mapRange(0.08, 0.82, 15, 88, progress)
            );

            gsap.set(divider, { left: `${mappedProgress}%` });
            gsap.set(clipLayer, {
              clipPath: `polygon(0 0, ${mappedProgress}% 0, ${mappedProgress}% 100%, 0 100%)`,
            });
          },
        });
      }
    );

    return () => {
      mm.revert();
    };
  }, [manualOverride]);

  const applyPosition = (percentage: number) => {
    const clamped = Math.max(10, Math.min(90, percentage));
    setManualOverride(clamped);
    if (dividerRef.current && clipLayerRef.current) {
      gsap.to(dividerRef.current, { left: `${clamped}%`, duration: 0.3, ease: "power2.out" });
      gsap.to(clipLayerRef.current, {
        clipPath: `polygon(0 0, ${clamped}% 0, ${clamped}% 100%, 0 100%)`,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !cardStageRef.current) return;
    const rect = cardStageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percentage = (x / rect.width) * 100;
    applyPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardStageRef.current) return;
    const rect = cardStageRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
    const percentage = (x / rect.width) * 100;
    applyPosition(percentage);
  };

  return (
    <div
      ref={containerRef}
      className="w-full min-h-screen flex flex-col items-center justify-center py-12 sm:py-16 px-4 sm:px-8 bg-[#FAF9F5]"
    >
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
        {/* Section Header */}
        <div className="text-center mb-4 px-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1 text-[11px] sm:text-xs font-mono font-medium text-stone-700 mb-2 shadow-sm">
            <ArrowLeftRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-600 animate-pulse" />
            <span>SCROLL-PINNED TRANSFORMATION STAGE</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-4xl md:text-5xl font-normal text-stone-900 tracking-tight leading-snug">
            The transformation in one scrub.
          </h2>
          <p className="mt-1 text-stone-600 text-xs sm:text-sm font-light max-w-lg mx-auto">
            Scroll down to pause and scrub the transition from paper silos to one synchronized engine:
          </p>
        </div>

        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4 px-2">
          <button
            onClick={() => {
              applyPosition(18);
              playTick("soft");
            }}
            className="px-3 py-1 text-[11px] sm:text-xs font-medium rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Disconnected Status Quo
          </button>
          <button
            onClick={() => {
              applyPosition(85);
              playTick("soft");
            }}
            className="px-3 py-1 text-[11px] sm:text-xs font-medium rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 transition-all cursor-pointer shadow-sm active:scale-95"
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
              Resume Scroll
            </button>
          )}
        </div>

        {/* Main Interactive Split Stage */}
        <div
          ref={cardStageRef}
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
          className="relative w-full h-[360px] sm:h-[350px] md:h-[370px] rounded-3xl border border-stone-300 bg-white overflow-hidden shadow-2xl cursor-ew-resize select-none"
        >
          {/* RIGHT LAYER: UNIFIED MELO SYSTEM (UNDERNEATH) */}
          <div className="absolute inset-0 p-4 sm:p-7 md:p-8 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/40 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-xl sm:rounded-2xl bg-white border border-emerald-300 shadow-md shrink-0 overflow-hidden p-1">
                  <Image
                    src="/melo-brand/melo_logo_concept_1779545987898.png"
                    alt="Melo Logo"
                    width={36}
                    height={36}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="truncate">
                  <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-emerald-800 font-semibold block">
                    Melo Unified Record
                  </span>
                  <h4 className="font-serif text-base sm:text-xl md:text-2xl font-bold text-stone-900 truncate">
                    Sarah Okon • JSS 2 Silver
                  </h4>
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] sm:text-xs font-mono font-bold text-emerald-900 shadow-sm shrink-0">
                <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-700" />
                <span className="hidden sm:inline">100% </span><span>Synced</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 my-auto">
              <div className="rounded-xl sm:rounded-2xl border border-emerald-200 bg-white p-2.5 sm:p-3.5 shadow-sm">
                <div className="text-[9px] sm:text-[10px] font-mono text-stone-500 truncate">Broadsheet</div>
                <div className="font-serif text-base sm:text-xl md:text-2xl font-bold text-emerald-800 mt-0.5">
                  92.6%
                </div>
                <div className="text-[10px] sm:text-[11px] text-stone-600 mt-0.5 truncate hidden sm:block">WAEC A1 Certified</div>
                <div className="text-[9px] text-emerald-700 font-semibold sm:hidden">1st / 42</div>
              </div>

              <div className="rounded-xl sm:rounded-2xl border border-emerald-200 bg-white p-2.5 sm:p-3.5 shadow-sm">
                <div className="text-[9px] sm:text-[10px] font-mono text-stone-500 truncate">Bursary</div>
                <div className="font-serif text-base sm:text-xl md:text-2xl font-bold text-stone-900 mt-0.5 truncate">
                  ₦185k
                </div>
                <div className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-0.5 truncate hidden sm:block">
                  Paystack #4091 Cleared
                </div>
                <div className="text-[9px] text-emerald-700 font-semibold sm:hidden">Cleared</div>
              </div>

              <div className="rounded-xl sm:rounded-2xl border border-emerald-200 bg-white p-2.5 sm:p-3.5 shadow-sm">
                <div className="text-[9px] sm:text-[10px] font-mono text-stone-500 truncate">Portal</div>
                <div className="font-serif text-base sm:text-xl md:text-2xl font-bold text-stone-900 mt-0.5 truncate">
                  Live
                </div>
                <div className="text-[10px] sm:text-[11px] text-stone-600 mt-0.5 truncate hidden sm:block">Dr. Emeka Okon</div>
                <div className="text-[9px] text-stone-500 sm:hidden">Active</div>
              </div>
            </div>

            <div className="text-[10px] sm:text-[11px] text-emerald-800 font-mono flex items-center justify-between border-t border-emerald-200/80 pt-2">
              <span>Compilation: 0.4s</span>
              <span className="hidden sm:inline">Zero manual recalculations</span>
              <span className="sm:hidden">Zero paper errors</span>
            </div>
          </div>

          {/* LEFT LAYER: DISCONNECTED STATUS QUO (CLIPPED BY SLIDER) */}
          <div
            ref={clipLayerRef}
            className="absolute inset-0 p-4 sm:p-7 md:p-8 bg-gradient-to-br from-stone-100 via-rose-50/40 to-stone-200 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between border-b border-rose-200 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl sm:rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-md shrink-0">
                  !
                </div>
                <div className="truncate">
                  <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-rose-800 font-semibold block">
                    Disconnected Excel
                  </span>
                  <h4 className="font-serif text-base sm:text-xl md:text-2xl font-bold text-stone-900 truncate">
                    Sarah Okon (v3_final.xlsx)
                  </h4>
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-[10px] sm:text-xs font-mono font-bold text-rose-900 shadow-sm shrink-0">
                <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-700" />
                <span>4 Conflicts</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 my-auto">
              <div className="rounded-xl sm:rounded-2xl border border-rose-200 bg-white/90 p-2.5 sm:p-3.5 shadow-sm">
                <div className="text-[9px] sm:text-[10px] font-mono text-rose-700 truncate">Mark Sheet</div>
                <div className="font-serif text-base sm:text-xl md:text-2xl font-bold text-rose-800 mt-0.5">
                  #REF!
                </div>
                <div className="text-[10px] sm:text-[11px] text-rose-600 mt-0.5 truncate hidden sm:block">Missing CA3 Mark</div>
                <div className="text-[9px] text-rose-600 sm:hidden">Missing CA3</div>
              </div>

              <div className="rounded-xl sm:rounded-2xl border border-rose-200 bg-white/90 p-2.5 sm:p-3.5 shadow-sm">
                <div className="text-[9px] sm:text-[10px] font-mono text-rose-700 truncate">Teller Slip</div>
                <div className="font-serif text-base sm:text-xl md:text-2xl font-bold text-rose-800 mt-0.5 truncate">
                  Unlinked
                </div>
                <div className="text-[10px] sm:text-[11px] text-stone-600 mt-0.5 truncate hidden sm:block">₦100k missing ID</div>
                <div className="text-[9px] text-stone-500 sm:hidden">No ID</div>
              </div>

              <div className="rounded-xl sm:rounded-2xl border border-rose-200 bg-white/90 p-2.5 sm:p-3.5 shadow-sm">
                <div className="text-[9px] sm:text-[10px] font-mono text-rose-700 truncate">Parent Call</div>
                <div className="font-serif text-base sm:text-xl md:text-2xl font-bold text-rose-800 mt-0.5 truncate">
                  5 Missed
                </div>
                <div className="text-[10px] sm:text-[11px] text-stone-600 mt-0.5 truncate hidden sm:block">"Where is card?"</div>
                <div className="text-[9px] text-stone-500 sm:hidden">Waiting</div>
              </div>
            </div>

            <div className="text-[10px] sm:text-[11px] text-rose-800 font-mono flex items-center justify-between border-t border-rose-200 pt-2">
              <span>Latency: 3 days</span>
              <span className="hidden sm:inline">High risk of grade calculation errors</span>
              <span className="sm:hidden">Manual paper risk</span>
            </div>
          </div>

          {/* DRAGGABLE SLIDER DIVIDER LINE & HANDLE */}
          <div
            ref={dividerRef}
            className="absolute top-0 bottom-0 w-1 bg-stone-900 z-30 shadow-[0_0_20px_rgba(0,0,0,0.35)] pointer-events-none"
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-stone-900 border-2 border-white text-white flex items-center justify-center shadow-2xl">
              <ArrowLeftRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
