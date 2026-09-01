"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  Coins,
  Sparkles,
  Smartphone,
  CheckCircle2,
  Receipt,
  Sliders,
  ShieldCheck,
  Check,
} from "lucide-react";
import { playTick } from "../../lib/audio-feedback";
import { Card3DTilt } from "../ui/card-3d-tilt";

interface StudentScore {
  id: string;
  name: string;
  ca1: number;
  ca2: number;
  exam: number;
  arrears: number;
  feeStatus: "cleared" | "pending";
}

const INITIAL_STUDENTS: StudentScore[] = [
  { id: "1", name: "Sarah Okon", ca1: 19, ca2: 18, exam: 57, arrears: 85000, feeStatus: "pending" },
  { id: "2", name: "Amina Bello", ca1: 18, ca2: 19, exam: 52, arrears: 0, feeStatus: "cleared" },
  { id: "3", name: "Chukwudi Eze", ca1: 16, ca2: 17, exam: 49, arrears: 45000, feeStatus: "pending" },
  { id: "4", name: "David Adeleke", ca1: 15, ca2: 16, exam: 46, arrears: 0, feeStatus: "cleared" },
];

export function InteractiveSystemsMatrix() {
  const [activeTab, setActiveTab] = useState<"broadsheet" | "bursary" | "curriculum" | "portal">("broadsheet");
  const [gradingScale, setGradingScale] = useState<"waec" | "primary">("waec");
  const [students, setStudents] = useState<StudentScore[]>(INITIAL_STUDENTS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // AI Generator state
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedOutput, setAiGeneratedOutput] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleScoreChange = (id: string, field: "ca1" | "ca2" | "exam", val: number) => {
    playTick("soft");
    const maxVal = field === "exam" ? 60 : 20;
    const clamped = Math.max(0, Math.min(maxVal, isNaN(val) ? 0 : val));
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: clamped } : s))
    );
  };

  const handleSimulateSettle = (id: string) => {
    playTick("settle");
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, feeStatus: "cleared", arrears: 0 } : s))
    );
    showToast("⚡ Providus & Paystack Auto-Reconciled! ₦85,000 ledger updated with digital receipt.");
  };

  const handleTriggerAiPlan = () => {
    playTick("chime");
    setIsGeneratingAi(true);
    setAiGeneratedOutput(null);

    setTimeout(() => {
      setIsGeneratingAi(false);
      setAiGeneratedOutput(
        "✅ Lesson Plan & CBT Bank Formulated: 4 Standard Units, 12 Practice Objectives & Auto-Mark Scheme Generated with Curriculum Alignment."
      );
      playTick("settle");
      showToast("✨ AI Lesson Plan & Question Bank drafted and submitted to Principal Review Queue.");
    }, 1200);
  };

  // Rank calculation based on selected grading scale
  const rankedStudents = [...students]
    .map((s) => {
      const total = s.ca1 + s.ca2 + s.exam;
      const average = ((total / 100) * 100).toFixed(1);

      let grade = "F9 (Fail)";
      if (gradingScale === "waec") {
        if (total >= 75) grade = "A1 (Distinction)";
        else if (total >= 70) grade = "B2 (Very Good)";
        else if (total >= 65) grade = "B3 (Good)";
        else if (total >= 60) grade = "C4 (Credit)";
        else if (total >= 50) grade = "C6 (Pass)";
      } else {
        if (total >= 80) grade = "Exceeding Expectations";
        else if (total >= 65) grade = "Meeting Expectations";
        else if (total >= 50) grade = "Approaching Expectations";
        else grade = "Needs Support";
      }

      return { ...s, total, average, grade };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <section className="relative w-full max-w-6xl mx-auto px-4 sm:px-8 py-16">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-stone-800 bg-stone-950 px-5 py-3 text-xs font-medium text-white shadow-2xl flex items-center gap-2.5 backdrop-blur-xl"
          >
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-mono font-semibold text-amber-900 mb-3 shadow-sm">
          <Sliders className="h-3.5 w-3.5 text-amber-600" />
          <span>Interactive Diagnostic Sandbox</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
          Test the platform engine right now.
        </h2>
        <p className="mt-2 text-stone-600 text-xs sm:text-sm font-light">
          Simulate real administrative actions and watch the reactive data pipeline respond in real time:
        </p>
      </div>

      {/* Segmented Control Bar */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex flex-wrap justify-center p-1.5 rounded-2xl bg-stone-200/80 border border-stone-300 gap-1 shadow-inner">
          <button
            onClick={() => {
              setActiveTab("broadsheet");
              playTick("click");
            }}
            className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "broadsheet" ? "text-stone-950 font-semibold" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {activeTab === "broadsheet" && (
              <motion.div
                layoutId="featuresMatrixTab"
                className="absolute inset-0 bg-white rounded-xl shadow-sm border border-stone-300/80"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-amber-600" />
              <span>1. Broadsheet & WAEC Scale</span>
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("bursary");
              playTick("click");
            }}
            className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "bursary" ? "text-stone-950 font-semibold" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {activeTab === "bursary" && (
              <motion.div
                layoutId="featuresMatrixTab"
                className="absolute inset-0 bg-white rounded-xl shadow-sm border border-stone-300/80"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Coins className="h-4 w-4 text-emerald-600" />
              <span>2. Multi-Channel Bursary</span>
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("curriculum");
              playTick("click");
            }}
            className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "curriculum" ? "text-stone-950 font-semibold" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {activeTab === "curriculum" && (
              <motion.div
                layoutId="featuresMatrixTab"
                className="absolute inset-0 bg-white rounded-xl shadow-sm border border-stone-300/80"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span>3. AI Lesson Generator</span>
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("portal");
              playTick("click");
            }}
            className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "portal" ? "text-stone-950 font-semibold" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {activeTab === "portal" && (
              <motion.div
                layoutId="featuresMatrixTab"
                className="absolute inset-0 bg-white rounded-xl shadow-sm border border-stone-300/80"
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-sky-600" />
              <span>4. Direct Parent Portal</span>
            </span>
          </button>
        </div>
      </div>

      {/* Main Sandbox Card with 3D Tilt */}
      <Card3DTilt maxTilt={2.5} glow={true}>
        <div className="rounded-3xl border border-stone-300 bg-white p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* TAB 1: BROADSHEET & WAEC SCALING */}
          {activeTab === "broadsheet" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                <div>
                  <span className="text-xs font-mono font-bold text-stone-800">
                    Class: JSS 2 Silver (Broadsheet Matrix)
                  </span>
                  <div className="text-[11px] text-stone-500">
                    Edit marks below to watch live auto-ranking and grade recalculation in 0.38s:
                  </div>
                </div>

                {/* Scale Switcher */}
                <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl border border-stone-200">
                  <button
                    onClick={() => {
                      setGradingScale("waec");
                      playTick("soft");
                    }}
                    className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${
                      gradingScale === "waec"
                        ? "bg-white font-bold text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    WAEC 9-Point Scale
                  </button>
                  <button
                    onClick={() => {
                      setGradingScale("primary");
                      playTick("soft");
                    }}
                    className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${
                      gradingScale === "primary"
                        ? "bg-white font-bold text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    Universal Primary
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-stone-200">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-stone-100 text-stone-700 border-b border-stone-200">
                    <tr>
                      <th className="p-3.5">Rank</th>
                      <th className="p-3.5">Student Name</th>
                      <th className="p-3.5">CA1 (20)</th>
                      <th className="p-3.5">CA2 (20)</th>
                      <th className="p-3.5">Exam (60)</th>
                      <th className="p-3.5">Total (100)</th>
                      <th className="p-3.5">Average</th>
                      <th className="p-3.5">Assigned Grade</th>
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
                        <td className="p-3.5 font-sans text-stone-700 font-semibold">{student.grade}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: BURSARY MULTI-CHANNEL SETTLEMENT */}
          {activeTab === "bursary" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <span className="text-xs text-stone-500 font-mono">Term Invoiced</span>
                  <div className="font-serif text-2xl font-bold text-stone-900 mt-1">
                    ₦18,400,000
                  </div>
                  <div className="text-[11px] text-stone-400">JSS 2 Silver & SSS 1 Science</div>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <span className="text-xs text-emerald-700 font-mono">Providus & Paystack Cleared</span>
                  <div className="font-serif text-2xl font-bold text-emerald-900 mt-1">
                    ₦15,800,000
                  </div>
                  <div className="text-[11px] text-emerald-600">85.8% Collected • ₦0 Gap</div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
                  <span className="text-xs text-rose-700 font-mono">Outstanding Arrears</span>
                  <div className="font-serif text-2xl font-bold text-rose-900 mt-1">
                    ₦2,600,000
                  </div>
                  <div className="text-[11px] text-rose-600">2 Families Pending</div>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 overflow-hidden divide-y divide-stone-100 text-xs font-mono">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50 transition-colors"
                  >
                    <div>
                      <span className="font-sans font-bold text-stone-900 text-sm">
                        {student.name}
                      </span>
                      <div className="text-[11px] text-stone-500">
                        Providus Dedicated Account #9902184{student.id}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {student.feeStatus === "cleared" ? (
                        <span className="flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 text-xs font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Cleared (₦0 Arrears)</span>
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1 text-xs font-bold">
                            Arrears: ₦{student.arrears.toLocaleString()}
                          </span>
                          <button
                            onClick={() => handleSimulateSettle(student.id)}
                            className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 text-xs cursor-pointer shadow-sm"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            <span>Simulate Instant Settle</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: AI CURRICULUM GENERATOR */}
          {activeTab === "curriculum" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-purple-700 font-bold">
                      Curriculum Knowledge Ingestion Engine
                    </span>
                    <h3 className="font-serif text-2xl font-bold text-stone-900 mt-1">
                      Automate Teacher Lesson Note Preparation
                    </h3>
                    <p className="text-xs text-stone-600 font-light mt-1">
                      Select subject and level to test automated curriculum unit structuring:
                    </p>
                  </div>

                  <button
                    onClick={handleTriggerAiPlan}
                    disabled={isGeneratingAi}
                    className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-3 text-xs transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                  >
                    <Sparkles className={`h-4 w-4 ${isGeneratingAi ? "animate-spin" : ""}`} />
                    <span>{isGeneratingAi ? "Formulating Units..." : "Generate Lesson Plan & CBT"}</span>
                  </button>
                </div>
              </div>

              {aiGeneratedOutput ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 font-mono text-xs text-emerald-900 space-y-2"
                >
                  <div className="font-bold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>AI Run Complete (Curriculum Lifecycle Binding Active)</span>
                  </div>
                  <p className="font-sans text-xs text-stone-700">{aiGeneratedOutput}</p>
                </motion.div>
              ) : (
                <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-xs font-mono text-stone-500">
                  Click "Generate Lesson Plan & CBT" to preview curriculum AI extraction
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DIRECT PARENT PORTAL */}
          {activeTab === "portal" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                <div>
                  <h3 className="font-serif text-xl font-bold text-stone-900">
                    Direct Mobile Report Slips & Parent Portal
                  </h3>
                  <p className="text-xs text-stone-500 font-light mt-1">
                    Parents view verified PDF report cards directly on mobile browsers with student access PINs:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-stone-800">
                      Sample Parent Portal View
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                      Direct Mobile Web
                    </span>
                  </div>
                  <div className="rounded-xl bg-white border border-stone-200 p-3.5 text-xs text-stone-700 font-sans leading-relaxed shadow-sm space-y-2">
                    <div className="flex justify-between font-mono text-[11px] border-b pb-1.5">
                      <span>Student: <strong>Sarah Okon (JSS 2 Silver)</strong></span>
                      <span className="text-emerald-700 font-bold">92.6% (1st)</span>
                    </div>
                    <p className="text-stone-500 text-[11px]">
                      Official Term 2 Report Card generated and verified. Fee status: Cleared (₦0 arrears).
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-stone-800">
                      Security & Verification Standard
                    </span>
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  </div>
                  <ul className="space-y-2 text-xs text-stone-600 font-light">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Encrypted One-Time Token / PIN Authentication</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Optional Fee Gate (Only cleared students can view)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Zero App Store Downloads or Parent Password Setup</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card3DTilt>
    </section>
  );
}
