"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CheckCircle2 } from "lucide-react";

interface SystemData {
  id: string;
  number: string;
  category: string;
  title: string;
  description: string;
  metric1: { val: string; label: string };
  metric2: { val: string; label: string };
  bullet1: string;
  bullet2: string;
}

const SYSTEMS: SystemData[] = [
  {
    id: "admissions",
    number: "01",
    category: "Pre-Classroom",
    title: "Admissions Pipeline & Enrolment",
    description:
      "Parents complete application forms online. Entrance scores, birth certificate uploads, and tuition deposits automatically assign students to class arms with student IDs generated.",
    metric1: { val: "Auto-Tracked", label: "Document Verification" },
    metric2: { val: "Instant", label: "Roster Allocation" },
    bullet1: "Multi-stage digital application forms with parent document uploads",
    bullet2: "Automated CBT entrance exam scoring & roster promotion",
  },
  {
    id: "broadsheet",
    number: "02",
    category: "Academic Engine",
    title: "Broadsheet & WAEC Grade Matrix",
    description:
      "Subject teachers input continuous assessments (CA1, CA2) and examination marks. Melo calculates cumulative averages, subject rankings, and WAEC 9-point grades in 0.38 seconds.",
    metric1: { val: "0.38s", label: "Compilation Latency" },
    metric2: { val: "100%", label: "Formula Accuracy" },
    bullet1: "Real-time validation prevents invalid score entries (e.g. 85/20 in CA)",
    bullet2: "WAEC A1–F9 and Universal Primary grading scales built-in",
  },
  {
    id: "bursary",
    number: "03",
    category: "Bursary & Settlement",
    title: "Multi-Channel Fee Reconciliation",
    description:
      "Parents pay tuition via Providus dedicated virtual accounts or Paystack card links. Transactions reconcile into student fee ledgers in real time with zero manual ledger matching.",
    metric1: { val: "₦0 Gap", label: "Unmatched Bank Alert" },
    metric2: { val: "Real-Time", label: "Receipt Dispatch" },
    bullet1: "Dedicated virtual bank account numbers per student",
    bullet2: "Automated fee aging, balance reminders, and digital receipts",
  },
  {
    id: "curriculum",
    number: "04",
    category: "Curriculum Preparation",
    title: "AI Lesson & Curriculum Hub",
    description:
      "Generates structured lesson notes, weekly learning objectives, and CBT question banks aligned with official Nigerian NERDC and WAEC curriculum frameworks.",
    metric1: { val: "-80%", label: "Teacher Prep Time" },
    metric2: { val: "NERDC / WAEC", label: "Curriculum Alignment" },
    bullet1: "NERDC curriculum alignment across Primary, JSS, and SSS",
    bullet2: "Instant CBT quiz generation with automated marking schemes",
  },
];

export function HorizontalSystemsGallery() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    const calculateDistance = () => {
      const cards = track.querySelectorAll(".gallery-card");
      const lastCard = cards[cards.length - 1] as HTMLElement;
      if (!lastCard) return track.scrollWidth - window.innerWidth + 100;

      // Bring Card 4 dead-center in viewport
      const cardCenterOffset = (window.innerWidth - lastCard.offsetWidth) / 2;
      return Math.max(0, lastCard.offsetLeft - cardCenterOffset);
    };

    const ctx = gsap.context(() => {
      const dist = calculateDistance();

      gsap.to(track, {
        x: () => -calculateDistance(),
        ease: "none",
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: () => `+=${calculateDistance() + 500}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const idx = Math.min(3, Math.floor(self.progress * 4));
            setActiveIndex(idx);
          },
        },
      });

      // Subtle parallax on inner card content
      gsap.utils.toArray<HTMLElement>(".gallery-card-inner").forEach((inner) => {
        gsap.fromTo(
          inner,
          { xPercent: -4 },
          {
            xPercent: 4,
            ease: "none",
            scrollTrigger: {
              trigger: container,
              start: "top top",
              end: () => `+=${calculateDistance() + 500}`,
              scrub: 1,
            },
          }
        );
      });
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative w-full min-h-screen bg-[#FAF9F5] flex flex-col justify-center overflow-hidden py-14"
    >
      {/* Header & Progress Indicator */}
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
            Four unified operating systems.
          </h2>
          <p className="mt-2 text-stone-600 text-xs sm:text-sm font-light">
            Scroll down to explore the platform architecture:
          </p>
        </div>

        {/* Progress Display */}
        <div className="flex items-center gap-3 font-mono text-xs text-stone-500">
          <span className="font-semibold text-stone-700">0{activeIndex + 1} / 04</span>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeIndex === i ? "w-6 bg-amber-600" : "w-2 bg-stone-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Horizontal Runway Track with generous right padding for centering Card 4 */}
      <div className="w-full overflow-visible">
        <div
          ref={trackRef}
          className="flex gap-6 px-4 sm:px-12 pr-[60vw] w-max items-center will-change-transform py-2"
        >
          {SYSTEMS.map((system) => (
            <div
              key={system.id}
              className="gallery-card w-[85vw] sm:w-[460px] md:w-[500px] rounded-3xl border border-stone-300 bg-white p-7 sm:p-8 shadow-sm hover:border-stone-400 transition-all shrink-0 flex flex-col justify-between min-h-[380px] sm:min-h-[400px]"
            >
              <div className="gallery-card-inner space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <span className="text-[11px] font-mono text-stone-500 uppercase tracking-wider font-semibold">
                    {system.category}
                  </span>
                  <span className="font-serif text-2xl sm:text-3xl font-bold text-stone-300">
                    {system.number}
                  </span>
                </div>

                <div>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 leading-tight">
                    {system.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 font-light mt-2 leading-relaxed">
                    {system.description}
                  </p>
                </div>

                {/* Clean inline metrics */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="border-l-2 border-amber-500/80 pl-3">
                    <span className="text-[10px] font-mono text-stone-400 block uppercase">
                      {system.metric1.label}
                    </span>
                    <span className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
                      {system.metric1.val}
                    </span>
                  </div>
                  <div className="border-l-2 border-emerald-500/80 pl-3">
                    <span className="text-[10px] font-mono text-stone-400 block uppercase">
                      {system.metric2.label}
                    </span>
                    <span className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
                      {system.metric2.val}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-4 border-t border-stone-100 text-xs font-mono text-stone-700">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{system.bullet1}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{system.bullet2}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
