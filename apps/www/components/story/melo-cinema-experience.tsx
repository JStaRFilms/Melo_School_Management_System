"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  CreditCard,
  FileSpreadsheet,
  Printer,
  Receipt,
  Send,
  Smartphone,
  Sparkles,
  Zap,
  TrendingUp,
  ShieldCheck,
  Clock,
  Layers,
} from "lucide-react";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { pricingTiers, platformAddOns } from "@/site";
import { GoldButton } from "@/site-ui";
import { ArchitecturalDraftingCanvas } from "./architectural-drafting-canvas";
import { GsapPinnedScrollyLens } from "./gsap-pinned-scrolly-lens";
import { InteractiveReportModal } from "./interactive-report-modal";
import { KineticMagneticHeading } from "../ui/kinetic-magnetic-heading";
import { Card3DTilt } from "../ui/card-3d-tilt";
import { playTick } from "../../lib/audio-feedback";

// Simulated live telemetry feeds
const LIVE_TELEMETRY_EVENTS = [
  "₦185,000 tuition cleared for Sarah Okon (JSS 2) • Paystack #4091",
  "WAEC 9-point scale recalculated for SSS 1 Science • 0.38s",
  "Parent report cards dispatched for Primary 5 Diamond",
  "₦85,000 invoice auto-reconciled via Providus bank feed",
  "Continuous assessment CA1 & CA2 locked for Term 2",
];

export function MeloCinemaExperience() {
  const [activeTab, setActiveTab] = useState<"broadsheet" | "bursary" | "portal">("broadsheet");
  const [selectedClassArm, setSelectedClassArm] = useState("JSS 2 Silver");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState("Sarah Okon");

  // Simulated Live Ledger Ticker
  const [telemetryIndex, setTelemetryIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetryIndex((prev) => (prev + 1) % LIVE_TELEMETRY_EVENTS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Deck of Cards Stacking Orchestration (Creative Web Dev Skill Phase 3 & Section 6)
  const deckRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const container = deckRef.current;
    if (!container) return;

    const mm = gsap.matchMedia();

    mm.add(
      {
        isDesktop: "(min-width: 769px)",
        isMobile: "(max-width: 768px)",
      },
      (context) => {
        const { isDesktop } = context.conditions as { isDesktop: boolean; isMobile: boolean };
        const cards = gsap.utils.toArray<HTMLElement>(".deck-stack-card");

        cards.forEach((card, index) => {
          if (index === cards.length - 1) return;

          const nextCard = cards[index + 1];

          gsap.to(card, {
            scale: isDesktop ? 0.94 : 0.97,
            opacity: isDesktop ? 0.4 : 0.6,
            yPercent: isDesktop ? -5 : -2,
            ease: "none",
            scrollTrigger: {
              trigger: nextCard,
              start: isDesktop ? "top 80%" : "top 85%",
              end: isDesktop ? "top 20%" : "top 30%",
              scrub: true,
            },
          });
        });
      }
    );

    return () => mm.revert();
  }, []);

  // School Scale Estimator State (Per-Student pricing starting at ₦1,000 / student)
  const [estimatorStudents, setEstimatorStudents] = useState(480);
  const [avgTuition, setAvgTuition] = useState(185000);

  // Editable Student Scores State with Live Dynamic Re-ordering
  const [students, setStudents] = useState([
    {
      id: "1",
      name: "Sarah Okon",
      ca1: 19,
      ca2: 18,
      exam: 56,
      feeStatus: "arrears" as const,
      arrearsAmount: 85000,
    },
    {
      id: "2",
      name: "Amina Bello",
      ca1: 18,
      ca2: 19,
      exam: 53,
      feeStatus: "cleared" as const,
      arrearsAmount: 0,
    },
    {
      id: "3",
      name: "David Adeleke",
      ca1: 16,
      ca2: 17,
      exam: 51,
      feeStatus: "cleared" as const,
      arrearsAmount: 0,
    },
    {
      id: "4",
      name: "Chukwudi Eze",
      ca1: 15,
      ca2: 15,
      exam: 48,
      feeStatus: "arrears" as const,
      arrearsAmount: 45000,
    },
  ]);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleScoreChange = (id: string, field: "ca1" | "ca2" | "exam", value: number) => {
    playTick("soft");
    const maxVal = field === "exam" ? 60 : 20;
    const clamped = Math.max(0, Math.min(maxVal, isNaN(value) ? 0 : value));
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: clamped } : s))
    );
  };

  // Paystack Live Settle Simulation
  const handlePaystackPayment = (studentId: string) => {
    playTick("settle");
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, feeStatus: "cleared", arrearsAmount: 0 } : s
      )
    );
    showToast("⚡ Paystack Payment Confirmed! ₦85,000 reconciled & digital receipt generated.");
  };

  // WhatsApp Reminder Dispatch
  const handleSendWhatsApp = () => {
    playTick("click");
    showToast("📱 WhatsApp payment reminders sent to 2 parents with direct Paystack links.");
  };

  // Live Calculated Rankings
  const rankedStudents = [...students]
    .map((s) => {
      const total = s.ca1 + s.ca2 + s.exam;
      const average = ((total / 100) * 100).toFixed(1);
      let grade = "F9 (Fail)";
      if (total >= 75) grade = "A1 (Distinction)";
      else if (total >= 70) grade = "B2 (Very Good)";
      else if (total >= 65) grade = "B3 (Good)";
      else if (total >= 60) grade = "C4 (Credit)";
      else if (total >= 50) grade = "C6 (Pass)";

      return { ...s, total, average, grade };
    })
    .sort((a, b) => b.total - a.total);

  // Estimator Calculations (Per Student Model starting at ₦1,000/student)
  const ratePerStudent = estimatorStudents <= 200 ? 1000 : estimatorStudents <= 800 ? 1200 : 1500;
  const estimatedPlatformFee = estimatorStudents * ratePerStudent;
  const calculatedTermTuition = estimatorStudents * avgTuition;
  const hoursSavedPerTerm = Math.round((estimatorStudents / 30) * 4.5);
  
  const recommendedTierInfo =
    estimatorStudents <= 200
      ? {
          tier: "Core Operations Plan",
          cost: `₦${estimatedPlatformFee.toLocaleString()} / term`,
          setup: "₦30,000 one-time setup",
          desc: "Admin, teacher workspaces, academic records & broadsheets.",
        }
      : estimatorStudents <= 800
      ? {
          tier: "Standard Growth Plan",
          cost: `₦${estimatedPlatformFee.toLocaleString()} / term`,
          setup: "₦50,000 onboarding & data setup",
          desc: "Full family portal, Paystack fee collection & branded site starter.",
        }
      : {
          tier: "Enterprise Managed Plan",
          cost: `₦${estimatedPlatformFee.toLocaleString()} / term`,
          setup: "Custom managed rollout",
          desc: "Multi-campus, bank reconciliation automation & priority SLA.",
        };

  return (
    <div className="relative w-full bg-[#FAF9F5] text-stone-900 font-sans selection:bg-amber-500/20 selection:text-stone-950 min-h-screen overflow-x-hidden">
      {/* High-DPI Architectural Canvas Background */}
      <ArchitecturalDraftingCanvas />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-stone-800 bg-stone-950 px-4 sm:px-5 py-2.5 sm:py-3 text-xs font-medium text-white shadow-2xl flex items-center gap-2.5 backdrop-blur-xl max-w-[90vw] text-center"
          >
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Official Report Card Modal */}
      <InteractiveReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        studentName={selectedStudentForReport}
        classNameTitle={selectedClassArm}
        termAverage={
          rankedStudents.find((s) => s.name === selectedStudentForReport)?.average + "%"
        }
        position="1st of 42"
      />

      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION (INTERACTIVE MAGNETIC HEADING & METRICS)
      ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 sm:pt-44 pb-16 sm:pb-24 px-4 sm:px-8 max-w-6xl mx-auto text-center z-10">
        <div className="space-y-5 sm:space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-1 text-[11px] sm:text-xs font-mono font-medium text-stone-700 shadow-sm"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>THE UNIFIED OPERATING SYSTEM FOR NIGERIAN SCHOOLS</span>
          </motion.div>

          {/* Interactive Masked Baseline Reveal + Magnetic Hover Heading */}
          <div className="max-w-5xl mx-auto pt-1 sm:pt-2">
            <KineticMagneticHeading />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl mx-auto text-sm sm:text-lg text-stone-600 font-light leading-relaxed pt-2 px-2"
          >
            Melo connects your academic records, broadsheets, Paystack fee collections, and parent
            report cards into one synchronized platform. Stop compiling results in Excel at 4:47 PM.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full px-2"
          >
            <GoldButton
              href="/contact"
              size="lg"
              className="w-full sm:w-auto hover:scale-[1.02] active:scale-[0.99] transition-transform justify-center"
            >
              Book a 15-minute demo
            </GoldButton>
            <a
              href="#interactive-demo"
              onClick={() => playTick("soft")}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-7 py-3.5 text-sm font-medium text-stone-800 hover:border-stone-400 hover:bg-stone-50 transition-all shadow-sm cursor-pointer active:translate-y-0.5"
            >
              <span>Test Live Demo Below</span>
              <ArrowRight className="h-4 w-4 text-stone-400" />
            </a>
          </motion.div>
        </div>

        {/* 3 Core Metric Badges with Mouse Tilt */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 text-left">
          <Card3DTilt maxTilt={5}>
            <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm h-full flex flex-col justify-between">
              <div className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-amber-700 font-semibold flex items-center justify-between">
                <span>Result Week Speed</span>
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-2">
                3 Days → 0.4s
              </div>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                Teachers enter marks once. Broadsheets, cumulative averages, and class positions calculate instantly.
              </p>
            </div>
          </Card3DTilt>

          <Card3DTilt maxTilt={5}>
            <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm h-full flex flex-col justify-between">
              <div className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-emerald-700 font-semibold flex items-center justify-between">
                <span>Bursary Reconciliation</span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-2">
                ₦0 Unmatched Gap
              </div>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                Every Paystack transaction and bank transfer reconciles directly against student invoices.
              </p>
            </div>
          </Card3DTilt>

          <Card3DTilt maxTilt={5}>
            <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-sm h-full flex flex-col justify-between">
              <div className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-sky-700 font-semibold flex items-center justify-between">
                <span>Parent Visibility</span>
                <Smartphone className="h-3.5 w-3.5 text-sky-600" />
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-2">
                100% Direct Portal
              </div>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                Parents securely view published report cards and clear fee arrears from any mobile browser.
              </p>
            </div>
          </Card3DTilt>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. PINNED SCROLLYTELLING RUNWAY: FRACTURE → COHERENCE
      ───────────────────────────────────────────────────────────── */}
      <section className="relative w-full bg-[#FAF9F5]">
        <GsapPinnedScrollyLens />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          DECK OF CARDS CONTAINER (GSAP SCROLLTRIGGER 3D STACKING)
      ───────────────────────────────────────────────────────────── */}
      <div ref={deckRef} className="relative w-full space-y-12 sm:space-y-16 py-8 sm:py-12">
        {/* ─────────────────────────────────────────────────────────────
            CARD 1: LIVE INTERACTIVE MELO PLATFORM STUDIO
        ───────────────────────────────────────────────────────────── */}
        <section
          id="interactive-demo"
          className="deck-stack-card will-change-transform max-w-6xl mx-auto px-4 sm:px-8"
        >
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8 px-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-mono font-semibold text-amber-900 mb-2.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>Interactive Operational Studio</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl md:text-5xl font-bold text-stone-900 tracking-tight">
              See how the platform actually works.
            </h2>
            <p className="mt-1.5 text-stone-600 text-xs sm:text-base font-light">
              Test real operational workflows right here in your browser:
            </p>
          </div>

          {/* Real-time Telemetry Live Ticker */}
          <div className="max-w-2xl mx-auto mb-5 sm:mb-6 flex justify-center px-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/95 px-3.5 py-1.5 text-[11px] sm:text-xs font-mono text-stone-600 shadow-sm max-w-full truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span className="text-[10px] text-stone-400 font-medium uppercase shrink-0 hidden sm:inline">Live Feed:</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={telemetryIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="font-medium text-stone-800 truncate"
                >
                  {LIVE_TELEMETRY_EVENTS[telemetryIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* Architectural Segmented Tab Bar with LayoutId Indicator */}
          <div className="flex justify-center mb-6 px-2 overflow-x-auto">
            <div className="inline-flex p-1 sm:p-1.5 rounded-2xl bg-stone-200/80 border border-stone-300 gap-1 shadow-inner max-w-full">
              <button
                onClick={() => {
                  setActiveTab("broadsheet");
                  playTick("click");
                }}
                className={`relative px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0 ${
                  activeTab === "broadsheet" ? "text-stone-950 font-semibold" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {activeTab === "broadsheet" && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-white rounded-xl shadow-sm border border-stone-300/80"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
                  <span>1. Broadsheet</span>
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("bursary");
                  playTick("click");
                }}
                className={`relative px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0 ${
                  activeTab === "bursary" ? "text-stone-950 font-semibold" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {activeTab === "bursary" && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-white rounded-xl shadow-sm border border-stone-300/80"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                  <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                  <span>2. Bursary</span>
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("portal");
                  playTick("click");
                }}
                className={`relative px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0 ${
                  activeTab === "portal" ? "text-stone-950 font-semibold" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {activeTab === "portal" && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-white rounded-xl shadow-sm border border-stone-300/80"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5 sm:gap-2">
                  <Smartphone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600" />
                  <span>3. Portal</span>
                </span>
              </button>
            </div>
          </div>

          {/* Master Workspace Card with 3D Mouse Parallax */}
          <Card3DTilt maxTilt={3} glow={true}>
            <div className="rounded-3xl border border-stone-300 bg-white p-4 sm:p-8 shadow-2xl relative overflow-hidden">
              {/* Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4 mb-5 sm:mb-6">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-mono font-bold text-stone-800 truncate">
                    Demo Academy • Session 2025/2026 Term 2
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedClassArm}
                    onChange={(e) => {
                      setSelectedClassArm(e.target.value);
                      playTick("soft");
                      showToast(`Switched view to ${e.target.value}`);
                    }}
                    className="rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-700 cursor-pointer focus:outline-none focus:border-amber-500"
                  >
                    <option value="JSS 2 Silver">JSS 2 Silver (42 Students)</option>
                    <option value="SSS 1 Science">SSS 1 Science (38 Students)</option>
                    <option value="Primary 5 Diamond">Primary 5 Diamond (29 Students)</option>
                  </select>

                  <button
                    onClick={() => {
                      playTick("chime");
                      setSelectedStudentForReport(rankedStudents[0].name);
                      setReportModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:translate-y-0.5 text-stone-950 font-bold px-3 py-1.5 text-xs transition-all cursor-pointer shadow-sm border border-amber-600/30"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Report Slip</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: LIVE EDITABLE BROADSHEET WITH SMOOTH ROW RE-ORDERING */}
              {activeTab === "broadsheet" && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-2.5 sm:p-3 text-xs text-amber-900 flex items-center justify-between">
                    <span>
                      💡 <strong>Try editing:</strong> Edit any mark below. The row will smoothly re-rank live!
                    </span>
                    <span className="font-mono text-emerald-800 font-bold hidden md:inline">
                      WAEC 9-Point Active
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-stone-200 -mx-1 sm:mx-0">
                    <table className="w-full text-left text-xs font-mono min-w-[620px]">
                      <thead className="bg-stone-100 text-stone-700 border-b border-stone-200">
                        <tr>
                          <th className="p-3">Rank</th>
                          <th className="p-3">Student</th>
                          <th className="p-3">CA1 (20)</th>
                          <th className="p-3">CA2 (20)</th>
                          <th className="p-3">Exam (60)</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Average</th>
                          <th className="p-3">Grade</th>
                          <th className="p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-stone-800">
                        {rankedStudents.map((student, idx) => (
                          <motion.tr
                            key={student.id}
                            layout
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            className={`hover:bg-amber-50/30 transition-colors ${
                              idx === 0 ? "bg-amber-50/20 font-medium" : ""
                            }`}
                          >
                            <td className="p-3 font-bold text-amber-700">
                              {idx === 0 ? "1st" : idx === 1 ? "2nd" : idx === 2 ? "3rd" : `${idx + 1}th`}
                            </td>
                            <td className="p-3 font-sans font-semibold text-stone-900 whitespace-nowrap">
                              {student.name}
                              {idx === 0 && (
                                <span className="ml-1.5 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-mono">
                                  Top
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                value={student.ca1}
                                onChange={(e) =>
                                  handleScoreChange(student.id, "ca1", parseInt(e.target.value))
                                }
                                className="w-12 rounded border border-stone-300 px-1.5 py-1 text-center font-mono text-xs focus:border-amber-500 focus:outline-none bg-stone-50"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                value={student.ca2}
                                onChange={(e) =>
                                  handleScoreChange(student.id, "ca2", parseInt(e.target.value))
                                }
                                className="w-12 rounded border border-stone-300 px-1.5 py-1 text-center font-mono text-xs focus:border-amber-500 focus:outline-none bg-stone-50"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                max="60"
                                value={student.exam}
                                onChange={(e) =>
                                  handleScoreChange(student.id, "exam", parseInt(e.target.value))
                                }
                                className="w-14 rounded border border-stone-300 px-1.5 py-1 text-center font-mono text-xs focus:border-amber-500 focus:outline-none bg-stone-50"
                              />
                            </td>
                            <td className="p-3 font-bold text-stone-900">{student.total}/100</td>
                            <td className="p-3 font-bold text-emerald-700">{student.average}%</td>
                            <td className="p-3 font-sans text-stone-700">{student.grade}</td>
                            <td className="p-3">
                              <button
                                onClick={() => {
                                  playTick("chime");
                                  setSelectedStudentForReport(student.name);
                                  setReportModalOpen(true);
                                }}
                                className="text-amber-700 hover:text-amber-900 font-sans font-medium text-xs underline cursor-pointer"
                              >
                                View
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: BURSARY & DEBT TRACKER */}
              {activeTab === "bursary" && (
                <div className="space-y-5 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <span className="text-xs text-stone-500 font-mono">Term Invoiced</span>
                      <div className="font-serif text-2xl font-bold text-stone-900 mt-1">
                        ₦14,250,000
                      </div>
                      <div className="text-[11px] text-stone-400">482 Total Students</div>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <span className="text-xs text-emerald-700 font-mono">Paystack Realized</span>
                      <div className="font-serif text-2xl font-bold text-emerald-900 mt-1">
                        ₦11,850,000
                      </div>
                      <div className="text-[11px] text-emerald-600">83.1% Collected</div>
                    </div>

                    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
                      <span className="text-xs text-rose-700 font-mono">Outstanding Debts</span>
                      <div className="font-serif text-2xl font-bold text-rose-900 mt-1">
                        ₦2,400,000
                      </div>
                      <div className="text-[11px] text-rose-600">38 Families Pending</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-stone-50 border-b border-stone-200 gap-2">
                      <span className="text-xs font-mono font-bold text-stone-800">
                        Live Fee Status & Reconciliation
                      </span>
                      <button
                        onClick={handleSendWhatsApp}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 text-xs transition-colors cursor-pointer shadow-sm w-full sm:w-auto"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>1-Click WhatsApp Reminders</span>
                      </button>
                    </div>

                    <div className="divide-y divide-stone-100 text-xs font-mono">
                      {students.map((student) => (
                        <div
                          key={student.id}
                          className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50 transition-colors"
                        >
                          <div>
                            <span className="font-sans font-bold text-stone-900 text-sm">
                              {student.name} ({selectedClassArm})
                            </span>
                            <div className="text-[11px] text-stone-500">
                              Tuition + Uniforms (₦185,000)
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {student.feeStatus === "cleared" ? (
                              <span className="flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 text-xs font-bold">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Cleared (₦0)</span>
                              </span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 px-2.5 py-1 text-xs font-bold">
                                  Arrears: ₦{student.arrearsAmount.toLocaleString()}
                                </span>
                                <button
                                  onClick={() => handlePaystackPayment(student.id)}
                                  className="flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-2.5 py-1 text-xs cursor-pointer shadow-sm border border-amber-600/30"
                                >
                                  <Receipt className="h-3 w-3" />
                                  <span>Paystack Settle</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PARENT MOBILE PORTAL WITH 3D PERSPECTIVE */}
              {activeTab === "portal" && (
                <div className="flex justify-center py-2 sm:py-4">
                  <div className="w-full max-w-sm rounded-[2rem] sm:rounded-[2.5rem] border-4 border-stone-800 bg-stone-950 p-3.5 sm:p-4 shadow-2xl text-white">
                    <div className="mx-auto h-3 w-16 sm:w-20 rounded-full bg-stone-800 mb-3 sm:mb-4" />

                    <div className="rounded-2xl bg-stone-900 p-4 sm:p-5 space-y-3.5 sm:space-y-4 text-xs font-sans">
                      <div className="flex items-center justify-between border-b border-stone-800 pb-2.5 sm:pb-3">
                        <div>
                          <div className="text-[10px] font-mono text-amber-400 uppercase">
                            Parent Portal
                          </div>
                          <div className="font-serif text-base sm:text-lg font-bold text-white">
                            Sarah Okon
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                          JSS 2 Silver
                        </span>
                      </div>

                      <div className="rounded-xl bg-stone-800/80 p-3.5 sm:p-4 space-y-2 border border-stone-700/60 text-left">
                        <div className="text-xs font-bold text-amber-300 flex justify-between">
                          <span>Term 2 Report Card</span>
                          <span className="font-mono text-emerald-400">92.6% (1st)</span>
                        </div>
                        <p className="text-[11px] text-stone-300 font-light">
                          Remark: "Exceptional diligence and leadership."
                        </p>
                        <button
                          onClick={() => {
                            playTick("chime");
                            setSelectedStudentForReport("Sarah Okon");
                            setReportModalOpen(true);
                          }}
                          className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 text-stone-950 font-bold py-2 text-xs hover:bg-amber-400 transition-colors cursor-pointer shadow-sm"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>View Official Report Card</span>
                        </button>
                      </div>

                      <div className="rounded-xl bg-stone-800/80 p-3.5 sm:p-4 space-y-2 border border-stone-700/60 text-left">
                        <div className="text-xs font-bold text-stone-200 flex justify-between">
                          <span>Bursary Account</span>
                          <span className="font-mono text-rose-400">₦85,000 Due</span>
                        </div>
                        <button
                          onClick={() => handlePaystackPayment("1")}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white font-bold py-2 text-xs hover:bg-emerald-500 transition-colors cursor-pointer shadow-sm"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>Pay ₦85,000 via Paystack</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card3DTilt>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            CARD 2: PER-STUDENT COMMERCIAL IMPACT ESTIMATOR
        ───────────────────────────────────────────────────────────── */}
        <section className="deck-stack-card will-change-transform max-w-6xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 px-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-1 text-xs font-mono font-medium text-stone-700 mb-2.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
              <span>Per-Student Commercial Impact Estimator</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl md:text-5xl font-bold text-stone-900 tracking-tight">
              Transparent per-student pricing.
            </h2>
            <p className="mt-1.5 text-stone-600 text-xs sm:text-base font-light">
              Slide to your total enrolled student population to preview platform subscription at ₦1,000–₦1,500 / student:
            </p>
          </div>

          <Card3DTilt maxTilt={3} glow={true} className="max-w-4xl mx-auto">
            <div className="rounded-3xl border border-stone-300 bg-white p-5 sm:p-10 shadow-xl">
              {/* Slider Control */}
              <div className="space-y-4 mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                  <label htmlFor="student-slider" className="text-[11px] sm:text-xs font-mono uppercase tracking-widest text-stone-500 font-semibold">
                    Enrolled Student Count:
                  </label>
                  <div className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
                    {estimatorStudents.toLocaleString()}{" "}
                    <span className="text-xs sm:text-sm font-sans font-normal text-stone-500">Students</span>
                  </div>
                </div>

                <input
                  id="student-slider"
                  type="range"
                  min="50"
                  max="1500"
                  step="25"
                  value={estimatorStudents}
                  onChange={(e) => {
                    setEstimatorStudents(parseInt(e.target.value));
                    playTick("soft");
                  }}
                  className="w-full h-2.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />

                <div className="flex justify-between text-[10px] sm:text-[11px] font-mono text-stone-400">
                  <span>50 (₦1,000/st)</span>
                  <span>500 (₦1,200/st)</span>
                  <span>1,000+ (₦1,500/st)</span>
                </div>
              </div>

              {/* Dynamic Calculated Non-Redundant Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-5 sm:pt-6 border-t border-stone-100">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-stone-500 block">
                      Term Platform Investment
                    </span>
                    <div className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                      {recommendedTierInfo.cost}
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-stone-500 font-mono mt-2">
                    @ ₦{ratePerStudent.toLocaleString()}/student/term
                  </span>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-amber-800 block">
                      Term Tuition Run-Rate
                    </span>
                    <div className="font-serif text-2xl sm:text-3xl font-bold text-amber-900 mt-1">
                      ₦{(calculatedTermTuition / 1000000).toFixed(1)}M
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-emerald-700 font-medium mt-2">
                    100% reconciled • ~{hoursSavedPerTerm}h admin saved
                  </span>
                </div>

                <div className="rounded-2xl border border-stone-800 bg-stone-900 text-white p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-amber-400 block">
                      Recommended: {recommendedTierInfo.tier}
                    </span>
                    <p className="text-xs text-stone-300 font-light mt-1 leading-relaxed">
                      {recommendedTierInfo.desc}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-stone-800 mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-stone-400 font-mono">
                      {recommendedTierInfo.setup}
                    </span>
                    <Link
                      href="/pricing"
                      onClick={() => playTick("click")}
                      className="text-[11px] text-amber-400 font-semibold underline hover:text-amber-300"
                    >
                      Details →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Card3DTilt>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            CARD 3: TRANSPARENT PRICING & FINAL CALL TO ACTION
        ───────────────────────────────────────────────────────────── */}
        <section className="deck-stack-card will-change-transform max-w-6xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 px-2">
            <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl font-normal text-stone-900 tracking-tight">
              Transparent pricing for Nigerian schools.
            </h2>
            <p className="mt-2 text-stone-600 text-xs sm:text-base font-light">
              Simple per-student pricing starting at ₦1,000 per term. No hidden software lock-ins.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 mb-12 sm:mb-16">
            {pricingTiers.map((tier) => (
              <Card3DTilt key={tier.name} maxTilt={4} className="h-full">
                <div
                  className={`rounded-3xl p-6 sm:p-8 border flex flex-col justify-between h-full transition-all duration-200 ${
                    tier.highlighted
                      ? "border-stone-900 bg-stone-900 text-white shadow-2xl relative"
                      : "border-stone-200 bg-white text-stone-900 shadow-sm"
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3.5 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-950">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <div
                      className={`text-xs font-mono uppercase tracking-widest ${
                        tier.highlighted ? "text-amber-400" : "text-stone-500"
                      }`}
                    >
                      {tier.name}
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold">
                        {tier.price}
                      </span>
                      <span
                        className={`text-xs font-mono ${
                          tier.highlighted ? "text-stone-400" : "text-stone-500"
                        }`}
                      >
                        {tier.period}
                      </span>
                    </div>
                    <div
                      className={`text-xs font-mono mt-1 ${
                        tier.highlighted ? "text-stone-400" : "text-stone-500"
                      }`}
                    >
                      {tier.setupFee}
                    </div>

                    <p
                      className={`mt-3 text-xs sm:text-sm font-light leading-relaxed ${
                        tier.highlighted ? "text-stone-300" : "text-stone-600"
                      }`}
                    >
                      {tier.description}
                    </p>

                    <div
                      className={`my-5 sm:my-6 h-px w-full ${
                        tier.highlighted ? "bg-stone-800" : "bg-stone-100"
                      }`}
                    />

                    <ul className="space-y-2.5 sm:space-y-3 text-xs font-light">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5">
                          <Check
                            className={`h-4 w-4 shrink-0 ${
                              tier.highlighted ? "text-amber-400" : "text-emerald-600"
                            }`}
                          />
                          <span className={tier.highlighted ? "text-stone-200" : "text-stone-700"}>
                            {f}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 sm:mt-8 pt-4">
                    <Link
                      href="/contact"
                      onClick={() => playTick("click")}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        tier.highlighted
                          ? "bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-md"
                          : "bg-stone-900 text-white hover:bg-stone-800"
                      }`}
                    >
                      <span>{tier.cta}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </Card3DTilt>
            ))}
          </div>

          {/* Optional Add-Ons Bar */}
          <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5 sm:p-8 mb-12 sm:mb-16">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-4 w-4 text-amber-600" />
              <h3 className="font-serif text-lg sm:text-xl font-bold text-stone-900">
                Optional Commercial Add-Ons
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
              {platformAddOns.map((addon) => (
                <div
                  key={addon.name}
                  className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm"
                >
                  <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                    {addon.tag}
                  </span>
                  <h4 className="font-sans font-bold text-stone-900 text-sm mt-2">
                    {addon.name}
                  </h4>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    {addon.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Final CTA Box */}
          <div className="rounded-3xl border border-stone-800 bg-stone-950 text-white p-6 sm:p-12 text-center relative overflow-hidden shadow-2xl">
            <h3 className="font-serif text-2xl sm:text-4xl font-bold mb-3 sm:mb-4">
              Ready to run your school with clarity?
            </h3>
            <p className="text-stone-400 text-xs sm:text-base max-w-xl mx-auto font-light leading-relaxed mb-6 sm:mb-8">
              Book a 15-minute live platform walkthrough. We will set up your session, class arms,
              and broadsheet rules live with your real curriculum structure.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <GoldButton href="/contact" size="lg" className="w-full sm:w-auto justify-center">
                Book a 15-minute demo
              </GoldButton>
              <Link
                href="/features"
                onClick={() => playTick("click")}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-stone-700 bg-stone-900 px-7 py-3.5 text-sm font-medium text-stone-300 hover:bg-stone-800 hover:text-white transition-colors cursor-pointer"
              >
                <span>Explore All Features</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
