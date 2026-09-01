"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  FileSpreadsheet,
  GraduationCap,
  Sparkles,
  UserCheck,
} from "lucide-react";
import React, { useState } from "react";

interface PipelineStep {
  label: string;
  detail: string;
  status: "completed" | "processing" | "pending";
}

interface WorkflowPipeline {
  id: string;
  title: string;
  icon: React.ReactNode;
  tagline: string;
  steps: PipelineStep[];
  realPain: string;
  meloSolution: string;
}

export function Beat02Machine() {
  const [activePipelineIndex, setActivePipelineIndex] = useState(0);

  const pipelines: WorkflowPipeline[] = [
    {
      id: "academics",
      title: "Results & Broadsheet Engine",
      icon: <FileSpreadsheet className="h-5 w-5 text-amber-500" />,
      tagline: "From individual teacher marks to printable student report cards.",
      steps: [
        {
          label: "1. CA & Exam Entry",
          detail: "Teachers submit CA1 (20), CA2 (20), Exam (60)",
          status: "completed",
        },
        {
          label: "2. Grade Moderation",
          detail: "Vice Principal reviews outlier scores & remarks",
          status: "completed",
        },
        {
          label: "3. Broadsheet Auto-Compile",
          detail: "Class rankings, subject averages & CGPA calculated in 0.4s",
          status: "processing",
        },
        {
          label: "4. Report Card Release",
          detail: "Instant PDF delivery to parent portal with school watermark",
          status: "pending",
        },
      ],
      realPain:
        "Result week typically forces 3 days of manual calculator entries, formula crashes in Excel, and delayed report cards.",
      meloSolution:
        "Teachers submit once. Broadsheets, rankings, and branded report cards compile simultaneously in milliseconds.",
    },
    {
      id: "finance",
      title: "Bursary & Paystack Reconciliation",
      icon: <Coins className="h-5 w-5 text-emerald-500" />,
      tagline: "From school fee invoices to zero-arrears reconciliation.",
      steps: [
        {
          label: "1. Term Fee Invoicing",
          detail: "Tuition, uniforms, textbooks & PTA levies structured per class",
          status: "completed",
        },
        {
          label: "2. Paystack Online Payment",
          detail: "Parents pay via card, bank transfer, or USSD",
          status: "completed",
        },
        {
          label: "3. Auto-Reconciliation",
          detail: "Bursary ledger reconciles bank deposit without manual paper matching",
          status: "processing",
        },
        {
          label: "4. Digital Receipt & Arrears Update",
          detail: "Instant SMS/email receipt issued; exam pass clearance unlocked",
          status: "pending",
        },
      ],
      realPain:
        "Bursars drown in unverified bank deposit slips, missing transaction references, and uncollected term debts.",
      meloSolution:
        "Paystack payments match student invoice IDs immediately. Outstanding debt ledgers remain transparent in real-time.",
    },
    {
      id: "admissions",
      title: "Admissions & Student Pipeline",
      icon: <UserCheck className="h-5 w-5 text-sky-500" />,
      tagline: "From public inquiry to enrolled student record.",
      steps: [
        {
          label: "1. Online Application",
          detail: "Prospective parents fill digital form on branded school site",
          status: "completed",
        },
        {
          label: "2. Entrance Assessment",
          detail: "CBT screening or interview scores logged against applicant ID",
          status: "completed",
        },
        {
          label: "3. Offer & Acceptance Fee",
          detail: "Automated admission offer with conditional invoice generation",
          status: "processing",
        },
        {
          label: "4. Class Allocation",
          detail: "Automatic creation of student identity, parent portal login & class arm",
          status: "pending",
        },
      ],
      realPain:
        "Paper registration files, uncoordinated entrance lists, and double data entry between admissions and classroom registers.",
      meloSolution:
        "Admissions flow directly into class lists and fee accounts with zero manual re-typing.",
    },
  ];

  const current = pipelines[activePipelineIndex];

  return (
    <section className="relative min-h-[100svh] w-full flex flex-col justify-center items-center px-4 sm:px-8 py-24 bg-stone-900 text-stone-100 overflow-hidden">
      {/* Chapter Marker */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-4 flex items-center gap-2 rounded-full border border-stone-700 bg-stone-800/80 px-4 py-1.5 backdrop-blur-md"
      >
        <Cpu className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-300">
          Chapter 02 — The Machine
        </span>
      </motion.div>

      {/* Main Headline */}
      <div className="max-w-4xl text-center mb-12">
        <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl text-white leading-tight">
          It isn't one problem.
          <br />
          <span className="text-amber-400 italic font-light">
            It's hundreds of interdependent workflows.
          </span>
        </h2>
        <p className="mt-4 text-stone-400 text-sm sm:text-base max-w-2xl mx-auto font-light leading-relaxed">
          Behind every report card and fee payment lies a complex operational assembly line.
          Explore how school operations actually move underneath the hood.
        </p>
      </div>

      {/* Pipeline Navigation Selector */}
      <div className="flex flex-wrap justify-center gap-3 mb-10 z-10">
        {pipelines.map((p, idx) => {
          const isActive = idx === activePipelineIndex;
          return (
            <button
              key={p.id}
              onClick={() => setActivePipelineIndex(idx)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-medium transition-all duration-300 ${
                isActive
                  ? "bg-stone-800 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-950/40 scale-105"
                  : "bg-stone-900/80 text-stone-400 border border-stone-800 hover:border-stone-700 hover:text-stone-200"
              }`}
            >
              {p.icon}
              <span>{p.title}</span>
            </button>
          );
        })}
      </div>

      {/* Active Pipeline Card & Kinetic Stepper */}
      <div className="w-full max-w-5xl rounded-3xl border border-stone-800 bg-stone-950/80 p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-800/80 pb-6 mb-8">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400">
              Active Workflow Trace
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl text-white mt-1">
              {current.title}
            </h3>
            <p className="text-xs sm:text-sm text-stone-400 mt-1">{current.tagline}</p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-stone-900 border border-stone-800 px-3 py-1.5 text-xs text-emerald-400 font-mono self-start md:self-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            Live System Pulse: 0.4s latency
          </div>
        </div>

        {/* 4-Step Assembly Line Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {current.steps.map((step, idx) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className={`relative rounded-2xl p-4 border transition-all duration-300 ${
                step.status === "processing"
                  ? "border-amber-500/50 bg-amber-950/20 shadow-lg shadow-amber-950/20"
                  : step.status === "completed"
                  ? "border-emerald-900/60 bg-emerald-950/10"
                  : "border-stone-800/80 bg-stone-900/40"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-semibold text-stone-300">
                  {step.label}
                </span>
                {step.status === "completed" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
                {step.status === "processing" && (
                  <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
                )}
                {step.status === "pending" && (
                  <Clock className="h-4 w-4 text-stone-500" />
                )}
              </div>
              <p className="text-xs text-stone-400 leading-relaxed font-light">
                {step.detail}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Reality Comparison Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-stone-800 bg-stone-900/60 p-5 text-xs sm:text-sm">
          <div className="space-y-1">
            <span className="text-red-400 font-semibold tracking-wide flex items-center gap-1.5 uppercase text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              The Broken Status Quo
            </span>
            <p className="text-stone-300 font-light leading-relaxed">
              {current.realPain}
            </p>
          </div>
          <div className="space-y-1 md:border-l md:border-stone-800 md:pl-5">
            <span className="text-emerald-400 font-semibold tracking-wide flex items-center gap-1.5 uppercase text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              The Melo Unified Engine
            </span>
            <p className="text-stone-300 font-light leading-relaxed">
              {current.meloSolution}
            </p>
          </div>
        </div>
      </div>

      {/* Forward Narrative Relay */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-12 text-center"
      >
        <p className="text-sm font-medium text-stone-400 flex items-center justify-center gap-2">
          <span>What happens when those systems finally know about each other?</span>
          <ArrowRight className="h-4 w-4 text-amber-400 animate-pulse" />
        </p>
      </motion.div>
    </section>
  );
}
