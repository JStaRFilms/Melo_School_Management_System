"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  GraduationCap,
  Coins,
  Smartphone,
  CheckCircle2,
} from "lucide-react";

interface PillarData {
  id: string;
  number: string;
  title: string;
  summary: string;
  bullet1: string;
  bullet2: string;
  backTitle: string;
  backSummary: string;
  specs: { label: string; value: string }[];
}

const PILLARS: PillarData[] = [
  {
    id: "academic",
    number: "01",
    title: "Academic Command",
    summary:
      "Teachers enter scores once. Continuous assessments, cumulative term averages, and WAEC 9-point grades calculate instantly without Excel formulas.",
    bullet1: "0.38s Full Broadsheet Compilation",
    bullet2: "Automatic Rank & Grade Band Assignment",
    backTitle: "Broadsheet Grade Matrix",
    backSummary:
      "Automated compilation engine adhering strictly to national secondary curriculum and promotion standards.",
    specs: [
      { label: "Grading Scale", value: "WAEC Standard (A1–F9)" },
      { label: "Assessment Weighting", value: "CA (40%) + Exam (60%)" },
      { label: "Position Tiebreak", value: "Cumulative Term Average" },
    ],
  },
  {
    id: "bursary",
    number: "02",
    title: "Bursary & Fee Terminal",
    summary:
      "Paystack cards and Providus dedicated virtual accounts clear directly into student ledgers with automated receipts and zero manual reconciliation gaps.",
    bullet1: "₦0 Unmatched Bank Alert Gaps",
    bullet2: "Automated Fee Aging & Debt Ledger",
    backTitle: "Automated Fee Settlement",
    backSummary:
      "Direct banking integrations reconcile invoice collections in real time with instant ledger synchronization.",
    specs: [
      { label: "Virtual Bank Feed", value: "Providus Bank Accounts" },
      { label: "Card Gateway", value: "Paystack Instant Webhooks" },
      { label: "Payment Verification", value: "Cryptographic Receipt Slips" },
    ],
  },
  {
    id: "portal",
    number: "03",
    title: "Parent Visibility",
    summary:
      "Parents view verified report cards, attendance, and fee status directly from mobile browsers with secure student token PIN authentication.",
    bullet1: "Direct Mobile Browser Report Slips",
    bullet2: "Zero Physical App Downloads Required",
    backTitle: "Direct Family Portal",
    backSummary:
      "Frictionless mobile access for parents to view academic progress and tuition statements securely.",
    specs: [
      { label: "Authentication", value: "Encrypted Student PIN / Token" },
      { label: "Document Format", value: "Official PDF Term Reports" },
      { label: "Financial Clearance", value: "Configurable Fee Access Lock" },
    ],
  },
];

export function SplitPillarShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const container = containerRef.current;
    if (!container) return;

    const ctx = gsap.context(() => {
      const isMobile = window.innerWidth < 768;

      if (!isMobile) {
        // Desktop: Pinned 3-Card Staggered Flip
        ScrollTrigger.create({
          trigger: container,
          start: "top top",
          end: "+=1800",
          pin: true,
          pinSpacing: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;

            if (p >= 0.32) {
              const flipProgress = gsap.utils.clamp(0, 1, (p - 0.32) / 0.45);
              gsap.to("#inner-card-academic", {
                rotationY: flipProgress >= 0.25 ? 180 : 0,
                duration: 0.6,
                ease: "power2.out",
                overwrite: "auto",
              });
              gsap.to("#inner-card-bursary", {
                rotationY: flipProgress >= 0.55 ? 180 : 0,
                duration: 0.6,
                ease: "power2.out",
                overwrite: "auto",
              });
              gsap.to("#inner-card-portal", {
                rotationY: flipProgress >= 0.85 ? 180 : 0,
                duration: 0.6,
                ease: "power2.out",
                overwrite: "auto",
              });
            } else {
              gsap.to([
                "#inner-card-academic",
                "#inner-card-bursary",
                "#inner-card-portal",
              ], {
                rotationY: 0,
                duration: 0.5,
                ease: "power2.out",
                overwrite: "auto",
              });
            }
          },
        });
      } else {
        // Mobile: One card at a time.
        // As you scroll: card enters in FRONT view so you read it,
        // then as you scroll through the middle focus zone, it flips to BACK view so you can read the back!
        PILLARS.forEach((pillar) => {
          ScrollTrigger.create({
            trigger: `#card-container-${pillar.id}`,
            start: "top 65%",
            end: "bottom 20%",
            onUpdate: (self) => {
              const p = self.progress;
              // 0.0 -> 0.42: Front face (0 deg)
              // 0.42 -> 1.0: Back face (180 deg)
              if (p >= 0.42) {
                gsap.to(`#inner-card-${pillar.id}`, {
                  rotationY: 180,
                  duration: 0.6,
                  ease: "power2.out",
                  overwrite: "auto",
                });
              } else {
                gsap.to(`#inner-card-${pillar.id}`, {
                  rotationY: 0,
                  duration: 0.5,
                  ease: "power2.out",
                  overwrite: "auto",
                });
              }
            },
          });
        });
      }
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="w-full min-h-screen flex flex-col items-center justify-center bg-[#FAF9F5] py-20 px-4 sm:px-8 relative overflow-hidden"
    >
      <div className="max-w-6xl w-full mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
            How the 3 operational cores connect.
          </h2>
          <p className="mt-3 text-stone-600 text-sm sm:text-base font-light leading-relaxed">
            Scroll down to watch each core reveal its internal operational safeguards:
          </p>
        </div>

        {/* 3D Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.id}
              id={`card-container-${pillar.id}`}
              className="relative h-[430px] w-full my-2 md:my-0"
              style={{ perspective: "1400px" }}
            >
              {/* Flipping Container */}
              <div
                id={`inner-card-${pillar.id}`}
                className="relative w-full h-full rounded-3xl shadow-sm will-change-transform"
                style={{
                  transformStyle: "preserve-3d",
                  WebkitTransformStyle: "preserve-3d",
                  transform: "rotateY(0deg)",
                }}
              >
                {/* ──────────────── FRONT FACE ──────────────── */}
                <div
                  className="absolute inset-0 w-full h-full rounded-3xl border border-stone-300 bg-white p-7 sm:p-8 flex flex-col justify-between shadow-sm"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(0deg) translateZ(2px)",
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-amber-700 tracking-wider">
                        CORE {pillar.number}
                      </span>
                      {pillar.id === "academic" && (
                        <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                      )}
                      {pillar.id === "bursary" && (
                        <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
                          <Coins className="h-4 w-4" />
                        </div>
                      )}
                      {pillar.id === "portal" && (
                        <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center border border-sky-200">
                          <Smartphone className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    <h3 className="font-serif text-2xl font-bold text-stone-900 mt-5">
                      {pillar.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-600 font-light mt-2 leading-relaxed">
                      {pillar.summary}
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-stone-100 text-xs font-mono text-stone-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>{pillar.bullet1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>{pillar.bullet2}</span>
                    </div>
                  </div>
                </div>

                {/* ──────────────── BACK FACE ──────────────── */}
                <div
                  className="absolute inset-0 w-full h-full rounded-3xl border border-stone-800 bg-[#161514] p-7 sm:p-8 text-stone-100 flex flex-col justify-between shadow-xl"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg) translateZ(2px)",
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                      <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
                        Operational Specs
                      </span>
                      <span className="text-[11px] font-mono text-stone-400">
                        CORE {pillar.number}
                      </span>
                    </div>

                    <h4 className="font-serif text-2xl font-bold text-[#FAF9F5] mt-4">
                      {pillar.backTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-stone-300 font-light mt-2 leading-relaxed">
                      {pillar.backSummary}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-stone-900/90 border border-stone-800 p-4 space-y-2.5 font-mono text-xs text-stone-300">
                    {pillar.specs.map((spec, i) => (
                      <div key={i} className="flex justify-between items-center py-0.5 border-b border-stone-800/60 last:border-b-0 pb-1.5 last:pb-0">
                        <span className="text-stone-400 text-[11px]">{spec.label}:</span>
                        <span className="text-stone-100 font-medium text-[11px]">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
