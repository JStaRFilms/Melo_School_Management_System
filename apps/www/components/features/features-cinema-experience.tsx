"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Clock,
  Smartphone,
  Layers,
  GraduationCap,
  Lock,
  History,
  FileCheck2,
  Download,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { GoldButton } from "@/site-ui";
import { ArchitecturalDraftingCanvas } from "../story/architectural-drafting-canvas";
import { SandFeatureHero } from "./sand-feature-hero";
import { SplitPillarShowcase } from "./split-pillar-showcase";
import { HorizontalSystemsGallery } from "./horizontal-systems-gallery";
import { InteractiveSystemsMatrix } from "./interactive-systems-matrix";
import { Card3DTilt } from "../ui/card-3d-tilt";
import { playTick } from "../../lib/audio-feedback";

export function FeaturesCinemaExperience() {
  return (
    <div className="relative w-full bg-[#FAF9F5] text-stone-900 font-sans selection:bg-amber-500/20 selection:text-stone-950 min-h-screen overflow-x-hidden">
      {/* High-DPI Architectural Canvas Background */}
      <ArchitecturalDraftingCanvas />

      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION: THE INCITING ARCHITECTURE & DUST PHYSICS
      ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-36 sm:pt-44 pb-16 px-4 sm:px-8 max-w-6xl mx-auto text-center z-10">
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-1.5 text-xs font-mono font-medium text-stone-700 shadow-sm"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>INSTITUTIONAL CAPABILITY SPECIFICATION</span>
          </motion.div>

          {/* Interactive Sand/Dust Particle Serif Heading */}
          <div className="max-w-4xl mx-auto pt-2">
            <SandFeatureHero />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl mx-auto text-base sm:text-lg text-stone-600 font-light leading-relaxed pt-2"
          >
            Explore the four interconnected operating systems powering Melo. From continuous assessment mark validation to Providus bank feeds and AI curriculum planning — designed for the operational realities of Nigerian schools.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <GoldButton
              href="/contact"
              size="lg"
              className="hover:scale-[1.02] active:scale-[0.99] transition-transform shadow-md"
            >
              Book a 15-minute walkthrough
            </GoldButton>
            <a
              href="#systems-matrix"
              onClick={() => playTick("soft")}
              className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-7 py-3.5 text-sm font-medium text-stone-800 hover:border-stone-400 hover:bg-stone-50 transition-all shadow-sm cursor-pointer active:translate-y-0.5"
            >
              <span>Explore Live Sandbox</span>
              <ArrowRight className="h-4 w-4 text-stone-400" />
            </a>
          </motion.div>
        </div>

        {/* 3 Core Metric Highlights with 3D Tilt */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <Card3DTilt maxTilt={5}>
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm h-full flex flex-col justify-between">
              <div className="text-[11px] font-mono uppercase tracking-widest text-amber-700 font-semibold flex items-center justify-between">
                <span>Result Week Speed</span>
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="font-serif text-3xl font-bold text-stone-900 mt-2">
                0.38s Full Broadsheet
              </div>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed font-light">
                Continuous assessment and exam marks calculate cumulative averages, subject ranks, and WAEC 9-point grades instantly.
              </p>
            </div>
          </Card3DTilt>

          <Card3DTilt maxTilt={5}>
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm h-full flex flex-col justify-between">
              <div className="text-[11px] font-mono uppercase tracking-widest text-emerald-700 font-semibold flex items-center justify-between">
                <span>Bursary Reconciliation</span>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="font-serif text-3xl font-bold text-stone-900 mt-2">
                ₦0 Unmatched Gap
              </div>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed font-light">
                Paystack cards and Providus dedicated virtual accounts reconcile in real time against student fee invoices.
              </p>
            </div>
          </Card3DTilt>

          <Card3DTilt maxTilt={5}>
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm h-full flex flex-col justify-between">
              <div className="text-[11px] font-mono uppercase tracking-widest text-sky-700 font-semibold flex items-center justify-between">
                <span>Family Connectivity</span>
                <Smartphone className="h-3.5 w-3.5 text-sky-600" />
              </div>
              <div className="font-serif text-3xl font-bold text-stone-900 mt-2">
                Direct Mobile Portal
              </div>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed font-light">
                Verified report slips and fee payment receipts accessible straight from parent mobile browsers with student PIN access.
              </p>
            </div>
          </Card3DTilt>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. SCENE 2: 3-PILLAR 3D CARD DECONSTRUCTION & 180° FLIP
      ───────────────────────────────────────────────────────────── */}
      <SplitPillarShowcase />

      {/* ─────────────────────────────────────────────────────────────
          3. SCENE 3: PINNED HORIZONTAL 4-SYSTEMS RUNWAY
      ───────────────────────────────────────────────────────────── */}
      <HorizontalSystemsGallery />

      {/* ─────────────────────────────────────────────────────────────
          4. SCENE 4: INTERACTIVE DIAGNOSTIC SANDBOX
      ───────────────────────────────────────────────────────────── */}
      <div id="systems-matrix">
        <InteractiveSystemsMatrix />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. SCENE 5: INSTITUTIONAL GOVERNANCE & AUDIT ASSURANCE
      ───────────────────────────────────────────────────────────── */}
      <section className="relative w-full max-w-6xl mx-auto px-4 sm:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-1 text-xs font-mono font-medium text-stone-700 mb-3 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            <span>ENTERPRISE SECURITY & INSTITUTIONAL GOVERNANCE</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
            Built to protect academic integrity and financial truth.
          </h2>
          <p className="mt-3 text-stone-600 text-xs sm:text-sm font-light max-w-2xl mx-auto leading-relaxed">
            Every grade entry, fee waiver, and student record is protected by granular role boundaries, immutable change histories, and verifiable cryptographic tokens.
          </p>
        </div>

        {/* 4 Enterprise Governance Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pillar 1: Tamper-Evident Mark Audit Trail */}
          <div className="rounded-3xl border border-stone-300 bg-white p-7 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
                  <History className="h-5 w-5 text-amber-700" />
                </div>
                <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full border border-stone-200">
                  ANTI-TAMPER AUDIT
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-5">
                Immutable Grade Change History
              </h3>
              <p className="text-xs text-stone-600 font-light mt-2 leading-relaxed">
                Prevents unauthorized grade inflation. Every score change after initial entry requires teacher rationale and principal confirmation.
              </p>
            </div>

            {/* Live Audit Log UI Preview */}
            <div className="mt-6 rounded-2xl bg-stone-50 border border-stone-200 p-3.5 space-y-2.5 font-mono text-[11px]">
              <div className="flex items-start justify-between gap-2 border-b border-stone-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-bold text-stone-900">JSS 2 Math Final Exam</span>
                </div>
                <span className="text-stone-400 text-[10px]">10:42 AM</span>
              </div>
              <div className="text-stone-600 leading-normal">
                Teacher: <strong className="text-stone-800">Mr. Adeleke</strong> submitted 42 student scores. Principal verification token issued.
              </div>
              <div className="flex items-center gap-2 text-[10px] text-emerald-800 font-semibold bg-emerald-100/60 px-2.5 py-1 rounded-lg">
                <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                <span>Cryptographically Timestamped & Sealed</span>
              </div>
            </div>
          </div>

          {/* Pillar 2: Role-Based Access Isolation (RBAC) */}
          <div className="rounded-3xl border border-stone-300 bg-white p-7 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
                  <Users className="h-5 w-5 text-emerald-700" />
                </div>
                <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full border border-stone-200">
                  STRICT ISOLATION
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-5">
                Role-Based Separation of Duties
              </h3>
              <p className="text-xs text-stone-600 font-light mt-2 leading-relaxed">
                Strict boundaries between academic mark entry, bursary fee ledgers, and executive sign-off authority.
              </p>
            </div>

            {/* Roles Matrix Preview */}
            <div className="mt-6 grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                <div className="font-bold text-stone-900">Subject Teachers</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Assigned subjects only</div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                <div className="font-bold text-stone-900">Bursar & Finance</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Invoices & accounts only</div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                <div className="font-bold text-stone-900">Form Teachers</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Attendance & comments</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5">
                <div className="font-bold text-amber-900">Principal / Owner</div>
                <div className="text-[10px] text-amber-700 mt-0.5">Full sign-off & waivers</div>
              </div>
            </div>
          </div>

          {/* Pillar 3: Verifiable Digital Credentials & QR Code */}
          <div className="rounded-3xl border border-stone-300 bg-white p-7 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center border border-sky-200">
                  <FileCheck2 className="h-5 w-5 text-sky-700" />
                </div>
                <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full border border-stone-200">
                  CREDENTIAL VERIFICATION
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-5">
                Verifiable Official Report Cards
              </h3>
              <p className="text-xs text-stone-600 font-light mt-2 leading-relaxed">
                Every exported report card and official transcript carries a unique verification link and QR code for university and embassy confirmation.
              </p>
            </div>

            {/* Document Certificate Snippet */}
            <div className="mt-6 rounded-2xl bg-stone-50 border border-stone-200 p-3.5 flex items-center justify-between gap-4 font-mono text-xs">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-stone-900">Official Student Slip</div>
                <div className="text-[10px] text-stone-500">ID: MELO-2026-OKON-892</div>
                <div className="text-[10px] text-sky-700 font-semibold">melo.school/verify/89201</div>
              </div>
              <div className="h-14 w-14 rounded-xl bg-white border border-stone-300 flex items-center justify-center p-1 shadow-sm shrink-0">
                <QrCode className="h-10 w-10 text-stone-800" />
              </div>
            </div>
          </div>

          {/* Pillar 4: Zero Vendor Lock-In & Portability */}
          <div className="rounded-3xl border border-stone-300 bg-white p-7 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center border border-purple-200">
                  <Download className="h-5 w-5 text-purple-700" />
                </div>
                <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 px-2.5 py-1 rounded-full border border-stone-200">
                  DATA OWNERSHIP
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-5">
                Full Data Ownership & Instant Export
              </h3>
              <p className="text-xs text-stone-600 font-light mt-2 leading-relaxed">
                Your school owns 100% of its data. Download complete broadsheets, student records, and fee payment ledgers to clean Excel at any time.
              </p>
            </div>

            {/* Export Capabilities */}
            <div className="mt-6 flex flex-wrap gap-2 font-mono text-[11px]">
              <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-700 flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Full Term Broadsheets (.XLSX)</span>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-700 flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Bursary General Ledger (.CSV)</span>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-700 flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Student Transcripts (.PDF)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. SCENE 6: FINAL CONVERSION & ONBOARDING PROMISE
      ───────────────────────────────────────────────────────────── */}
      <section className="relative w-full max-w-6xl mx-auto px-4 sm:px-8 py-20 text-center">
        <div className="rounded-3xl border border-stone-300 bg-white p-8 sm:p-14 shadow-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-stone-50 px-3.5 py-1 text-xs font-mono font-medium text-stone-700 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Ready for next term</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
            Bring your school structure. We will set it up live in 15 minutes.
          </h2>
          <p className="mt-4 text-stone-600 text-sm sm:text-base max-w-2xl mx-auto font-light leading-relaxed">
            We will configure your class arms, grading rules, tuition levies, and teacher accounts with your real curriculum structure during a personalized 15-minute walkthrough.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <GoldButton href="/contact" size="lg" className="shadow-lg">
              Book a 15-minute walkthrough
            </GoldButton>
            <Link
              href="/pricing"
              onClick={() => playTick("click")}
              className="flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-7 py-3.5 text-sm font-medium text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <span>Explore Per-Student Pricing</span>
              <ArrowRight className="h-4 w-4 text-stone-400" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
