"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  MessageCircle,
  Phone,
  Printer,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { pricingTiers } from "@/site";
import { GoldButton } from "@/site-ui";
import { ArchitecturalDraftingCanvas } from "./architectural-drafting-canvas";
import { FractureCoherenceLens } from "./fracture-coherence-lens";
import { InteractiveReportModal } from "./interactive-report-modal";

export function MeloCinemaExperience() {
  const [activeTab, setActiveTab] = useState<"broadsheet" | "bursary" | "portal">("broadsheet");
  const [selectedClassArm, setSelectedClassArm] = useState("JSS 2 Silver");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState("Sarah Okon");

  // Editable Student Scores State with Live Dynamic Re-ordering
  const [students, setStudents] = useState([
    {
      id: "1",
      name: "Sarah Okon",
      ca1: 19,
      ca2: 18,
      exam: 56,
      feeStatus: "arrears",
      arrearsAmount: 85000,
    },
    {
      id: "2",
      name: "Amina Bello",
      ca1: 18,
      ca2: 19,
      exam: 53,
      feeStatus: "cleared",
      arrearsAmount: 0,
    },
    {
      id: "3",
      name: "David Adeleke",
      ca1: 16,
      ca2: 17,
      exam: 51,
      feeStatus: "cleared",
      arrearsAmount: 0,
    },
    {
      id: "4",
      name: "Chukwudi Eze",
      ca1: 15,
      ca2: 15,
      exam: 48,
      feeStatus: "arrears",
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
    const maxVal = field === "exam" ? 60 : 20;
    const clamped = Math.max(0, Math.min(maxVal, isNaN(value) ? 0 : value));
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: clamped } : s))
    );
  };

  // Paystack Live Settle Simulation
  const handlePaystackPayment = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, feeStatus: "cleared", arrearsAmount: 0 } : s
      )
    );
    showToast("⚡ Paystack Payment Confirmed! ₦85,000 reconciled & receipt generated.");
  };

  // WhatsApp Reminder Dispatch
  const handleSendWhatsApp = () => {
    showToast("📱 WhatsApp payment reminders sent to 2 parents with direct Paystack links.");
  };

  // Live Calculated Rankings (Calculated dynamically)
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

  return (
    <div className="relative w-full bg-[#FAF9F5] text-stone-900 font-sans selection:bg-amber-500/20 selection:text-stone-950 min-h-screen">
      {/* Subtle Architectural Drafting Grid Background */}
      <ArchitecturalDraftingCanvas />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-stone-800 bg-stone-950 px-5 py-3 text-xs font-medium text-white shadow-2xl flex items-center gap-2.5 backdrop-blur-xl"
          >
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
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
          1. HERO SECTION (EDITORIAL CLARITY & KINETIC TYPOGRAPHY)
      ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-36 sm:pt-44 pb-20 sm:pb-28 px-5 sm:px-8 max-w-6xl mx-auto text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-mono font-medium text-stone-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>THE UNIFIED OPERATING SYSTEM FOR NIGERIAN SCHOOLS</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl text-stone-900 font-normal leading-[1.03] tracking-tight max-w-5xl mx-auto">
            A school is one institution.
            <br />
            <span className="italic font-light text-stone-500">
              Its information should behave like one system.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-stone-600 font-light leading-relaxed">
            Melo connects your academic records, broadsheets, Paystack fee collections, and parent
            report cards into one synchronized platform. Stop compiling results in Excel at 4:47 PM.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <GoldButton href="/contact" size="lg">
              Book a 15-minute demo
            </GoldButton>
            <a
              href="#interactive-demo"
              className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-7 py-3.5 text-sm font-medium text-stone-800 hover:border-stone-400 hover:bg-stone-50 transition-all shadow-sm cursor-pointer active:translate-y-0.5"
            >
              <span>Test Live Demo Below</span>
              <ArrowRight className="h-4 w-4 text-stone-400" />
            </a>
          </div>
        </motion.div>

        {/* 3 Core Metric Badges with Architectural Framing */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-mono uppercase tracking-widest text-amber-700 font-semibold">
              Result Week Speed
            </div>
            <div className="font-serif text-3xl font-bold text-stone-900 mt-1">
              3 Days → 0.4s
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Teachers enter marks once. Broadsheets and class positions calculate instantly.
            </p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-mono uppercase tracking-widest text-emerald-700 font-semibold">
              Bursary Reconciliation
            </div>
            <div className="font-serif text-3xl font-bold text-stone-900 mt-1">
              ₦0 Gap
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Every Paystack payment and bank transfer reconciles directly with student invoices.
            </p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-mono uppercase tracking-widest text-sky-700 font-semibold">
              Parent Visibility
            </div>
            <div className="font-serif text-3xl font-bold text-stone-900 mt-1">
              100% Direct
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Parents view published report cards and pay fee balances without front-desk calls.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. THE SIGNATURE INTERACTIVE LENS: FRACTURE → COHERENCE
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 sm:px-8 max-w-6xl mx-auto border-t border-stone-200/80 z-10 relative">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <h2 className="font-serif text-3xl sm:text-5xl font-normal text-stone-900 tracking-tight">
            The transformation in one drag.
          </h2>
          <p className="mt-2 text-stone-600 text-sm sm:text-base font-light">
            Slide between the disconnected status quo and the synchronized Melo reality:
          </p>
        </div>

        <FractureCoherenceLens />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. LIVE INTERACTIVE MELO PLATFORM STUDIO
      ───────────────────────────────────────────────────────────── */}
      <section
        id="interactive-demo"
        className="py-20 px-5 sm:px-8 max-w-6xl mx-auto border-t border-stone-200/80 z-10 relative"
      >
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-mono font-semibold text-amber-900 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Interactive Operational Studio</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
            See how the platform actually works.
          </h2>
          <p className="mt-2 text-stone-600 text-sm sm:text-base font-light">
            Test real operational workflows right here in your browser:
          </p>
        </div>

        {/* Architectural Segmented Tab Bar with LayoutId Indicator */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex p-1.5 rounded-xl bg-stone-200/80 border border-stone-300 gap-1">
            <button
              onClick={() => setActiveTab("broadsheet")}
              className={`relative px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "broadsheet" ? "text-stone-950 font-semibold" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {activeTab === "broadsheet" && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-white rounded-lg shadow-sm border border-stone-300/80"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-amber-600" />
                <span>1. Broadsheet & Results</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab("bursary")}
              className={`relative px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "bursary" ? "text-stone-950 font-semibold" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {activeTab === "bursary" && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-white rounded-lg shadow-sm border border-stone-300/80"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Coins className="h-4 w-4 text-emerald-600" />
                <span>2. Bursary & Debt Tracker</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab("portal")}
              className={`relative px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "portal" ? "text-stone-950 font-semibold" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {activeTab === "portal" && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-white rounded-lg shadow-sm border border-stone-300/80"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-sky-600" />
                <span>3. Parent Portal</span>
              </span>
            </button>
          </div>
        </div>

        {/* Master Workspace Card */}
        <div className="rounded-2xl border border-stone-300 bg-white p-4 sm:p-8 shadow-xl">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-mono font-bold text-stone-800">
                Demo Academy Command • Session 2025/2026 Term 2
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedClassArm}
                onChange={(e) => {
                  setSelectedClassArm(e.target.value);
                  showToast(`Switched view to ${e.target.value}`);
                }}
                className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 cursor-pointer"
              >
                <option value="JSS 2 Silver">JSS 2 Silver (42 Students)</option>
                <option value="SSS 1 Science">SSS 1 Science (38 Students)</option>
                <option value="Primary 5 Diamond">Primary 5 Diamond (29 Students)</option>
              </select>

              <button
                onClick={() => {
                  setSelectedStudentForReport(rankedStudents[0].name);
                  setReportModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:translate-y-0.5 text-stone-950 font-bold px-3.5 py-1.5 text-xs transition-all cursor-pointer shadow-sm border border-amber-600/30"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Batch Report Cards</span>
              </button>
            </div>
          </div>

          {/* TAB 1: LIVE EDITABLE BROADSHEET WITH SMOOTH ROW RE-ORDERING */}
          {activeTab === "broadsheet" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 text-xs text-amber-900 flex items-center justify-between">
                <span>
                  💡 <strong>Try editing:</strong> Change any CA1, CA2, or Exam mark below. Watch the row
                  smoothly animate and re-rank itself in real time!
                </span>
                <span className="font-mono text-emerald-800 font-bold">
                  WAEC 9-Point Active
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-stone-100 text-stone-700 border-b border-stone-200">
                    <tr>
                      <th className="p-3.5">Rank</th>
                      <th className="p-3.5">Student</th>
                      <th className="p-3.5">CA1 (20)</th>
                      <th className="p-3.5">CA2 (20)</th>
                      <th className="p-3.5">Exam (60)</th>
                      <th className="p-3.5">Total (100)</th>
                      <th className="p-3.5">Average</th>
                      <th className="p-3.5">Grade</th>
                      <th className="p-3.5">Action</th>
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
                        <td className="p-3.5 font-bold text-amber-700">
                          {idx === 0 ? "1st" : idx === 1 ? "2nd" : idx === 2 ? "3rd" : `${idx + 1}th`}
                        </td>
                        <td className="p-3.5 font-sans font-semibold text-stone-900">
                          {student.name}
                          {idx === 0 && (
                            <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                              Top of Class
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={student.ca1}
                            onChange={(e) =>
                              handleScoreChange(student.id, "ca1", parseInt(e.target.value))
                            }
                            className="w-12 rounded border border-stone-300 px-2 py-1 text-center font-mono text-xs focus:border-amber-500 focus:outline-none bg-stone-50"
                          />
                        </td>
                        <td className="p-3.5">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={student.ca2}
                            onChange={(e) =>
                              handleScoreChange(student.id, "ca2", parseInt(e.target.value))
                            }
                            className="w-12 rounded border border-stone-300 px-2 py-1 text-center font-mono text-xs focus:border-amber-500 focus:outline-none bg-stone-50"
                          />
                        </td>
                        <td className="p-3.5">
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={student.exam}
                            onChange={(e) =>
                              handleScoreChange(student.id, "exam", parseInt(e.target.value))
                            }
                            className="w-14 rounded border border-stone-300 px-2 py-1 text-center font-mono text-xs focus:border-amber-500 focus:outline-none bg-stone-50"
                          />
                        </td>
                        <td className="p-3.5 font-bold text-stone-900">{student.total}/100</td>
                        <td className="p-3.5 font-bold text-emerald-700">{student.average}%</td>
                        <td className="p-3.5 font-sans text-stone-700">{student.grade}</td>
                        <td className="p-3.5">
                          <button
                            onClick={() => {
                              setSelectedStudentForReport(student.name);
                              setReportModalOpen(true);
                            }}
                            className="text-amber-700 hover:text-amber-900 font-sans font-medium text-xs underline cursor-pointer"
                          >
                            View Slip
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
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <span className="text-xs text-stone-500 font-mono">Term Invoiced</span>
                  <div className="font-serif text-2xl font-bold text-stone-900 mt-1">
                    ₦14,250,000
                  </div>
                  <div className="text-[11px] text-stone-400">482 Total Students</div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <span className="text-xs text-emerald-700 font-mono">Paystack Realized</span>
                  <div className="font-serif text-2xl font-bold text-emerald-900 mt-1">
                    ₦11,850,000
                  </div>
                  <div className="text-[11px] text-emerald-600">83.1% Collected</div>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
                  <span className="text-xs text-rose-700 font-mono">Outstanding Debts</span>
                  <div className="font-serif text-2xl font-bold text-rose-900 mt-1">
                    ₦2,400,000
                  </div>
                  <div className="text-[11px] text-rose-600">38 Families Pending</div>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-stone-50 border-b border-stone-200">
                  <span className="text-xs font-mono font-bold text-stone-800">
                    Live Fee Status & Reconciliation
                  </span>
                  <button
                    onClick={handleSendWhatsApp}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>1-Click WhatsApp Reminders</span>
                  </button>
                </div>

                <div className="divide-y divide-stone-100 text-xs font-mono">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50 transition-colors"
                    >
                      <div>
                        <span className="font-sans font-bold text-stone-900 text-sm">
                          {student.name} ({selectedClassArm})
                        </span>
                        <div className="text-[11px] text-stone-500">
                          Fee Structure: Tuition + Uniforms (₦185,000)
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {student.feeStatus === "cleared" ? (
                          <span className="flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 text-xs font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Cleared (₦0 Arrears)</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1 text-xs font-bold">
                              Arrears: ₦{student.arrearsAmount.toLocaleString()}
                            </span>
                            <button
                              onClick={() => handlePaystackPayment(student.id)}
                              className="flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-3 py-1 text-xs cursor-pointer shadow-sm border border-amber-600/30"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>Simulate Paystack Settle</span>
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
            <div className="flex justify-center py-4 perspective-1000">
              <div className="w-full max-w-sm rounded-3xl border-4 border-stone-800 bg-stone-950 p-4 shadow-2xl text-white">
                <div className="mx-auto h-3.5 w-20 rounded-full bg-stone-800 mb-4" />

                <div className="rounded-2xl bg-stone-900 p-5 space-y-4 text-xs font-sans">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                    <div>
                      <div className="text-[10px] font-mono text-amber-400 uppercase">
                        Parent Portal
                      </div>
                      <div className="font-serif text-lg font-bold text-white">
                        Sarah Okon
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                      JSS 2 Silver
                    </span>
                  </div>

                  <div className="rounded-xl bg-stone-800/80 p-4 space-y-2 border border-stone-700/60 text-left">
                    <div className="text-xs font-bold text-amber-300 flex justify-between">
                      <span>Term 2 Report Card</span>
                      <span className="font-mono text-emerald-400">92.6% (1st)</span>
                    </div>
                    <p className="text-[11px] text-stone-300 font-light">
                      Principal Remark: "Exceptional diligence and leadership."
                    </p>
                    <button
                      onClick={() => {
                        setSelectedStudentForReport("Sarah Okon");
                        setReportModalOpen(true);
                      }}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 text-stone-950 font-bold py-2 text-xs hover:bg-amber-400 transition-colors cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>View Official Report Card</span>
                    </button>
                  </div>

                  <div className="rounded-xl bg-stone-800/80 p-4 space-y-2 border border-stone-700/60 text-left">
                    <div className="text-xs font-bold text-stone-200 flex justify-between">
                      <span>Bursary Account</span>
                      <span className="font-mono text-rose-400">₦85,000 Due</span>
                    </div>
                    <button
                      onClick={() => handlePaystackPayment("1")}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white font-bold py-2 text-xs hover:bg-emerald-500 transition-colors cursor-pointer"
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
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. TRANSPARENT PRICING & FINAL CALL TO ACTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 sm:px-8 max-w-6xl mx-auto border-t border-stone-200/80 z-10 relative">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="font-serif text-4xl sm:text-6xl font-normal text-stone-900 tracking-tight">
            Transparent pricing for Nigerian schools.
          </h2>
          <p className="mt-3 text-stone-600 text-sm sm:text-base font-light">
            No hidden setup fees. Pay term-by-term as your school grows.
          </p>
        </div>

        {/* Pricing Cards with Clean Architectural Geometry */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-8 border flex flex-col justify-between transition-all duration-200 ${
                tier.highlighted
                  ? "border-stone-900 bg-stone-900 text-white shadow-2xl relative scale-105"
                  : "border-stone-200 bg-white text-stone-900 shadow-sm"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-md bg-amber-500 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-stone-950">
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
                  <span className="font-serif text-4xl sm:text-5xl font-bold">
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
                <p
                  className={`mt-3 text-xs sm:text-sm font-light leading-relaxed ${
                    tier.highlighted ? "text-stone-300" : "text-stone-600"
                  }`}
                >
                  {tier.description}
                </p>

                <div
                  className={`my-6 h-px w-full ${
                    tier.highlighted ? "bg-stone-800" : "bg-stone-100"
                  }`}
                />

                <ul className="space-y-3 text-xs font-light">
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

              <div className="mt-8 pt-4">
                <Link
                  href="/contact"
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
          ))}
        </div>

        {/* Final CTA Box */}
        <div className="rounded-2xl border border-stone-800 bg-stone-950 text-white p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <h3 className="font-serif text-3xl sm:text-4xl font-bold mb-4">
            Ready to run your school with clarity?
          </h3>
          <p className="text-stone-400 text-sm sm:text-base max-w-xl mx-auto font-light leading-relaxed mb-8">
            Book a 15-minute live platform walkthrough. We will set up your session, class arms,
            and broadsheet rules live with your real curriculum structure.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <GoldButton href="/contact" size="lg">
              Book a 15-minute demo
            </GoldButton>
            <Link
              href="/features"
              className="flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-900 px-7 py-3.5 text-sm font-medium text-stone-300 hover:bg-stone-800 hover:text-white transition-colors cursor-pointer"
            >
              <span>Explore All Features</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
