"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  FileSpreadsheet,
  Coins,
  Sparkles,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { playTick } from "../../lib/audio-feedback";

interface SystemSlide {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  icon: typeof FileSpreadsheet;
  metrics: { label: string; value: string }[];
  bulletPoints: string[];
  color: "amber" | "emerald" | "sky" | "purple";
}

const SYSTEMS: SystemSlide[] = [
  {
    id: "admissions",
    step: "SYSTEM 01",
    title: "Admissions Pipeline & Enrolment",
    subtitle: "Turn chaotic paper application forms into an organized digital intake pipeline.",
    description:
      "Capture candidate information with customizable forms, score assessment interviews, track document verification, and convert accepted candidates directly into enrolled class rosters with auto-generated student IDs.",
    badge: "Candidate-to-Classroom",
    icon: UserPlus,
    metrics: [
      { label: "Intake Speed", value: "100% Digital" },
      { label: "Document Verification", value: "Auto-Tracked" },
    ],
    bulletPoints: [
      "Customizable multi-stage application forms",
      "Document upload verification & entrance scoring",
      "1-Click conversion from applicant to enrolled student",
    ],
    color: "sky",
  },
  {
    id: "academic",
    step: "SYSTEM 02",
    title: "Broadsheet & WAEC Grade Matrix",
    subtitle: "Never compile end-of-term results in Excel at 4:00 AM again.",
    description:
      "Subject teachers input continuous assessment (CA1, CA2) and examination marks into a structured gradebook. Melo calculates class averages, subject rankings, and WAEC 9-point grades in 0.38 seconds.",
    badge: "0.38s Compilation",
    icon: FileSpreadsheet,
    metrics: [
      { label: "Compilation Latency", value: "0.38s" },
      { label: "Calculation Accuracy", value: "100% Guaranteed" },
    ],
    bulletPoints: [
      "Real-time validation prevents impossible scores (e.g. 85/20)",
      "WAEC A1–F9 and Universal Primary scales supported",
      "Cumulative 3-term weightings & promotion rules",
    ],
    color: "amber",
  },
  {
    id: "bursary",
    step: "SYSTEM 03",
    title: "Bursary & Fee Reconciliation",
    subtitle: "Match every naira collected against student invoices automatically.",
    description:
      "Generate term fee invoices with custom levies and sibling discounts. Settle tuition via Paystack online gateways or dedicated Providus virtual bank accounts with instant automated reconciliation and zero unmatched gap.",
    badge: "₦0 Reconciliation Gap",
    icon: Coins,
    metrics: [
      { label: "Unmatched Gap", value: "₦0 Gap" },
      { label: "Receipt Time", value: "Instant" },
    ],
    bulletPoints: [
      "Dynamic Providus virtual bank accounts for every student",
      "Direct Paystack card payment link integration",
      "Real-time debt aging reports & 1-click WhatsApp reminders",
    ],
    color: "emerald",
  },
  {
    id: "curriculum",
    step: "SYSTEM 04",
    title: "AI Lesson & Curriculum Hub",
    subtitle: "Empower teachers with lesson preparation and question generation.",
    description:
      "Ingest syllabus documents, textbooks, and educational resources. Teachers generate standardized lesson plans, student summary notes, and CBT question banks tailored to their curriculum with administrative review workflows.",
    badge: "Curriculum-Aligned AI",
    icon: Sparkles,
    metrics: [
      { label: "Teacher Prep Time", value: "70% Faster" },
      { label: "Question Generation", value: "Instant CBT" },
    ],
    bulletPoints: [
      "OCR textbook & syllabus document ingestion",
      "Standardized lesson plan & student note drafting",
      "Computer-Based Testing (CBT) question bank generator",
    ],
    color: "purple",
  },
];

export function HorizontalSystemsGallery() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const ctx = gsap.context(() => {
      const calculateDistance = () => track.scrollWidth - window.innerWidth;

      const horizontalTween = gsap.to(track, {
        x: () => -calculateDistance(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${calculateDistance() + 600}`,
          pin: true,
          pinSpacing: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;
            if (progressBarRef.current) {
              progressBarRef.current.style.width = `${Math.min(100, Math.max(0, p * 100))}%`;
            }
            const slideIndex = Math.min(
              SYSTEMS.length - 1,
              Math.floor(p * SYSTEMS.length)
            );
            setActiveSlideIndex(slideIndex);
          },
        },
      });

      // Inner element parallax
      const slides = gsap.utils.toArray<HTMLElement>(".horizontal-system-slide");
      slides.forEach((slide) => {
        const innerCard = slide.querySelector(".slide-inner-card");
        if (!innerCard) return;

        gsap.fromTo(
          innerCard,
          { xPercent: -10 },
          {
            xPercent: 10,
            ease: "none",
            scrollTrigger: {
              trigger: slide,
              containerAnimation: horizontalTween,
              start: "left right",
              end: "right left",
              scrub: true,
            },
          }
        );
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full min-h-screen bg-[#FAF9F5] overflow-hidden flex flex-col justify-between py-12 select-none"
    >
      {/* Top Header & Runway Scrubber Bar */}
      <div className="w-full max-w-6xl mx-auto px-6 sm:px-8 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-1 text-xs font-mono font-medium text-stone-700 mb-2 shadow-sm">
              <Zap className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
              <span>PINNED ARCHITECTURE RUNWAY</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
              Four unified operating systems.
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
            <span>Progress:</span>
            <div className="w-32 sm:w-48 h-2 rounded-full bg-stone-200 overflow-hidden relative">
              <div
                ref={progressBarRef}
                className="h-full bg-amber-500 rounded-full transition-all duration-75"
                style={{ width: "0%" }}
              />
            </div>
            <span className="font-bold text-stone-800">
              0{activeSlideIndex + 1}/0{SYSTEMS.length}
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal Track */}
      <div
        ref={trackRef}
        className="flex gap-8 px-6 sm:px-12 w-max items-center my-auto will-change-transform"
      >
        {SYSTEMS.map((system, idx) => {
          const Icon = system.icon;
          const isAmber = system.color === "amber";
          const isEmerald = system.color === "emerald";
          const isSky = system.color === "sky";

          const accentColor = isAmber
            ? "border-amber-400 bg-amber-50/60 text-amber-800"
            : isEmerald
            ? "border-emerald-400 bg-emerald-50/60 text-emerald-800"
            : isSky
            ? "border-sky-400 bg-sky-50/60 text-sky-800"
            : "border-purple-400 bg-purple-50/60 text-purple-800";

          const iconBg = isAmber
            ? "bg-amber-100 text-amber-700 border-amber-300"
            : isEmerald
            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
            : isSky
            ? "bg-sky-100 text-sky-700 border-sky-300"
            : "bg-purple-100 text-purple-700 border-purple-300";

          return (
            <div
              key={system.id}
              className="horizontal-system-slide w-[85vw] sm:w-[580px] md:w-[680px] shrink-0"
            >
              <div className="slide-inner-card rounded-3xl border border-stone-300 bg-white p-6 sm:p-10 shadow-xl transition-all duration-300 hover:shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
                {/* Top Badge & Numeral */}
                <div>
                  <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center border shadow-sm ${iconBg}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-500">
                          {system.step}
                        </span>
                        <div className="text-xs font-mono font-bold text-stone-900">
                          {system.badge}
                        </div>
                      </div>
                    </div>

                    <span className="font-serif text-3xl font-bold text-stone-300">
                      0{idx + 1}
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
                    {system.title}
                  </h3>
                  <p className="mt-2 text-stone-600 text-xs sm:text-sm font-light leading-relaxed">
                    {system.description}
                  </p>
                </div>

                {/* Metrics Badges */}
                <div className="grid grid-cols-2 gap-3 my-6">
                  {system.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3.5"
                    >
                      <span className="text-[10px] font-mono text-stone-500 block uppercase">
                        {metric.label}
                      </span>
                      <span className="font-serif text-lg sm:text-xl font-bold text-stone-900 mt-0.5 block">
                        {metric.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bullet Points */}
                <div className="border-t border-stone-100 pt-4 space-y-2">
                  {system.bulletPoints.map((point) => (
                    <div
                      key={point}
                      className="flex items-center gap-2 text-xs font-sans text-stone-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Instruction */}
      <div className="w-full max-w-6xl mx-auto px-6 sm:px-8 text-center sm:text-left">
        <span className="text-[11px] font-mono text-stone-500">
          ← Scroll down to traverse the complete 4-system institutional runway →
        </span>
      </div>
    </section>
  );
}
