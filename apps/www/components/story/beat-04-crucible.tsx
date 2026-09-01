"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import React, { useState } from "react";

interface TelemetryLog {
  id: string;
  time: string;
  source: string;
  message: string;
  type: "normal" | "stress" | "resolved";
}

export function Beat04Crucible() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);
  const [logs, setLogs] = useState<TelemetryLog[]>([
    {
      id: "1",
      time: "16:47:02",
      source: "Bursary Engine",
      message: "Session 2025/2026 Term 2 Invoices Active (482 Students)",
      type: "normal",
    },
    {
      id: "2",
      time: "16:47:15",
      source: "Academic Desk",
      message: "JSS 1–SSS 3 Gradebooks open for CA & Exam Entry",
      type: "normal",
    },
    {
      id: "3",
      time: "16:47:30",
      source: "Parent Gateway",
      message: "Portal ready for published report cards",
      type: "normal",
    },
  ]);

  const runStressTest = () => {
    setIsSimulating(true);
    setHasResolved(false);

    // Sequence of high-load events
    setTimeout(() => {
      setLogs((prev) => [
        {
          id: "4",
          time: "16:47:38",
          source: "Paystack Webhook",
          message: "⚡ BURST: 142 Simultaneous fee payments hitting gateway",
          type: "stress",
        },
        ...prev,
      ]);
    }, 400);

    setTimeout(() => {
      setLogs((prev) => [
        {
          id: "5",
          time: "16:47:41",
          source: "Broadsheet Compiler",
          message: "⚠️ CRITICAL: 18 Teachers modifying CA3 scores at 4:47 PM result deadline",
          type: "stress",
        },
        ...prev,
      ]);
    }, 900);

    setTimeout(() => {
      setLogs((prev) => [
        {
          id: "6",
          time: "16:47:44",
          source: "Network Layer",
          message: "⚠️ INTERMITTENT: Bursar office connection degraded (Packet loss 32%)",
          type: "stress",
        },
        ...prev,
      ]);
    }, 1400);

    setTimeout(() => {
      setLogs((prev) => [
        {
          id: "7",
          time: "16:47:47",
          source: "Melo Atomic Core",
          message: "🛡️ ISOLATION: Double-entry ledger locked transactions into idempotent batches",
          type: "resolved",
        },
        {
          id: "8",
          time: "16:47:48",
          source: "Melo Academic Core",
          message: "✓ BROADDSHEET COMPILED: All 482 students ranked, GPAs calculated, report cards signed",
          type: "resolved",
        },
        ...prev,
      ]);
      setIsSimulating(false);
      setHasResolved(true);
    }, 2400);
  };

  return (
    <section className="relative min-h-[100svh] w-full flex flex-col justify-center items-center px-4 sm:px-8 py-24 bg-stone-950 text-white overflow-hidden">
      {/* Chapter Marker */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-6 flex items-center gap-2 rounded-full border border-stone-800 bg-stone-900/90 px-4 py-1.5 backdrop-blur-md"
      >
        <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-300">
          Chapter 04 — The Crucible
        </span>
      </motion.div>

      {/* Main Headline */}
      <div className="max-w-4xl text-center mb-12">
        <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl text-white leading-tight">
          Schools don't operate in perfect conditions.
          <br />
          <span className="text-rose-400 italic font-light">
            Neither should the software running them.
          </span>
        </h2>
        <p className="mt-4 text-stone-400 text-sm sm:text-base max-w-2xl mx-auto font-light leading-relaxed">
          Result week deadlines. Chaotic Paystack payment alerts. Weak office internet.
          Experience how Melo handles high-stakes operational pressure without corrupting data.
        </p>
      </div>

      {/* Interactive Crucible Simulator Terminal */}
      <div
        className={`w-full max-w-4xl rounded-3xl border transition-all duration-500 p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden ${
          isSimulating
            ? "border-rose-500/80 bg-rose-950/20 shadow-2xl shadow-rose-900/30 animate-chromatic"
            : hasResolved
            ? "border-emerald-500/80 bg-emerald-950/20 shadow-2xl shadow-emerald-900/30"
            : "border-stone-800 bg-stone-900/80 shadow-2xl"
        }`}
      >
        {/* Terminal Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-800 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="font-mono text-xs text-stone-400 tracking-wider">
              melo-operational-resilience-audit.sh
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={runStressTest}
              disabled={isSimulating}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 font-semibold px-4 py-2 text-xs transition-all cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Simulating Load...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>{hasResolved ? "Re-run Stress Test" : "Simulate Result Week Chaos"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Event Telemetry Stream */}
        <div className="space-y-3 font-mono text-xs min-h-[220px] max-h-[280px] overflow-y-auto pr-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                log.type === "stress"
                  ? "border-rose-800/80 bg-rose-950/40 text-rose-200"
                  : log.type === "resolved"
                  ? "border-emerald-800/80 bg-emerald-950/40 text-emerald-200"
                  : "border-stone-800 bg-stone-900/40 text-stone-300"
              }`}
            >
              <span className="text-stone-500 text-[10px] whitespace-nowrap mt-0.5">
                {log.time}
              </span>
              <span
                className={`text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                  log.type === "stress"
                    ? "bg-rose-900/60 text-rose-300"
                    : log.type === "resolved"
                    ? "bg-emerald-900/60 text-emerald-300"
                    : "bg-stone-800 text-stone-400"
                }`}
              >
                {log.source}
              </span>
              <span className="flex-1 font-light leading-relaxed">{log.message}</span>
            </div>
          ))}
        </div>

        {/* System Resolution Summary */}
        <div className="mt-6 pt-5 border-t border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`h-4 w-4 ${hasResolved ? "text-emerald-400" : "text-amber-400"}`}
            />
            <span className="text-stone-300">
              {hasResolved
                ? "Resilience Status: 100% Integrity Preserved (0 Dropped Txns)"
                : "Resilience Status: Armed & Ready for Simulation"}
            </span>
          </div>
          <span className="text-stone-400">Concurrency: 1,200 ops/sec</span>
        </div>
      </div>

      {/* Forward Narrative Relay */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-14 text-center"
      >
        <p className="text-sm font-medium text-stone-400 flex items-center justify-center gap-2">
          <span>What does that system look like in reality?</span>
          <ArrowRight className="h-4 w-4 text-amber-400 animate-pulse" />
        </p>
      </motion.div>
    </section>
  );
}
