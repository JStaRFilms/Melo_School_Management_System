"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Calculator,
  Check,
  Layers,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import React from "react";

export function Beat03Convergence() {
  const domains = [
    {
      title: "STUDENTS",
      subtitle: "The Living Anchor",
      description: "Class placement, biodata, attendance history, and guardian contact linked in one permanent profile.",
      color: "from-amber-500/20 to-amber-600/5",
      border: "border-amber-500/30",
      accent: "text-amber-600",
    },
    {
      title: "ACADEMICS",
      subtitle: "Zero Calculation Friction",
      description: "CA1, CA2, Exam entries with school-defined grading scales. Instant broadsheets, ranks, and GPAs.",
      color: "from-emerald-500/20 to-emerald-600/5",
      border: "border-emerald-500/30",
      accent: "text-emerald-600",
    },
    {
      title: "FINANCE",
      subtitle: "Audit-Grade Clarity",
      description: "Tuition, uniforms, Paystack collections, automated installment tracking, and zero-debt ledgers.",
      color: "from-sky-500/20 to-sky-600/5",
      border: "border-sky-500/30",
      accent: "text-sky-600",
    },
    {
      title: "COMMUNICATION",
      subtitle: "Instant Parent Visibility",
      description: "Secure parent portal for report cards, fee clearance receipts, and school notices without front-desk calls.",
      color: "from-indigo-500/20 to-indigo-600/5",
      border: "border-indigo-500/30",
      accent: "text-indigo-600",
    },
    {
      title: "ADMINISTRATION",
      subtitle: "Institutional Control",
      description: "Session/term switches, teacher-subject mapping, grading band rules, and immutable audit trails.",
      color: "from-stone-500/20 to-stone-600/5",
      border: "border-stone-500/30",
      accent: "text-stone-700",
    },
  ];

  return (
    <section className="relative min-h-[100svh] w-full flex flex-col justify-center items-center px-4 sm:px-8 py-24 bg-stone-50 overflow-hidden">
      {/* Chapter Marker */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-6 flex items-center gap-2 rounded-full border border-stone-300 bg-white/80 px-4 py-1.5 backdrop-blur-md shadow-sm"
      >
        <Layers className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-700">
          Chapter 03 — The Convergence
        </span>
      </motion.div>

      {/* Main Headline */}
      <div className="max-w-4xl text-center mb-16">
        <h2 className="font-serif text-4xl sm:text-6xl md:text-7xl text-melo-ink leading-[1.05] tracking-tight">
          When information flows,
          <br />
          <span className="text-amber-600 italic font-light">
            the school converges into one.
          </span>
        </h2>
        <p className="mt-4 text-stone-600 text-sm sm:text-lg max-w-2xl mx-auto font-light leading-relaxed">
          No more copy-pasting from teachers' flash drives. No more searching through paper
          receipts. All five operational pillars lock into a single gravitational center.
        </p>
      </div>

      {/* Monumental Operational Scale Metrics */}
      <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-stone-200 bg-white p-8 shadow-xl shadow-stone-200/50 relative overflow-hidden"
        >
          <div className="text-xs font-mono uppercase tracking-widest text-amber-600 mb-2">
            Result Week Speed
          </div>
          <div className="font-serif text-5xl sm:text-6xl font-bold text-melo-ink tracking-tight mb-2">
            3 Days <span className="text-stone-300 font-light">→</span>{" "}
            <span className="text-amber-600">0.4s</span>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 font-light leading-relaxed">
            Stop spending three sleepless days manually calculating broadsheets and positions.
            Melo computes class rankings and CGPA instantly.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="rounded-3xl border border-stone-200 bg-white p-8 shadow-xl shadow-stone-200/50 relative overflow-hidden"
        >
          <div className="text-xs font-mono uppercase tracking-widest text-emerald-600 mb-2">
            Bursary Precision
          </div>
          <div className="font-serif text-5xl sm:text-6xl font-bold text-melo-ink tracking-tight mb-2">
            ₦0 <span className="text-stone-400 text-3xl font-light">Gap</span>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 font-light leading-relaxed">
            Paystack online collections and verified bank deposits automatically clear student
            balances without missing receipts or double records.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-3xl border border-stone-200 bg-white p-8 shadow-xl shadow-stone-200/50 relative overflow-hidden"
        >
          <div className="text-xs font-mono uppercase tracking-widest text-sky-600 mb-2">
            Parent Trust
          </div>
          <div className="font-serif text-5xl sm:text-6xl font-bold text-melo-ink tracking-tight mb-2">
            100% <span className="text-stone-400 text-3xl font-light">Direct</span>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 font-light leading-relaxed">
            Parents view published report cards and pay outstanding term fees from their phones
            without flooding the school admin desk with WhatsApp calls.
          </p>
        </motion.div>
      </div>

      {/* The 5 Converged Domains Grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-5 gap-4 mb-16">
        {domains.map((dom, idx) => (
          <motion.div
            key={dom.title}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
            className={`rounded-2xl border ${dom.border} bg-gradient-to-b ${dom.color} bg-white p-5 shadow-md flex flex-col justify-between`}
          >
            <div>
              <span className={`text-xs font-mono font-bold tracking-wider ${dom.accent}`}>
                {dom.title}
              </span>
              <h4 className="font-serif text-lg font-medium text-stone-900 mt-1 mb-2">
                {dom.subtitle}
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed font-light">
                {dom.description}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-200/60 flex items-center gap-1 text-[11px] text-stone-500 font-medium">
              <Check className="h-3 w-3 text-emerald-600" />
              <span>Unified Sync</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Climax Typography Object */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="text-center z-10"
      >
        <div className="text-xs font-mono uppercase tracking-[0.3em] text-stone-400 mb-2">
          THE END RESULT
        </div>
        <h3 className="font-serif text-5xl sm:text-7xl font-bold tracking-tight text-melo-ink">
          ONE SYSTEM.
        </h3>
        <p className="mt-4 text-stone-600 text-sm font-medium flex items-center justify-center gap-2">
          <span>Can one system survive the complexity of real school operations?</span>
          <ArrowRight className="h-4 w-4 text-amber-600" />
        </p>
      </motion.div>
    </section>
  );
}
