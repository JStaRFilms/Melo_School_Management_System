"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  GraduationCap,
  Coins,
  Smartphone,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { playTick } from "../../lib/audio-feedback";

export function SplitPillarShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const container = containerRef.current;
    if (!container) return;

    let isSplit = false;
    let isFlipped = false;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: "+=2200",
        pin: true,
        pinSpacing: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;

          // Stage 1: Card Scale (0.00 -> 0.28)
          if (p <= 0.28) {
            const scale = gsap.utils.mapRange(0, 0.28, 0.9, 1.0, p);
            gsap.set(".pillar-cards-wrapper", { scale });
          }

          // Stage 2: Gap Expansion & Split (0.32 threshold)
          if (p >= 0.32 && !isSplit) {
            gsap.to(".pillar-cards-wrapper", { gap: "24px", duration: 0.6, ease: "power3.out" });
            gsap.to(".pillar-split-card", { borderRadius: "24px", duration: 0.6, ease: "power3.out" });
            isSplit = true;
          } else if (p < 0.32 && isSplit) {
            gsap.to(".pillar-cards-wrapper", { gap: "0px", duration: 0.6, ease: "power3.out" });
            gsap.to("#card-academic", { borderRadius: "24px 0 0 24px", duration: 0.6 });
            gsap.to("#card-bursary", { borderRadius: "0px", duration: 0.6 });
            gsap.to("#card-portal", { borderRadius: "0 24px 24px 0", duration: 0.6 });
            isSplit = false;
          }

          // Stage 3: 3D Spatial Flip (0.62 threshold)
          if (p >= 0.62 && !isFlipped) {
            gsap.to(".pillar-split-card", {
              rotationY: 180,
              duration: 0.8,
              stagger: 0.1,
              ease: "power3.inOut",
            });
            gsap.to("#card-academic", { rotationZ: -5, y: 12, duration: 0.8, ease: "power3.out" });
            gsap.to("#card-portal", { rotationZ: 5, y: 12, duration: 0.8, ease: "power3.out" });
            isFlipped = true;
          } else if (p < 0.62 && isFlipped) {
            gsap.to(".pillar-split-card", {
              rotationY: 0,
              duration: 0.8,
              stagger: -0.1,
              ease: "power3.inOut",
            });
            gsap.to(["#card-academic", "#card-portal"], {
              rotationZ: 0,
              y: 0,
              duration: 0.8,
              ease: "power3.out",
            });
            isFlipped = false;
          }
        },
      });
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full min-h-screen flex flex-col items-center justify-center bg-[#FAF9F5] py-16 px-4 sm:px-8 relative overflow-hidden"
    >
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-1 text-xs font-mono font-medium text-stone-700 mb-3 shadow-sm">
          <Layers className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
          <span>3 SYNCHRONIZED PILLARS • 1 UNIFIED INSTITUTION</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
          How the 3 operational cores connect.
        </h2>
        <p className="mt-2 text-stone-600 text-xs sm:text-sm font-light">
          Scroll down to watch the unified institution deconstruct and reveal its internal operational safeguards:
        </p>
      </div>

      {/* 3D Cards Wrapper */}
      <div
        className="pillar-cards-wrapper flex flex-col md:flex-row gap-0 w-full max-w-5xl transition-all duration-300"
        style={{ perspective: "1400px", transformStyle: "preserve-3d" }}
      >
        {/* CARD 1: ACADEMICS */}
        <div
          id="card-academic"
          className="pillar-split-card flex-1 min-h-[380px] sm:min-h-[420px] relative rounded-t-3xl md:rounded-t-none md:rounded-l-3xl overflow-hidden border border-stone-300 shadow-xl bg-white"
          style={{
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
          }}
        >
          {/* Front Face */}
          <div
            className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-b from-white to-amber-50/20"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "translateZ(2px)",
            }}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-300/80 shadow-sm">
                  <GraduationCap className="h-6 w-6 text-amber-700" />
                </div>
                <span className="text-[10px] font-mono font-bold bg-amber-100/70 text-amber-900 px-2.5 py-1 rounded-full border border-amber-200">
                  PILLAR 01
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-6">
                Academic Command
              </h3>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed font-light">
                Teachers input marks once. Continuous assessments, cumulative term averages, and WAEC 9-point grades calculate instantly without Excel formulas.
              </p>
            </div>

            <div className="border-t border-stone-200/80 pt-4 space-y-2 text-xs font-mono text-stone-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>0.38s Full Broadsheet Compilation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Automatic Rank & Grade Band Assignment</span>
              </div>
            </div>
          </div>

          {/* Back Face */}
          <div
            className="absolute inset-0 p-6 sm:p-8 bg-stone-950 text-white flex flex-col justify-between"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translateZ(2px)",
            }}
          >
            <div>
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <span className="text-[10px] font-mono text-amber-400 uppercase font-semibold">
                  Under The Hood
                </span>
                <span className="text-[10px] font-mono text-stone-400">Engine Telemetry</span>
              </div>
              <h4 className="font-serif text-xl font-bold text-white mt-4">
                Automated WAEC Matrix
              </h4>
              <p className="text-xs text-stone-300 font-light mt-1 leading-relaxed">
                Replaces error-prone spreadsheets with verified institutional grading rules and automatic promotion criteria.
              </p>
            </div>

            <div className="rounded-xl bg-stone-900 border border-stone-800 p-3 space-y-1.5 font-mono text-[11px] text-stone-300">
              <div className="flex justify-between">
                <span className="text-stone-500">Grading Scale:</span>
                <span className="text-amber-400 font-bold">WAEC A1–F9 Certified</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">CA Weighting:</span>
                <span>CA1 (20) + CA2 (20) + Exam (60)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Auto-Tiebreak:</span>
                <span>Cumulative Average Metric</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: BURSARY */}
        <div
          id="card-bursary"
          className="pillar-split-card flex-1 min-h-[380px] sm:min-h-[420px] relative overflow-hidden border-y md:border-y-0 md:border-x border-stone-300 shadow-xl bg-white"
          style={{
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
          }}
        >
          {/* Front Face */}
          <div
            className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-b from-white to-emerald-50/20"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "translateZ(2px)",
            }}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-300/80 shadow-sm">
                  <Coins className="h-6 w-6 text-emerald-700" />
                </div>
                <span className="text-[10px] font-mono font-bold bg-emerald-100/70 text-emerald-900 px-2.5 py-1 rounded-full border border-emerald-200">
                  PILLAR 02
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-6">
                Bursary & Fee Terminal
              </h3>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed font-light">
                Paystack cards and Providus dedicated virtual accounts clear directly into student ledgers with automated receipt dispatch and zero manual reconciliation gaps.
              </p>
            </div>

            <div className="border-t border-stone-200/80 pt-4 space-y-2 text-xs font-mono text-stone-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>₦0 Unmatched Bank Alert Gaps</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Automated Fee Aging & Debt Ledger</span>
              </div>
            </div>
          </div>

          {/* Back Face */}
          <div
            className="absolute inset-0 p-6 sm:p-8 bg-stone-950 text-white flex flex-col justify-between"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translateZ(2px)",
            }}
          >
            <div>
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                  Multi-Channel Settle
                </span>
                <span className="text-[10px] font-mono text-stone-400">Direct Invoicing</span>
              </div>
              <h4 className="font-serif text-xl font-bold text-white mt-4">
                Real-Time Settlement
              </h4>
              <p className="text-xs text-stone-300 font-light mt-1 leading-relaxed">
                Parents pay through dedicated accounts or Paystack links; tuition updates instantly without paper teller slips.
              </p>
            </div>

            <div className="rounded-xl bg-stone-900 border border-stone-800 p-3 space-y-1.5 font-mono text-[11px] text-stone-300">
              <div className="flex justify-between">
                <span className="text-stone-500">Virtual Bank:</span>
                <span className="text-emerald-400 font-bold">Providus Dynamic Account</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Gateway:</span>
                <span>Paystack Instant Webhook</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Receipts:</span>
                <span>Cryptographically Timestamped</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: PARENT PORTAL */}
        <div
          id="card-portal"
          className="pillar-split-card flex-1 min-h-[380px] sm:min-h-[420px] relative rounded-b-3xl md:rounded-b-none md:rounded-r-3xl overflow-hidden border border-stone-300 shadow-xl bg-white"
          style={{
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
          }}
        >
          {/* Front Face */}
          <div
            className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-b from-white to-sky-50/20"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "translateZ(2px)",
            }}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center border border-sky-300/80 shadow-sm">
                  <Smartphone className="h-6 w-6 text-sky-700" />
                </div>
                <span className="text-[10px] font-mono font-bold bg-sky-100/70 text-sky-900 px-2.5 py-1 rounded-full border border-sky-200">
                  PILLAR 03
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-6">
                Parent Visibility
              </h3>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed font-light">
                Parents view verified report cards, attendance, and fee status directly from mobile browsers, with secure student token PIN authentication.
              </p>
            </div>

            <div className="border-t border-stone-200/80 pt-4 space-y-2 text-xs font-mono text-stone-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                <span>Direct Mobile Browser Report Slips</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                <span>Zero Physical App Downloads Required</span>
              </div>
            </div>
          </div>

          {/* Back Face */}
          <div
            className="absolute inset-0 p-6 sm:p-8 bg-stone-950 text-white flex flex-col justify-between"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translateZ(2px)",
            }}
          >
            <div>
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <span className="text-[10px] font-mono text-sky-400 uppercase font-semibold">
                  Family Connectivity
                </span>
                <span className="text-[10px] font-mono text-stone-400">Mobile First</span>
              </div>
              <h4 className="font-serif text-xl font-bold text-white mt-4">
                Direct Family Portals
              </h4>
              <p className="text-xs text-stone-300 font-light mt-1 leading-relaxed">
                Parents securely access student report cards and historical transcripts with secure one-time PIN authentication.
              </p>
            </div>

            <div className="rounded-xl bg-stone-900 border border-stone-800 p-3 space-y-1.5 font-mono text-[11px] text-stone-300">
              <div className="flex justify-between">
                <span className="text-stone-500">Security:</span>
                <span className="text-sky-400 font-bold">Encrypted Student Token</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Delivery:</span>
                <span>Direct PDF Slip Portal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Fee Access Gate:</span>
                <span>Configurable Clearance Lock</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
