"use client";

import React from "react";
import {
  ArrowRight,
  ShieldCheck,
  Clock,
  Smartphone,
  History,
  FileCheck2,
  Download,
  QrCode,
  CheckCircle2,
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
          1. HERO SECTION: CLEAR EDITORIAL TYPOGRAPHY & DUST PHYSICS
      ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 sm:pt-40 pb-16 px-4 sm:px-8 max-w-5xl mx-auto text-center z-10">
        <div className="space-y-6">
          {/* Main Hero Headline */}
          <div className="w-full mx-auto">
            <SandFeatureHero />
          </div>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-stone-600 font-light leading-relaxed">
            Explore the four interconnected operating systems powering Melo: from continuous assessment broadsheets to Providus virtual bank feeds and AI curriculum planning.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
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
              className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-medium text-stone-800 hover:border-stone-400 hover:bg-stone-50 transition-all shadow-sm cursor-pointer"
            >
              <span>Explore Live Sandbox</span>
              <ArrowRight className="h-4 w-4 text-stone-400" />
            </a>
          </div>
        </div>

        {/* 3 Core Metric Cards */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <Card3DTilt maxTilt={4}>
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm h-full flex flex-col justify-between">
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold flex items-center justify-between">
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

          <Card3DTilt maxTilt={4}>
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm h-full flex flex-col justify-between">
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 font-bold flex items-center justify-between">
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

          <Card3DTilt maxTilt={4}>
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm h-full flex flex-col justify-between">
              <div className="text-[11px] font-mono uppercase tracking-wider text-sky-700 font-bold flex items-center justify-between">
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
          2. SCENE 2: 3-PILLAR COMPARATIVE OVERVIEW
      ───────────────────────────────────────────────────────────── */}
      <SplitPillarShowcase />

      {/* ─────────────────────────────────────────────────────────────
          3. SCENE 3: 4 UNIFIED OPERATING SYSTEMS
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
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
            Built to protect academic integrity and financial truth.
          </h2>
          <p className="mt-3 text-stone-600 text-sm sm:text-base font-light leading-relaxed">
            Every grade entry, fee waiver, and student record is protected by granular role boundaries, immutable change histories, and verifiable cryptographic tokens.
          </p>
        </div>

        {/* 4 Clean Governance Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pillar 1: Tamper-Evident Mark Audit Trail */}
          <div className="rounded-3xl border border-stone-300 bg-white p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-700">
                  ANTI-TAMPER AUDIT
                </span>
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
                  <History className="h-4 w-4" />
                </div>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-4">
                Immutable Grade Change History
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 font-light mt-2 leading-relaxed">
                Prevents unauthorized grade inflation. Every score change after initial entry requires teacher rationale and principal confirmation.
              </p>
            </div>

            <div className="mt-6 rounded-2xl bg-stone-50 border border-stone-200 p-3.5 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
                <span className="font-bold text-stone-900">JSS 2 Math Final Exam</span>
                <span className="text-stone-400 text-[10px]">10:42 AM</span>
              </div>
              <div className="text-stone-600 text-[11px]">
                Teacher: <strong className="text-stone-800">Mr. Adeleke</strong> submitted 42 scores. Principal verification token issued.
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-800 font-bold bg-emerald-100/70 px-2 py-1 rounded-lg">
                <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                <span>Cryptographically Timestamped & Sealed</span>
              </div>
            </div>
          </div>

          {/* Pillar 2: Role-Based Access Isolation (RBAC) */}
          <div className="rounded-3xl border border-stone-300 bg-white p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-700">
                  STRICT ISOLATION
                </span>
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-4">
                Role-Based Separation of Duties
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 font-light mt-2 leading-relaxed">
                Strict boundaries between academic mark entry, bursary fee ledgers, and executive sign-off authority.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                <div className="font-bold text-stone-900">Subject Teachers</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Assigned subjects only</div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                <div className="font-bold text-stone-900">Bursar & Finance</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Invoices & ledgers only</div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                <div className="font-bold text-stone-900">Form Teachers</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Attendance & comments</div>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                <div className="font-bold text-stone-900">Principal / Owner</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Full sign-off & waivers</div>
              </div>
            </div>
          </div>

          {/* Pillar 3: Verifiable Digital Credentials */}
          <div className="rounded-3xl border border-stone-300 bg-white p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-sky-700">
                  CREDENTIAL VERIFICATION
                </span>
                <div className="h-9 w-9 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center border border-sky-200">
                  <FileCheck2 className="h-4 w-4" />
                </div>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-4">
                Verifiable Official Report Cards
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 font-light mt-2 leading-relaxed">
                Every exported report card and official transcript carries a unique verification link and QR code for university and embassy confirmation.
              </p>
            </div>

            <div className="mt-6 rounded-2xl bg-stone-50 border border-stone-200 p-3.5 flex items-center justify-between gap-4 font-mono text-xs">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-stone-900">Official Student Slip</div>
                <div className="text-[10px] text-stone-500">ID: MELO-2026-OKON-892</div>
                <div className="text-[10px] text-sky-700 font-semibold">melo.school/verify/89201</div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white border border-stone-300 flex items-center justify-center p-1 shadow-sm shrink-0">
                <QrCode className="h-8 w-8 text-stone-800" />
              </div>
            </div>
          </div>

          {/* Pillar 4: Zero Vendor Lock-In & Portability */}
          <div className="rounded-3xl border border-stone-300 bg-white p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-purple-700">
                  DATA OWNERSHIP
                </span>
                <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center border border-purple-200">
                  <Download className="h-4 w-4" />
                </div>
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mt-4">
                Full Data Ownership & Instant Export
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 font-light mt-2 leading-relaxed">
                Your school owns 100% of its data. Download complete broadsheets, student records, and fee payment ledgers to clean Excel at any time.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 font-mono text-[11px]">
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-stone-700 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Broadsheets (.XLSX)</span>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-stone-700 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>General Ledger (.CSV)</span>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-stone-700 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Transcripts (.PDF)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. SCENE 6: FINAL CONVERSION & ONBOARDING PROMISE
      ───────────────────────────────────────────────────────────── */}
      <section className="relative w-full max-w-5xl mx-auto px-4 sm:px-8 py-20 text-center">
        <div className="rounded-3xl border border-stone-300 bg-white p-8 sm:p-14 shadow-sm">
          <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight">
            Bring your school structure. We will set it up live in 15 minutes.
          </h2>
          <p className="mt-4 text-stone-600 text-sm sm:text-base max-w-2xl mx-auto font-light leading-relaxed">
            We will configure your class arms, grading rules, tuition levies, and teacher accounts with your real curriculum structure during a personalized 15-minute walkthrough.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <GoldButton href="/contact" size="lg" className="shadow-md">
              Book a 15-minute walkthrough
            </GoldButton>
            <Link
              href="/pricing"
              onClick={() => playTick("click")}
              className="flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-6 py-3.5 text-sm font-medium text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
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
