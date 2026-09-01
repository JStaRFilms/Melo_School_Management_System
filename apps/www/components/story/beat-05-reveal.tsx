"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  MessageSquare,
  Phone,
  Printer,
  Receipt,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import React, { useState } from "react";

export function Beat05Reveal() {
  const [activeTab, setActiveTab] = useState<
    "broadsheet" | "bursary" | "portal" | "admissions"
  >("broadsheet");

  const [reminderSent, setReminderSent] = useState(false);
  const [selectedClass, setSelectedClass] = useState("JSS 2 Silver");

  const triggerReminder = () => {
    setReminderSent(true);
    setTimeout(() => setReminderSent(false), 3000);
  };

  return (
    <section className="relative min-h-[100svh] w-full flex flex-col justify-center items-center px-4 sm:px-8 py-28 bg-white overflow-hidden">
      {/* Chapter Marker */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="mb-6 flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-50 px-4 py-1.5 shadow-sm"
      >
        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-900">
          Chapter 05 — The Reveal
        </span>
      </motion.div>

      {/* Climactic Headline */}
      <div className="max-w-4xl text-center mb-12">
        <h2 className="font-serif text-4xl sm:text-6xl md:text-7xl text-melo-ink font-bold tracking-tight leading-[1.05]">
          ONE SCHOOL. ONE SYSTEM.
        </h2>
        <p className="mt-4 text-stone-600 text-base sm:text-xl max-w-2xl mx-auto font-light leading-relaxed">
          Melo brings the academic, financial, administrative, and communication life of
          your school into one connected, living platform.
        </p>
      </div>

      {/* Interactive Workspace Navigation Tabs */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 z-10">
        <button
          onClick={() => setActiveTab("broadsheet")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-medium transition-all duration-300 cursor-pointer ${
            activeTab === "broadsheet"
              ? "bg-melo-ink text-white shadow-xl shadow-stone-900/20 scale-105"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4 text-amber-400" />
          <span>Broadsheet & Results</span>
        </button>

        <button
          onClick={() => setActiveTab("bursary")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-medium transition-all duration-300 cursor-pointer ${
            activeTab === "bursary"
              ? "bg-melo-ink text-white shadow-xl shadow-stone-900/20 scale-105"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          <Coins className="h-4 w-4 text-emerald-400" />
          <span>Bursary & Arrears Tracker</span>
        </button>

        <button
          onClick={() => setActiveTab("portal")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-medium transition-all duration-300 cursor-pointer ${
            activeTab === "portal"
              ? "bg-melo-ink text-white shadow-xl shadow-stone-900/20 scale-105"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          <Smartphone className="h-4 w-4 text-indigo-400" />
          <span>Parent Mobile Portal</span>
        </button>

        <button
          onClick={() => setActiveTab("admissions")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-medium transition-all duration-300 cursor-pointer ${
            activeTab === "admissions"
              ? "bg-melo-ink text-white shadow-xl shadow-stone-900/20 scale-105"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          <UserCheck className="h-4 w-4 text-sky-400" />
          <span>Admissions & Website</span>
        </button>
      </div>

      {/* Main Interactive Live Platform Window */}
      <div className="w-full max-w-6xl rounded-3xl border border-stone-200/90 bg-stone-50/70 p-4 sm:p-8 shadow-2xl shadow-stone-300/60 backdrop-blur-xl relative">
        {/* Window Topbar */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="text-xs font-semibold text-stone-700 font-mono">
              Melo School Command • Demo Academy
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-stone-500 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connected: 2025/2026 Term 2</span>
          </div>
        </div>

        {/* Tab 1: Broadsheet & Results */}
        {activeTab === "broadsheet" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-stone-200">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-serif text-lg text-melo-ink font-semibold">
                    Term 2 Consolidated Broadsheet
                  </h4>
                  <p className="text-xs text-stone-500 font-light">
                    Auto-ranked • 42 Students • Grading Scheme: WAEC 9-Point Standard
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 cursor-pointer"
                >
                  <option value="JSS 2 Silver">JSS 2 Silver</option>
                  <option value="SSS 1 Science">SSS 1 Science</option>
                  <option value="Primary 5 Diamond">Primary 5 Diamond</option>
                </select>

                <button className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium px-3.5 py-1.5 text-xs transition-colors cursor-pointer shadow-sm">
                  <Printer className="h-3.5 w-3.5" />
                  <span>Batch Report Cards</span>
                </button>
              </div>
            </div>

            {/* Broadsheet Table */}
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-stone-100/80 text-stone-600 border-b border-stone-200">
                  <tr>
                    <th className="p-3.5">Pos</th>
                    <th className="p-3.5">Student Name</th>
                    <th className="p-3.5">Maths (CA+Ex)</th>
                    <th className="p-3.5">English (CA+Ex)</th>
                    <th className="p-3.5">Basic Sci</th>
                    <th className="p-3.5">Total</th>
                    <th className="p-3.5">Average</th>
                    <th className="p-3.5">Grade</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  <tr className="hover:bg-amber-50/40 bg-amber-50/20 font-medium">
                    <td className="p-3.5 font-bold text-amber-700">1st</td>
                    <td className="p-3.5 flex items-center gap-2">
                      <span className="font-sans font-semibold text-stone-900">
                        Sarah Okon
                      </span>
                      <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                        Top of Class
                      </span>
                    </td>
                    <td className="p-3.5">19 + 74 = 93</td>
                    <td className="p-3.5">18 + 72 = 90</td>
                    <td className="p-3.5">20 + 75 = 95</td>
                    <td className="p-3.5 font-bold">278/300</td>
                    <td className="p-3.5 font-bold text-emerald-700">92.6%</td>
                    <td className="p-3.5">A1 (Excellent)</td>
                    <td className="p-3.5 text-emerald-600">✓ Published</td>
                  </tr>

                  <tr className="hover:bg-stone-50">
                    <td className="p-3.5 font-bold text-stone-600">2nd</td>
                    <td className="p-3.5 font-sans font-medium text-stone-900">
                      Amina Bello
                    </td>
                    <td className="p-3.5">18 + 70 = 88</td>
                    <td className="p-3.5">19 + 71 = 90</td>
                    <td className="p-3.5">17 + 72 = 89</td>
                    <td className="p-3.5 font-bold">267/300</td>
                    <td className="p-3.5 font-bold text-emerald-700">89.0%</td>
                    <td className="p-3.5">A1 (Excellent)</td>
                    <td className="p-3.5 text-emerald-600">✓ Published</td>
                  </tr>

                  <tr className="hover:bg-stone-50">
                    <td className="p-3.5 font-bold text-stone-600">3rd</td>
                    <td className="p-3.5 font-sans font-medium text-stone-900">
                      David Adeleke
                    </td>
                    <td className="p-3.5">16 + 68 = 84</td>
                    <td className="p-3.5">17 + 65 = 82</td>
                    <td className="p-3.5">18 + 69 = 87</td>
                    <td className="p-3.5 font-bold">253/300</td>
                    <td className="p-3.5 font-bold text-emerald-700">84.3%</td>
                    <td className="p-3.5">B2 (Very Good)</td>
                    <td className="p-3.5 text-emerald-600">✓ Published</td>
                  </tr>

                  <tr className="hover:bg-stone-50">
                    <td className="p-3.5 font-bold text-stone-600">4th</td>
                    <td className="p-3.5 font-sans font-medium text-stone-900">
                      Chukwudi Eze
                    </td>
                    <td className="p-3.5">15 + 62 = 77</td>
                    <td className="p-3.5">16 + 60 = 76</td>
                    <td className="p-3.5">16 + 64 = 80</td>
                    <td className="p-3.5 font-bold">233/300</td>
                    <td className="p-3.5 font-bold text-emerald-700">77.6%</td>
                    <td className="p-3.5">B3 (Good)</td>
                    <td className="p-3.5 text-emerald-600">✓ Published</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Tab 2: Bursary & Arrears Tracker */}
        {activeTab === "bursary" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Bursary Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                <div className="text-xs font-mono text-stone-500">Term 2 Total Invoiced</div>
                <div className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                  ₦14,250,000
                </div>
                <div className="text-xs text-stone-400 mt-1">482 Total Students</div>
              </div>

              <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-200 shadow-sm">
                <div className="text-xs font-mono text-emerald-700">Paystack Collected</div>
                <div className="font-serif text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">
                  ₦11,850,000
                </div>
                <div className="text-xs text-emerald-600 mt-1">83.1% Realized Collections</div>
              </div>

              <div className="bg-rose-50/60 rounded-2xl p-5 border border-rose-200 shadow-sm">
                <div className="text-xs font-mono text-rose-700">Outstanding Arrears</div>
                <div className="font-serif text-2xl sm:text-3xl font-bold text-rose-900 mt-1">
                  ₦2,400,000
                </div>
                <div className="text-xs text-rose-600 mt-1">38 Families Pending</div>
              </div>
            </div>

            {/* Live Arrears Table with 1-Click Reminder */}
            <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
              <div className="p-4 bg-stone-100/80 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs font-mono font-semibold text-stone-700">
                  Live Fee Reconciliation Ledger
                </div>
                <button
                  onClick={triggerReminder}
                  disabled={reminderSent}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3.5 py-1.5 text-xs transition-all cursor-pointer shadow-sm"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {reminderSent ? "✓ Reminders Dispatched!" : "1-Click WhatsApp Reminders"}
                  </span>
                </button>
              </div>

              <div className="divide-y divide-stone-100 text-xs font-mono">
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-stone-50">
                  <div>
                    <span className="font-sans font-semibold text-stone-900 text-sm">
                      Sarah Okon (JSS 2 Silver)
                    </span>
                    <div className="text-stone-500 text-[11px]">
                      Parent: Dr. Emeka Okon • +234 803 123 4567
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-stone-600">Paid: ₦100,000 / ₦185,000</span>
                    <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">
                      Arrears: ₦85,000
                    </span>
                  </div>
                </div>

                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-stone-50">
                  <div>
                    <span className="font-sans font-semibold text-stone-900 text-sm">
                      David Adeleke (JSS 2 Silver)
                    </span>
                    <div className="text-stone-500 text-[11px]">
                      Parent: Mrs. Funke Adeleke • +234 802 987 6543
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-stone-600">Paid: ₦185,000 / ₦185,000</span>
                    <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">
                      Cleared (₦0)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 3: Parent Mobile Portal */}
        {activeTab === "portal" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center"
          >
            <div className="w-full max-w-sm rounded-[2.5rem] border-4 border-stone-800 bg-stone-950 p-4 shadow-2xl text-white">
              {/* Phone Speaker Notch */}
              <div className="mx-auto h-4 w-28 rounded-full bg-stone-800 mb-4" />

              {/* Portal Screen */}
              <div className="rounded-3xl bg-stone-900 p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div>
                    <div className="text-[10px] text-amber-400 font-mono uppercase">
                      Parent Portal
                    </div>
                    <div className="font-serif text-lg font-semibold text-white">
                      Sarah Okon
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>

                <div className="rounded-2xl bg-stone-800/80 p-3.5 space-y-2 border border-stone-700/60">
                  <div className="text-[11px] font-semibold text-amber-300 flex items-center justify-between">
                    <span>Term 2 Report Card Ready</span>
                    <span className="text-[10px] font-mono text-stone-400">92.6% Avg</span>
                  </div>
                  <p className="text-[11px] text-stone-300 font-light">
                    Position: 1st in JSS 2 Silver. Principal Remark: "Exceptional academic leadership."
                  </p>
                  <button className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 text-stone-950 font-bold py-2 text-[11px] hover:bg-amber-400 transition-colors">
                    <Download className="h-3 w-3" />
                    <span>Download Signed PDF</span>
                  </button>
                </div>

                <div className="rounded-2xl bg-stone-800/80 p-3.5 space-y-2 border border-stone-700/60">
                  <div className="text-[11px] font-semibold text-rose-300 flex items-center justify-between">
                    <span>Bursary Account</span>
                    <span className="text-[10px] font-mono text-rose-400">₦85,000 Due</span>
                  </div>
                  <button className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white font-bold py-2 text-[11px] hover:bg-emerald-500 transition-colors">
                    <Receipt className="h-3 w-3" />
                    <span>Pay ₦85,000 via Paystack</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 4: Admissions & School Website */}
        {activeTab === "admissions" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl p-6 border border-stone-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-serif text-lg text-melo-ink font-semibold">
                    2026/2027 Admissions Pipeline
                  </h4>
                  <p className="text-xs text-stone-500">
                    Live candidate queue synchronizing directly with class enrollments
                  </p>
                </div>
                <span className="text-xs font-mono bg-sky-50 text-sky-700 px-3 py-1 rounded-xl font-medium border border-sky-200">
                  42 Candidates in Funnel
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center text-xs font-mono">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-stone-500 text-[10px]">1. Applications</div>
                  <div className="text-lg font-bold text-stone-800 mt-1">42</div>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-stone-500 text-[10px]">2. CBT Screened</div>
                  <div className="text-lg font-bold text-amber-700 mt-1">28</div>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-stone-500 text-[10px]">3. Offered Admission</div>
                  <div className="text-lg font-bold text-emerald-700 mt-1">19</div>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-stone-500 text-[10px]">4. Enrolled Students</div>
                  <div className="text-lg font-bold text-sky-700 mt-1">15</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
