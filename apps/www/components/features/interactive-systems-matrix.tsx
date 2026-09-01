"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  Coins,
  Sparkles,
  Smartphone,
  CheckCircle2,
  Receipt,
  ShieldCheck,
  Check,
  ArrowUpDown,
  BookOpen,
  HelpCircle,
  Clock,
  Send,
} from "lucide-react";
import { playTick } from "../../lib/audio-feedback";

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

const CURRICULUM_PRESETS = [
  {
    id: "science",
    subject: "JSS 2 • Basic Science",
    topic: "Photosynthesis & Solar Conversion",
    nerdcCode: "NERDC-SCI-J2-T3",
    objectives: [
      "Define chlorophyll's biochemical role in photons capture",
      "Write and balance the word equation for glucose synthesis",
      "Explain the stomatal gas exchange mechanism in plant leaves",
    ],
    materials: "Fresh hibiscus leaf, ethanol bath, iodine solution, dropper",
    practiceQuestions: [
      { q: "What gas is released as a byproduct during photolysis of water?", a: "Oxygen (O₂)" },
      { q: "Which reagent tests for starch accumulation in a leaf?", a: "Iodine solution (Blue-black)" },
    ],
  },
  {
    id: "math",
    subject: "SSS 1 • Mathematics",
    topic: "Quadratic Equations by Factorization",
    nerdcCode: "NERDC-MTH-S1-T4",
    objectives: [
      "Factorize quadratic trinomials of form ax² + bx + c = 0",
      "Apply the zero-product principle to solve for roots",
      "Construct parabolic curve sketches identifying real intercepts",
    ],
    materials: "Graph sheets, scientific calculators, geometric grid charts",
    practiceQuestions: [
      { q: "Solve for x: x² - 5x + 6 = 0", a: "x = 2 or x = 3" },
      { q: "What is the discriminant value if roots are real and equal?", a: "Δ = b² - 4ac = 0" },
    ],
  },
  {
    id: "civic",
    subject: "SSS 2 • Civic Education",
    topic: "Rule of Law & Citizen Fundamental Rights",
    nerdcCode: "NERDC-CIV-S2-T2",
    objectives: [
      "Examine the 1999 Constitution Chapter IV fundamental human rights",
      "Distinguish between constitutional supremacy vs. arbitrary executive power",
      "Identify institutional watchdogs enforcing civic rights in Nigeria",
    ],
    materials: "1999 Constitution extract, human rights charter summary",
    practiceQuestions: [
      { q: "Which section guaranteed right to personal liberty in Nigeria?", a: "Section 35, 1999 Constitution" },
      { q: "What principle ensures no citizen is above the law?", a: "Equality before the law" },
    ],
  },
];

export function InteractiveSystemsMatrix() {
  const [activeTab, setActiveTab] = useState<"broadsheet" | "bursary" | "curriculum" | "portal">("broadsheet");
  const [gradingScale, setGradingScale] = useState<"waec" | "primary">("waec");
  const [students, setStudents] = useState<StudentScore[]>(INITIAL_STUDENTS);
  const [studentOrder, setStudentOrder] = useState<string[]>(["1", "2", "3", "4"]);

  // Curriculum generator state
  const [selectedSubjectId, setSelectedSubjectId] = useState("science");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedPlan, setAiGeneratedPlan] = useState<typeof CURRICULUM_PRESETS[0] | null>(CURRICULUM_PRESETS[0]);

  const handleScoreChange = (id: string, field: "ca1" | "ca2" | "exam", val: number) => {
    playTick("soft");
    const maxVal = field === "exam" ? 60 : 20;
    const clamped = Math.max(0, Math.min(maxVal, isNaN(val) ? 0 : val));
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: clamped } : s))
    );
  };

  // Re-rank smoothly on blur or Enter
  const handleReRank = () => {
    const sorted = [...students].sort((a, b) => {
      const totalA = a.ca1 + a.ca2 + a.exam;
      const totalB = b.ca1 + b.ca2 + b.exam;
      return totalB - totalA;
    });
    setStudentOrder(sorted.map((s) => s.id));
    playTick("settle");
  };

  const handleSimulateSettle = (id: string) => {
    playTick("settle");
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, feeStatus: "cleared", arrears: 0 } : s))
    );
  };

  const handleGenerateCurriculum = (presetId: string) => {
    playTick("chime");
    setIsGeneratingAi(true);
    setAiGeneratedPlan(null);

    setTimeout(() => {
      const target = CURRICULUM_PRESETS.find((p) => p.id === presetId) || CURRICULUM_PRESETS[0];
      setAiGeneratedPlan(target);
      setIsGeneratingAi(false);
      playTick("settle");
    }, 700);
  };

  // Compute calculated metrics
  const studentMap = useMemo(() => {
    const map = new Map<string, StudentScore & { total: number; average: string; grade: string }>();

    students.forEach((s) => {
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
        if (total >= 80) grade = "Exceeding";
        else if (total >= 65) grade = "Meeting";
        else if (total >= 50) grade = "Approaching";
        else grade = "Needs Support";
      }

      map.set(s.id, { ...s, total, average, grade });
    });

    return map;
  }, [students, gradingScale]);

  const orderedStudents = studentOrder
    .map((id) => studentMap.get(id))
    .filter(Boolean) as (StudentScore & { total: number; average: string; grade: string })[];

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-16 relative">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
          Test the platform engine live.
        </h2>
        <p className="mt-3 text-stone-600 text-sm sm:text-base font-light leading-relaxed">
          Simulate real administrative operations and watch the system compute results in real time:
        </p>
      </div>

      {/* Sticky Tabs Bar - Sticks to top when scrolling */}
      <div className="sticky top-16 sm:top-20 z-30 py-3 mb-6 bg-[#FAF9F5]/90 backdrop-blur-md transition-all flex justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-4 p-1.5 rounded-2xl bg-stone-200/80 border border-stone-300/90 shadow-sm gap-1 w-full max-w-2xl">
          <button
            onClick={() => {
              setActiveTab("broadsheet");
              playTick("click");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer text-center ${
              activeTab === "broadsheet"
                ? "bg-white text-stone-900 shadow-sm font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            1. Broadsheet Matrix
          </button>

          <button
            onClick={() => {
              setActiveTab("bursary");
              playTick("click");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer text-center ${
              activeTab === "bursary"
                ? "bg-white text-stone-900 shadow-sm font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            2. Bursary Ledger
          </button>

          <button
            onClick={() => {
              setActiveTab("curriculum");
              playTick("click");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer text-center ${
              activeTab === "curriculum"
                ? "bg-white text-stone-900 shadow-sm font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            3. AI Lesson Prep
          </button>

          <button
            onClick={() => {
              setActiveTab("portal");
              playTick("click");
            }}
            className={`py-2 px-3 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer text-center ${
              activeTab === "portal"
                ? "bg-white text-stone-900 shadow-sm font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            4. Parent Portal
          </button>
        </div>
      </div>

      {/* Main Single-Surface Panel (No nested box-in-box clutter) */}
      <div className="rounded-3xl border border-stone-300 bg-white p-6 sm:p-9 shadow-sm">
        {/* ──────────────── TAB 1: BROADSHEET ──────────────── */}
        {activeTab === "broadsheet" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-stone-800">
                  Class: JSS 2 Silver (Live Broadsheet Simulation)
                </span>
                <div className="text-xs text-stone-500 font-light mt-0.5">
                  Scores calculate in-place • Click out or press Enter to smoothly re-rank:
                </div>
              </div>

              {/* Scale Selector */}
              <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200 self-start sm:self-auto">
                <button
                  onClick={() => {
                    setGradingScale("waec");
                    playTick("soft");
                  }}
                  className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${
                    gradingScale === "waec"
                      ? "bg-white font-bold text-stone-900 shadow-sm"
                      : "text-stone-500"
                  }`}
                >
                  WAEC 9-Point
                </button>
                <button
                  onClick={() => {
                    setGradingScale("primary");
                    playTick("soft");
                  }}
                  className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${
                    gradingScale === "primary"
                      ? "bg-white font-bold text-stone-900 shadow-sm"
                      : "text-stone-500"
                  }`}
                >
                  Universal Primary
                </button>
              </div>
            </div>

            {/* Mobile View: Fluid Layout Animated Cards */}
            <div className="md:hidden space-y-3">
              <AnimatePresence>
                {orderedStudents.map((student, idx) => (
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                    key={student.id}
                    className={`rounded-2xl border p-4 transition-colors ${
                      idx === 0
                        ? "border-amber-300 bg-amber-50/30"
                        : "border-stone-200 bg-stone-50/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-sans font-bold text-stone-900 text-sm">
                        {student.name}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-700 bg-white px-2 py-0.5 rounded-md border border-stone-200 shadow-2xs">
                        {idx === 0 ? "1st" : idx === 1 ? "2nd" : idx === 2 ? "3rd" : `${idx + 1}th`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 my-3">
                      <div className="rounded-xl bg-white border border-stone-200 p-2 text-center">
                        <div className="text-[10px] font-mono text-stone-400">CA1 (20)</div>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={student.ca1}
                          onChange={(e) =>
                            handleScoreChange(student.id, "ca1", parseInt(e.target.value))
                          }
                          onBlur={handleReRank}
                          onKeyDown={(e) => e.key === "Enter" && handleReRank()}
                          className="w-full text-center font-mono text-sm font-bold mt-1 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                        />
                      </div>

                      <div className="rounded-xl bg-white border border-stone-200 p-2 text-center">
                        <div className="text-[10px] font-mono text-stone-400">CA2 (20)</div>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={student.ca2}
                          onChange={(e) =>
                            handleScoreChange(student.id, "ca2", parseInt(e.target.value))
                          }
                          onBlur={handleReRank}
                          onKeyDown={(e) => e.key === "Enter" && handleReRank()}
                          className="w-full text-center font-mono text-sm font-bold mt-1 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                        />
                      </div>

                      <div className="rounded-xl bg-white border border-stone-200 p-2 text-center">
                        <div className="text-[10px] font-mono text-stone-400">Exam (60)</div>
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={student.exam}
                          onChange={(e) =>
                            handleScoreChange(student.id, "exam", parseInt(e.target.value))
                          }
                          onBlur={handleReRank}
                          onKeyDown={(e) => e.key === "Enter" && handleReRank()}
                          className="w-full text-center font-mono text-sm font-bold mt-1 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 font-mono text-xs">
                      <div>
                        Total: <strong className="text-stone-900">{student.total}/100</strong>
                      </div>
                      <div className="font-sans font-bold text-amber-700">{student.grade}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Desktop View: Full Broadsheet Table with Smooth Row Transitions */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-stone-200">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-stone-50 text-stone-700 border-b border-stone-200">
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
                  {orderedStudents.map((student, idx) => (
                    <tr
                      key={student.id}
                      className={`hover:bg-amber-50/20 transition-all ${
                        idx === 0 ? "bg-amber-50/30 font-medium" : ""
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
                          onBlur={handleReRank}
                          onKeyDown={(e) => e.key === "Enter" && handleReRank()}
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
                          onBlur={handleReRank}
                          onKeyDown={(e) => e.key === "Enter" && handleReRank()}
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
                          onBlur={handleReRank}
                          onKeyDown={(e) => e.key === "Enter" && handleReRank()}
                          className="w-14 rounded border border-stone-300 px-2 py-1 text-center font-mono text-xs focus:border-amber-500 focus:outline-none bg-stone-50"
                        />
                      </td>
                      <td className="p-3.5 font-bold text-stone-900">{student.total}/100</td>
                      <td className="p-3.5 font-bold text-emerald-700">{student.average}%</td>
                      <td className="p-3.5 font-sans text-stone-700 font-semibold">
                        {student.grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Re-Rank Manual Trigger Button */}
            <div className="flex justify-end pt-1">
              <button
                onClick={handleReRank}
                className="flex items-center gap-1.5 text-xs font-mono text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3.5 py-2 rounded-xl border border-stone-200 transition-colors cursor-pointer"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-amber-600" />
                <span>Re-Rank Broadsheet</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────────────── TAB 2: BURSARY ──────────────── */}
        {activeTab === "bursary" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-2 border-b border-stone-100">
              <div className="border-l-2 border-stone-300 pl-3.5">
                <span className="text-xs text-stone-500 font-mono block">Term Invoiced</span>
                <span className="font-serif text-2xl font-bold text-stone-900">
                  ₦18,400,000
                </span>
              </div>

              <div className="border-l-2 border-emerald-500 pl-3.5">
                <span className="text-xs text-emerald-700 font-mono block">Reconciled Collections</span>
                <span className="font-serif text-2xl font-bold text-emerald-900">
                  ₦15,800,000
                </span>
              </div>

              <div className="border-l-2 border-amber-500 pl-3.5">
                <span className="text-xs text-stone-500 font-mono block">Outstanding Arrears</span>
                <span className="font-serif text-2xl font-bold text-stone-700">
                  ₦2,600,000
                </span>
              </div>
            </div>

            <div className="divide-y divide-stone-100 text-xs font-mono">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-sans font-bold text-stone-900 text-sm">
                      {student.name}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      Providus Virtual Bank Feed: #9902184{student.id}
                    </div>
                  </div>

                  <div>
                    {student.feeStatus === "cleared" ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Cleared (₦0 Arrears)</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-stone-700 font-semibold">
                          ₦{student.arrears.toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleSimulateSettle(student.id)}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-sans text-xs px-3.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-2xs"
                        >
                          Simulate Payment
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ──────────────── TAB 3: AUTHENTIC AI CURRICULUM STUDIO ──────────────── */}
        {activeTab === "curriculum" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
                  NERDC & WAEC Curriculum Preparation Studio
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 font-light mt-0.5">
                  Select a syllabus subject to synthesize structured lesson notes, learning objectives, and CBT diagnostics:
                </p>
              </div>

              {/* Subject Presets */}
              <div className="flex flex-wrap gap-2">
                {CURRICULUM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedSubjectId(preset.id);
                      handleGenerateCurriculum(preset.id);
                    }}
                    className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all cursor-pointer ${
                      selectedSubjectId === preset.id
                        ? "bg-stone-900 text-white font-bold shadow-sm"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    {preset.subject.split("•")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Generator Output Body */}
            {isGeneratingAi ? (
              <div className="py-12 text-center space-y-3">
                <div className="inline-block h-6 w-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                <div className="font-mono text-xs text-stone-600">
                  Aligning learning objectives with NERDC framework...
                </div>
              </div>
            ) : aiGeneratedPlan ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-5"
              >
                {/* Topic Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-amber-700 uppercase">
                      {aiGeneratedPlan.subject}
                    </span>
                    <h4 className="font-serif text-xl font-bold text-stone-900 mt-0.5">
                      {aiGeneratedPlan.topic}
                    </h4>
                  </div>
                  <span className="font-mono text-xs text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                    {aiGeneratedPlan.nerdcCode}
                  </span>
                </div>

                {/* Structured Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1 text-xs">
                  {/* Behavioral Objectives */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 font-mono font-bold text-stone-800">
                      <BookOpen className="h-4 w-4 text-amber-600" />
                      <span>Behavioral Learning Objectives</span>
                    </div>
                    <ul className="space-y-2 text-stone-600 font-light pl-6 list-disc">
                      {aiGeneratedPlan.objectives.map((obj, i) => (
                        <li key={i} className="leading-relaxed">
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Diagnostic CBT Questions */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 font-mono font-bold text-stone-800">
                      <HelpCircle className="h-4 w-4 text-emerald-600" />
                      <span>Auto-Marking CBT Diagnostic Bank</span>
                    </div>
                    <div className="space-y-2 font-mono text-[11px]">
                      {aiGeneratedPlan.practiceQuestions.map((pq, i) => (
                        <div key={i} className="rounded-xl bg-stone-50 p-2.5 border border-stone-200/80">
                          <div className="text-stone-800 font-semibold">Q{i + 1}: {pq.q}</div>
                          <div className="text-emerald-700 mt-1">Key: {pq.a}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </div>
        )}

        {/* ──────────────── TAB 4: PARENT PORTAL ──────────────── */}
        {activeTab === "portal" && (
          <div className="space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-stone-900">
                Direct Mobile Student Report Slips
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 font-light mt-0.5">
                Parents securely access student performance records on any smartphone with one-time PIN authentication:
              </p>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center font-mono text-xs border-b border-stone-100 pb-2">
                <span>Student: <strong className="text-stone-900">Sarah Okon (JSS 2 Silver)</strong></span>
                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                  92.6% • 1st Position
                </span>
              </div>
              <p className="text-stone-600 font-light leading-relaxed">
                Official Term 2 Report Card certified with cryptographic QR validation and real-time financial clearance verification.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
